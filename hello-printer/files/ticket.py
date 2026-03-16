# ============================================================
# ticket.py
# Reusable print template for Emmer Panaderia
# Import build_ticket() from other scripts
# 80mm paper = 48 chars per line
# ============================================================

from datetime import datetime

# ── ESC/POS commands ────────────────────────────────────────
ESC = b'\x1b'
GS  = b'\x1d'

RESET           = ESC + b'@'
BOLD_ON         = ESC + b'E\x01'
BOLD_OFF        = ESC + b'E\x00'
DOUBLE_SIZE_ON  = GS  + b'!\x11'
DOUBLE_SIZE_OFF = GS  + b'!\x00'
ALIGN_CENTER    = ESC + b'a\x01'
ALIGN_LEFT      = ESC + b'a\x00'
ALIGN_RIGHT     = ESC + b'a\x02'
FEED            = b'\n'
CUT             = GS  + b'V\x41\x00'

DEVICE   = '/dev/usb/lp0'
WIDTH    = 48
LINE     = '-' * WIDTH + '\n'
IVA_RATE = 0.16


# ── Helpers ──────────────────────────────────────────────────

def center(text, width=WIDTH):
    """Center a string within width."""
    return text.center(width) + '\n'

def left_right(left, right, width=WIDTH):
    """Two strings: left aligned and right aligned on same line."""
    gap = width - len(left) - len(right)
    if gap < 1:
        gap = 1
    return left + ' ' * gap + right + '\n'

def amount_in_words(amount):
    """Convert integer peso amount to Spanish words."""
    words = {
        0:'CERO', 1:'UN', 2:'DOS', 3:'TRES', 4:'CUATRO',
        5:'CINCO', 6:'SEIS', 7:'SIETE', 8:'OCHO', 9:'NUEVE',
        10:'DIEZ', 11:'ONCE', 12:'DOCE', 13:'TRECE',
        14:'CATORCE', 15:'QUINCE', 16:'DIECISEIS',
        17:'DIECISIETE', 18:'DIECIOCHO', 19:'DIECINUEVE',
        20:'VEINTE', 30:'TREINTA', 40:'CUARENTA',
        50:'CINCUENTA', 60:'SESENTA', 70:'SETENTA',
        80:'OCHENTA', 90:'NOVENTA', 100:'CIEN',
        200:'DOSCIENTOS', 300:'TRESCIENTOS', 400:'CUATROCIENTOS',
        500:'QUINIENTOS', 600:'SEISCIENTOS', 700:'SETECIENTOS',
        800:'OCHOCIENTOS', 900:'NOVECIENTOS'
    }
    n = int(amount)
    if n in words:
        return words[n] + ' PESOS 00/100 M.N.'
    if n < 100:
        tens = (n // 10) * 10
        ones = n % 10
        return words[tens] + ' Y ' + words[ones] + ' PESOS 00/100 M.N.'
    if n < 200:
        rest = n - 100
        if rest == 0:
            return 'CIEN PESOS 00/100 M.N.'
        return 'CIENTO ' + amount_in_words(rest).replace(' PESOS 00/100 M.N.', '') + ' PESOS 00/100 M.N.'
    if n < 1000:
        hundreds = (n // 100) * 100
        rest = n % 100
        if rest == 0:
            return words[hundreds] + ' PESOS 00/100 M.N.'
        return words[hundreds] + ' ' + amount_in_words(rest).replace(' PESOS 00/100 M.N.', '') + ' PESOS 00/100 M.N.'
    if n < 2000:
        rest = n - 1000
        if rest == 0:
            return 'MIL PESOS 00/100 M.N.'
        return 'MIL ' + amount_in_words(rest).replace(' PESOS 00/100 M.N.', '') + ' PESOS 00/100 M.N.'
    thousands = n // 1000
    rest = n % 1000
    base = words.get(thousands, str(thousands)) + ' MIL'
    if rest == 0:
        return base + ' PESOS 00/100 M.N.'
    return base + ' ' + amount_in_words(rest).replace(' PESOS 00/100 M.N.', '') + ' PESOS 00/100 M.N.'


# ── Template ─────────────────────────────────────────────────

def build_ticket(p, order):
    """
    Write a formatted ticket to the printer.
    p     = open file handle to /dev/usb/lp0
    order = dict with order data

    Expected order structure:
    {
        'store'    : str,
        'address'  : str,
        'phone'    : str,
        'order_id' : int or str,
        'cajero'   : str,
        'customer' : str,
        'timestamp': datetime object,
        'items'    : [{'name': str, 'qty': int, 'price': float}],
        'footer'   : [str, str, ...]
    }
    """

    def w(data):
        if isinstance(data, str):
            data = data.encode('utf-8', errors='replace')
        p.write(data)

    timestamp = order.get('timestamp', datetime.now())
    date_str  = timestamp.strftime('%d/%m/%Y')
    time_str  = timestamp.strftime('%I:%M:%S %p').lower()

    subtotal = sum(i['qty'] * i['price'] for i in order['items'])
    iva      = round(subtotal * IVA_RATE, 2)
    total    = round(subtotal + iva, 2)
    count    = sum(i['qty'] for i in order['items'])

    # ── Top label ────────────────────────────────────────────
    w(RESET)
    w(ALIGN_CENTER)

    # ── Copy label ───────────────────────────────────────────
    label = 'COPIA CLIENTE' if order.get('copy_type') == 'customer' else 'COPIA TIENDA'
    w(DOUBLE_SIZE_ON)
    w(center(label))
    w(DOUBLE_SIZE_OFF)

    w(center('Preticket orden para llevar'))
    w(LINE)

    # ── Store header ─────────────────────────────────────────
    w(BOLD_ON)
    w(center(order['store']))
    w(BOLD_OFF)
    w(center(order['address']))
    w(center(order['phone']))
    w(LINE)

    # ── Order info ───────────────────────────────────────────
    w(ALIGN_LEFT)
    w(left_right('Fecha:',        date_str))
    w(left_right('Orden:',        str(order['order_id'])))
    w(left_right('Cajero:',       order['cajero']))
    w(left_right('Hora Entrada:', time_str))
    w(LINE)

    # ── Column headers ───────────────────────────────────────
    w(BOLD_ON)
    w(f"{'Cant.':<6} {'Descripcion':<28} {'Importe':>8}\n")
    w(BOLD_OFF)
    w(LINE)

    # ── Items ────────────────────────────────────────────────
    for item in order['items']:
        subtotal_item = item['qty'] * item['price']
        name = item['name'][:27]
        w(f"{item['qty']:<6} {name:<28} ${subtotal_item:>6.2f}\n")

    w(LINE)

    # ── Article count ────────────────────────────────────────
    w(f"Articulos: {count}\n")
    w(LINE)

    is_customer = order.get('copy_type') == 'customer'

    if is_customer:
        # ── Totals ───────────────────────────────────────────
        w(ALIGN_RIGHT)
        w(f"Subtotal: ${subtotal:>8.2f}\n")
        w(f"     IVA: ${iva:>8.2f}\n")
        w(BOLD_ON)
        w(f"Gran Total: ${total:>8.2f}\n")
        w(BOLD_OFF)
        w(FEED)

        # ── Amount in words ──────────────────────────────────
        w(ALIGN_CENTER)
        words_line = amount_in_words(total)
        if len(words_line) <= WIDTH:
            w(center(words_line))
        else:
            mid = words_line[:WIDTH].rfind(' ')
            w(center(words_line[:mid]))
            w(center(words_line[mid+1:]))
        w(LINE)

        # ── Terminal info ────────────────────────────────────
        w(ALIGN_LEFT)
        w(left_right('Terminal:',        '1 -- SERVER1'))
        w(left_right('Fecha impresion:', f"{date_str} {time_str}"))
        w(LINE)

    # ── Customer data (both copies) ───────────────────────────
    w(ALIGN_CENTER)
    w(BOLD_ON)
    w(center('DATOS DEL CLIENTE'))
    w(BOLD_OFF)
    w(ALIGN_LEFT)
    w(left_right('Nombre:',   order['customer']))
    w(left_right('Sucursal:', order.get('branch', '')))
    w(LINE)

    if is_customer:
        # ── Customer footer: signature line ──────────────────
        w(ALIGN_CENTER)
        w(BOLD_ON)
        w(center('FIRMA DEL CLIENTE'))
        w(BOLD_OFF)
        w(ALIGN_LEFT)
        w('_' * WIDTH + '\n')
        w(LINE)
        w(center('Powered by jrobbl'))
    else:
        # ── Store copy ends here — no footer ─────────────────
        pass

    w(FEED)
    w(FEED)
    w(FEED)
    w(CUT)
