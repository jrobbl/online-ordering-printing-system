# ============================================================
# poll_and_print.py
# Polls the VPS API every 3 seconds for pending print jobs.
# When a job is found, prints a ticket and marks it as done.
#
# Run manually:
#   source venv/bin/activate
#   python3 poll_and_print.py
#
# Runs automatically on boot via systemd (Phase 6).
# ============================================================

import time
import requests
from datetime import datetime
from dotenv import load_dotenv
import os
from ticket import build_ticket, DEVICE

# ── Load environment variables ───────────────────────────────
load_dotenv()
API_URL        = os.getenv('API_URL')
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD')
DEVICE         = os.getenv('PRINTER_DEVICE') or DEVICE

# ── Store info (constant) ────────────────────────────────────
STORE = {
    'store'  : 'EMMER PANADERIA',
    'address': 'ZACATECAS 24 COL. ROMA NORTE',
    'phone'  : '5598333950',
    'cajero' : 'Sistema',
    'footer' : [
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


# ── Auth ─────────────────────────────────────────────────────

def get_token():
    """Log in and return a JWT token."""
    try:
        res = requests.post(
            f'{API_URL}/api/auth/login',
            json={'username': ADMIN_USERNAME, 'password': ADMIN_PASSWORD},
            timeout=5
        )
        data = res.json()
        if res.status_code == 200 and data.get('token'):
            print('✅ Logged in successfully')
            return data['token']
        else:
            print(f'❌ Login failed: {data}')
            return None
    except Exception as e:
        print(f'❌ Could not reach server: {e}')
        return None


# ── Print ─────────────────────────────────────────────────────

def print_job(job):
    """Build the order dict and send ticket to thermal printer."""
    order = {
        **STORE,
        'order_id'  : job['order_id'],
        'customer'  : job['customer_name'],
        'branch'    : job['customer_branch'],
        'notes'     : job.get('notes') or '',
        'timestamp' : datetime.fromisoformat(job['order_date'].replace('Z', '+00:00')).astimezone(),
        'copy_type' : job['copy_type'],
        'items'     : [
            {'name': i['name'], 'qty': i['qty'], 'price': i['price']}
            for i in job['items']
        ],
    }
    with open(DEVICE, 'wb') as p:
        build_ticket(p, order)


# ── Poll ──────────────────────────────────────────────────────

def poll(token):
    """Check for a pending job. If found, print and mark done."""
    try:
        headers = {'Authorization': f'Bearer {token}'}

        res = requests.get(
            f'{API_URL}/api/print-job/pending',
            headers=headers,
            timeout=5
        )

        if res.status_code in (401, 403):
            print('⚠️  Token expired — reconnecting...')
            return False  # Signal to re-login

        data = res.json()
        job  = data.get('job')

        if job:
            print(f'🖨️  Job #{job["id"]} found — printing...')
            print_job(job)
            print(f'✅ Job #{job["id"]} printed')

            # Mark job as done
            done = requests.patch(
                f'{API_URL}/api/print-job/{job["id"]}/done',
                headers=headers,
                timeout=5
            )
            if done.status_code == 200:
                print(f'✅ Job #{job["id"]} marked as done')
            else:
                print(f'⚠️  Could not mark job as done: {done.status_code}')
        else:
            print('⏳ No jobs pending...')

        return True

    except Exception as e:
        print(f'❌ Poll error: {e}')
        return True


# ── Main ──────────────────────────────────────────────────────

def main():
    print('\n🖨️  Hello Printer — Poll Script')
    print(f'   Server: {API_URL}')
    print('   Polling every 3 seconds')
    print('   Press Ctrl+C to stop\n')

    token = None

    while True:
        try:
            if not token:
                token = get_token()
                if not token:
                    print('⏳ Retrying login in 10 seconds...')
                    time.sleep(10)
                    continue

            success = poll(token)
            if not success:
                token = None  # Force re-login on next iteration

            time.sleep(3)

        except KeyboardInterrupt:
            print('\n\n👋 Stopped.')
            break


if __name__ == '__main__':
    main()
