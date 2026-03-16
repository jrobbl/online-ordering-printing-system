# ============================================================
# smoke_test.py
# Standalone test — prints a sample ticket directly.
# Does NOT talk to the API — hardware only.
#
# Run:
#   source venv/bin/activate
#   python3 smoke_test.py
# ============================================================

from datetime import datetime
from ticket import build_ticket, DEVICE

# ── Sample order — replace with real data to test layout ────

order = {
    'store'    : 'EMMER PANADERIA',
    'address'  : 'ZACATECAS 24 COL. ROMA NORTE',
    'phone'    : '5598333950',
    'order_id' : 51,
    'cajero'   : 'Marco',
    'customer' : 'Roberto BL',
    'timestamp': datetime.now(),
    'items'    : [
        {'name': 'Croissant natural',       'qty': 2, 'price': 25.00},
        {'name': 'Chocolatin',              'qty': 1, 'price': 35.00},
        {'name': 'Concha vainilla',         'qty': 3, 'price': 15.00},
        {'name': 'Concha de chocolate',     'qty': 2, 'price': 20.00},
        {'name': 'Bisquet',                 'qty': 1, 'price': 28.00},
        {'name': 'Rol de canela VEGANO',    'qty': 2, 'price': 35.00},
        {'name': 'Bagel natural',           'qty': 1, 'price': 32.00},
        {'name': 'Scone',                   'qty': 3, 'price': 25.00},
        {'name': 'Trenza Pistache',         'qty': 1, 'price': 45.00},
        {'name': 'Panque de platano',       'qty': 2, 'price': 28.00},
    ],
    'footer': [
        'SIGUENOS EN @EMMERPANADERIA',
        'GRACIAS POR TU COMPRA',
        'REVISA TU TICKET ANTES DE SALIR',
        'NO HAY CAMBIOS NI CANCELACIONES',
        'UNA VEZ QUE HA SALIDO DE LA TIENDA',
        'FACTURACIONEMMER@GMAIL.COM',
        'FACTURACION SOLO CONSUMOS DEL MES',
        'CORRIENTE HASTA LAS 6 PM DEL',
        'ULTIMO DIA',
    ]
}

# ── Print ────────────────────────────────────────────────────

try:
    with open(DEVICE, 'wb') as p:
        build_ticket(p, order)
    print('✅ Ticket impreso correctamente')

except PermissionError:
    print('❌ Permiso denegado — intenta: sudo python3 smoke_test.py')
except FileNotFoundError:
    print('❌ Impresora no encontrada en /dev/usb/lp0')
except Exception as e:
    print(f'❌ Error: {e}')
