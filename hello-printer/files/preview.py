#!/usr/bin/env python3
"""
preview.py — Generate a PNG preview of the ticket without a physical printer.

Usage:
    python3 preview.py              # both copies
    python3 preview.py customer     # COPIA CLIENTE only
    python3 preview.py store        # COPIA TIENDA only

Output files written to /tmp/ticket_preview_customer.png
                     and /tmp/ticket_preview_store.png
"""

import io
import sys
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont
from ticket import build_ticket

# ── Test order — edit freely to try different layouts ───────────────────────

TEST_ORDER = {
    'store'    : 'EMMER PANADERIA',
    'address'  : 'ZACATECAS 24 COL. ROMA NORTE',
    'phone'    : '5598333950',
    'cajero'   : 'Proveeduría',
    'footer'   : [],
    'order_id' : "XXXX",
    'customer' : 'PRUEBA',
    'branch'   : 'SUCURSAL NORTE',
    'timestamp': datetime.now(),
    'items'    : [
        {'name': 'Pan Blanco Grande',        'qty': 3, 'price': 15.0},
        {'name': 'Croissant de Mantequilla', 'qty': 2, 'price': 15.0},
        {'name': 'Baguette',                 'qty': 1, 'price': 15.0},
        {'name': 'Dona de Chocolate',        'qty': 4, 'price': 15.0},
    ],
    'notes': 'Sin semillas de ajonjoli por favor, alergia del cliente'
}

# ── ESC/POS → text lines ─────────────────────────────────────────────────────

def strip_escpos(data: bytes) -> list:
    """
    Remove ESC/POS control bytes, return (lines, bold_flags, size_flags).
    Tracks bold and double-size per line for richer rendering.
    """
    lines   = []
    bold    = []
    big     = []

    current      = bytearray()
    is_bold      = False
    is_big       = False

    i = 0
    while i < len(data):
        b = data[i]

        if b == 0x1b:                       # ESC
            i += 1
            if i >= len(data): break
            cmd = data[i]
            if cmd == ord('@'):              # Reset
                is_bold = False
                is_big  = False
            elif cmd == ord('E'):           # Bold
                i += 1
                is_bold = (data[i] != 0x00)
            elif cmd == ord('a'):           # Alignment (already encoded in text spacing)
                i += 1
            i += 1
            continue

        if b == 0x1d:                       # GS
            i += 1
            if i >= len(data): break
            cmd = data[i]
            if cmd == ord('!'):             # Double size
                i += 1
                is_big = (data[i] != 0x00)
            elif cmd == ord('V'):           # Cut — skip 2 bytes
                i += 3
                continue
            i += 1
            continue

        if b == 0x0a:                       # Newline
            line = current.decode('utf-8', errors='replace')
            lines.append(line)
            bold.append(is_bold)
            big.append(is_big)
            current = bytearray()
            i += 1
            continue

        if 0x20 <= b <= 0x7e or b >= 0x80:
            current.append(b)

        i += 1

    if current:
        lines.append(current.decode('utf-8', errors='replace'))
        bold.append(is_bold)
        big.append(is_big)

    return lines, bold, big


# ── PNG renderer ─────────────────────────────────────────────────────────────

FONT_CANDIDATES = [
    '/usr/share/fonts/liberation-mono/LiberationMono-{}.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationMono-{}.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono{}.ttf',
    '/usr/share/fonts/dejavu-sans-mono-fonts/DejaVuSansMono{}.ttf',
]

def load_fonts(size):
    for pattern in FONT_CANDIDATES:
        try:
            regular = ImageFont.truetype(pattern.format('Regular'), size)
            try:
                bold = ImageFont.truetype(pattern.format('Bold'), size)
            except Exception:
                bold = regular
            return regular, bold
        except Exception:
            try:
                regular = ImageFont.truetype(pattern.format(''), size)
                return regular, regular
            except Exception:
                continue
    # Fallback: PIL built-in (no bold distinction)
    f = ImageFont.load_default()
    return f, f


def render_to_png(lines, bold_flags, big_flags, output_path):
    BASE_SIZE   = 15
    BASE_HEIGHT = 19
    PADDING     = 24
    PAPER_W     = 500          # ~80mm receipt width

    font_reg, font_bold = load_fonts(BASE_SIZE)
    font_big_reg, font_big_bold = load_fonts(BASE_SIZE * 2)

    # Calculate total height
    total_h = PADDING * 2
    for b in big_flags:
        total_h += BASE_HEIGHT * 2 if b else BASE_HEIGHT

    img  = Image.new('RGB', (PAPER_W, total_h), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)

    y = PADDING
    for line, is_bold, is_big in zip(lines, bold_flags, big_flags):
        lh = BASE_HEIGHT * 2 if is_big else BASE_HEIGHT
        if is_big:
            font = font_big_bold if is_bold else font_big_reg
        else:
            font = font_bold if is_bold else font_reg
        draw.text((PADDING, y), line, fill=(0, 0, 0), font=font)
        y += lh

    img.save(output_path)
    print(f'  → saved: {output_path}')


# ── Main ─────────────────────────────────────────────────────────────────────

def preview(copy_type):
    order = dict(TEST_ORDER)
    order['copy_type'] = copy_type

    buf = io.BytesIO()
    build_ticket(buf, order)
    lines, bold_flags, big_flags = strip_escpos(buf.getvalue())

    out = f'/tmp/ticket_preview_{copy_type}.png'
    render_to_png(lines, bold_flags, big_flags, out)
    return out


if __name__ == '__main__':
    arg = sys.argv[1] if len(sys.argv) > 1 else 'both'

    copies = ['customer', 'store'] if arg == 'both' else [arg]
    outputs = []

    print('\n🖨️  Ticket Preview Generator')
    for c in copies:
        label = 'COPIA CLIENTE' if c == 'customer' else 'COPIA TIENDA'
        print(f'  Rendering {label}...')
        outputs.append(preview(c))

    print('\nOpen with:')
    print(f"  eog {' '.join(outputs)}")
