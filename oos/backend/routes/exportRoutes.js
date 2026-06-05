const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { authenticateToken } = require('../middleware/auth');
const pool = require('../config/database');

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const CLIENT_PALETTE = [
    'FFE07830', // orange (brand)
    'FF3B7FC4', // blue
    'FF4A9B6F', // green
    'FFC0627D', // pink
    'FF7B5EA7', // purple
    'FF2E9E9E', // teal
    'FFC4962A', // amber
    'FFC45A45', // coral
    'FF4A5FA8', // indigo
    'FF8A5A8A', // mauve
    'FF5F8A72', // sage
    'FF8A8A2E', // olive
];
const SUBHEADER_COLOR = 'FFFDF3E7';
const TOTAL_COLOR     = 'FFFFF8EE';

function dateKey(date) {
    return date.toISOString().split('T')[0];
}

function getDaysInRange(from, to) {
    const days = [];
    const cur = new Date(from);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(0, 0, 0, 0);
    while (cur < end) {
        days.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
    }
    return days;
}

router.get('/', authenticateToken, async (req, res) => {
    const { date_from, date_to } = req.query;

    if (!date_from || !date_to) {
        return res.status(400).json({ error: 'Se requieren date_from y date_to' });
    }

    try {
        const result = await pool.query(`
            SELECT
                o.customer_name,
                o.customer_branch,
                p.product_name,
                DATE(o.order_date) AS day,
                SUM(oi.quantity)   AS total_qty
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.order_id
            JOIN products p     ON p.product_id = oi.product_id
            WHERE o.order_date >= $1 AND o.order_date < $2
              AND o.status = 'completed'
            GROUP BY o.customer_name, o.customer_branch, p.product_name, DATE(o.order_date)
            ORDER BY o.customer_name, o.customer_branch, p.product_name
        `, [date_from, date_to]);

        const days = getDaysInRange(new Date(date_from), new Date(date_to));

        // Build pivot: { "name||branch" -> { product -> { dateKey -> qty } } }
        const pivot = new Map();
        const clientOrder = [];
        const clientColors = new Map();
        let colorIdx = 0;

        for (const row of result.rows) {
            const key = `${row.customer_name}||${row.customer_branch}`;
            if (!pivot.has(key)) {
                pivot.set(key, { name: row.customer_name, branch: row.customer_branch, products: new Map() });
                clientOrder.push(key);
            }
            if (!clientColors.has(row.customer_name)) {
                clientColors.set(row.customer_name, CLIENT_PALETTE[colorIdx % CLIENT_PALETTE.length]);
                colorIdx++;
            }
            const client = pivot.get(key);
            if (!client.products.has(row.product_name)) {
                client.products.set(row.product_name, {});
            }
            client.products.get(row.product_name)[dateKey(new Date(row.day))] = parseInt(row.total_qty);
        }

        // Build workbook
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Pedidos');

        const COL_OFFSET = 2; // start at column B
        let rowIdx = 2;       // start at row 2

        for (const key of clientOrder) {
            const { name, branch, products } = pivot.get(key);

            const totalCols = days.length + 2; // product col + day cols + total col

            // Client header row (merged across all columns)
            const headerRow = sheet.getRow(rowIdx);
            const headerCell = headerRow.getCell(COL_OFFSET);
            headerCell.value = `${name} — ${branch}`;
            headerCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
            headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: clientColors.get(name) } };
            headerCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            sheet.mergeCells(rowIdx, COL_OFFSET, rowIdx, COL_OFFSET + totalCols - 1);
            headerRow.height = 22;
            rowIdx++;

            // Column headers: Producto | day1 | day2 | ... | Total
            const colHeaderRow = sheet.getRow(rowIdx);
            colHeaderRow.getCell(COL_OFFSET).value = 'Producto';
            colHeaderRow.getCell(COL_OFFSET).font = { bold: true };
            colHeaderRow.getCell(COL_OFFSET).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEADER_COLOR } };

            days.forEach((day, i) => {
                const cell = colHeaderRow.getCell(COL_OFFSET + 1 + i);
                const dd = String(day.getDate()).padStart(2, '0');
                const mm = String(day.getMonth() + 1).padStart(2, '0');
                cell.value = `${DAY_NAMES[day.getDay()]} ${dd}/${mm}`;
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEADER_COLOR } };
                cell.alignment = { horizontal: 'center' };
            });

            const totalHeaderCell = colHeaderRow.getCell(COL_OFFSET + 1 + days.length);
            totalHeaderCell.value = 'Total';
            totalHeaderCell.font = { bold: true };
            totalHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEADER_COLOR } };
            totalHeaderCell.alignment = { horizontal: 'center' };
            rowIdx++;

            // Product rows
            for (const [product, dayData] of products) {
                const row = sheet.getRow(rowIdx);
                row.getCell(COL_OFFSET).value = product;

                let weekTotal = 0;
                days.forEach((day, i) => {
                    const qty = dayData[dateKey(day)] || 0;
                    const cell = row.getCell(COL_OFFSET + 1 + i);
                    cell.value = qty > 0 ? qty : null;
                    cell.alignment = { horizontal: 'center' };
                    weekTotal += qty;
                });

                const totalCell = row.getCell(COL_OFFSET + 1 + days.length);
                totalCell.value = weekTotal;
                totalCell.font = { bold: true };
                totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_COLOR } };
                totalCell.alignment = { horizontal: 'center' };
                rowIdx++;
            }

            rowIdx++; // blank row between blocks
        }

        // Set column widths
        sheet.getColumn(COL_OFFSET).width = 28;
        days.forEach((_, i) => { sheet.getColumn(COL_OFFSET + 1 + i).width = 11; });
        sheet.getColumn(COL_OFFSET + 1 + days.length).width = 10;

        // Borders on all data cells
        const firstDataRow = 2;
        const lastDataRow  = rowIdx - 1;
        for (let r = firstDataRow; r <= lastDataRow; r++) {
            for (let c = COL_OFFSET; c <= COL_OFFSET + days.length + 1; c++) {
                const cell = sheet.getRow(r).getCell(c);
                if (cell.value !== null && cell.value !== undefined) {
                    cell.border = {
                        top:    { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        left:   { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                        right:  { style: 'thin', color: { argb: 'FFD0D0D0' } },
                    };
                }
            }
        }

        const from = new Date(date_from).toLocaleDateString('es-MX').replace(/\//g, '-');
        const to   = new Date(date_to).toLocaleDateString('es-MX').replace(/\//g, '-');
        const filename = `pedidos_${from}_${to}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'No se pudo generar el archivo' });
    }
});

module.exports = router;
