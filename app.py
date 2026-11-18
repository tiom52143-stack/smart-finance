import io
import uuid
import json
from datetime import datetime
from flask import (
    Flask, render_template, request, redirect, url_for,
    session, jsonify, send_from_directory, send_file, flash
)
from werkzeug.security import generate_password_hash, check_password_hash
from authlib.integrations.flask_client import OAuth
from fpdf import FPDF
from openpyxl import Workbook

from config import Config
from database.connection import get_db_connection

# =========================================================================
# INISIALISASI APLIKASI FLASK & OAUTH 2.0
# =========================================================================
app = Flask(__name__)
app.config.from_object(Config)

oauth = OAuth(app)

# Registrasi Provider OAuth (Google, Facebook, Apple)
if app.config.get('GOOGLE_CLIENT_ID'):
    oauth.register(
        name='google',
        client_id=app.config['GOOGLE_CLIENT_ID'],
        client_secret=app.config['GOOGLE_CLIENT_SECRET'],
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'}
    )

if app.config.get('FACEBOOK_CLIENT_ID'):
    oauth.register(
        name='facebook',
        client_id=app.config['FACEBOOK_CLIENT_ID'],
        client_secret=app.config['FACEBOOK_CLIENT_SECRET'],
        access_token_url='https://graph.facebook.com/v19.0/oauth/access_token',
        authorize_url='https://www.facebook.com/v19.0/dialog/oauth',
        api_base_url='https://graph.facebook.com/v19.0/',
        client_kwargs={'scope': 'email public_profile'}
    )

if app.config.get('APPLE_CLIENT_ID'):
    oauth.register(
        name='apple',
        client_id=app.config['APPLE_CLIENT_ID'],
        client_secret=app.config['APPLE_CLIENT_SECRET'],
        server_metadata_url='https://appleid.apple.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'name email'}
    )


# =========================================================================
# CONTEXT PROCESSOR (Data Global untuk Semua Template HTML)
# =========================================================================
@app.context_processor
def inject_user_context():
    return {
        'current_user': {
            'is_authenticated': 'user_id' in session,
            'user_id': session.get('user_id'),
            'user_uuid': session.get('user_uuid'),
            'full_name': session.get('full_name', 'Pengguna Tamu'),
            'email': session.get('email', ''),
            'auth_provider': session.get('auth_provider', 'guest')
        }
    }


# =========================================================================
# ROUTE PWA (Service Worker & Manifest di Root Scope)
# =========================================================================
@app.route('/service-worker.js')
def service_worker():
    response = send_from_directory('static', 'service-worker.js')
    response.headers['Content-Type'] = 'application/javascript'
    response.headers['Service-Worker-Allowed'] = '/'
    return response


@app.route('/manifest.json')
def manifest():
    return send_from_directory('static', 'manifest.json')


# =========================================================================
# ROUTE HALAMAN PUBLIK & AUTENTIKASI
# =========================================================================
@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')

        conn = get_db_connection()
        if not conn:
            flash('Gagal terhubung ke server database.', 'danger')
            return render_template('login.html')

        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM users WHERE email = %s AND auth_provider = 'email'", (email,))
            user = cursor.fetchone()

            if user and user['password_hash'] and check_password_hash(user['password_hash'], password):
                session['user_id'] = user['id']
                session['user_uuid'] = user['client_uuid']
                session['full_name'] = user['full_name']
                session['email'] = user['email']
                session['auth_provider'] = 'email'
                return redirect(url_for('dashboard'))
            else:
                flash('Email atau kata sandi tidak sesuai.', 'danger')
        finally:
            cursor.close()
            conn.close()

    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    merge_mode = request.args.get('merge', '0') == '1'

    if request.method == 'POST':
        full_name = request.form.get('full_name', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')

        if password != confirm_password:
            flash('Konfirmasi kata sandi tidak cocok.', 'danger')
            return render_template('register.html')

        conn = get_db_connection()
        if not conn:
            flash('Gagal terhubung ke server database.', 'danger')
            return render_template('register.html')

        try:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cursor.fetchone():
                flash('Email sudah terdaftar. Silakan masuk.', 'warning')
                return redirect(url_for('login'))

            user_uuid = str(uuid.uuid4())
            pw_hash = generate_password_hash(password)

            cursor.execute(
                """
                INSERT INTO users (client_uuid, full_name, email, password_hash, auth_provider)
                VALUES (%s, %s, %s, %s, 'email')
                """,
                (user_uuid, full_name, email, pw_hash)
            )
            new_user_id = cursor.lastrowid

            # Buat 3 dompet bawaan jika bukan mode migrasi dari tamu
            if not merge_mode:
                default_wallets = [
                    (str(uuid.uuid4()), new_user_id, 'Tunai', 'cash', 0.00, 'banknote'),
                    (str(uuid.uuid4()), new_user_id, 'Bank BCA', 'bank', 0.00, 'landmark'),
                    (str(uuid.uuid4()), new_user_id, 'E-Wallet', 'ewallet', 0.00, 'smartphone')
                ]
                cursor.executemany(
                    """
                    INSERT INTO wallets (client_uuid, user_id, name, type, balance, icon)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    default_wallets
                )

            conn.commit()

            session['user_id'] = new_user_id
            session['user_uuid'] = user_uuid
            session['full_name'] = full_name
            session['email'] = email
            session['auth_provider'] = 'email'

            if merge_mode:
                return redirect(url_for('dashboard', trigger_merge='1'))
            return redirect(url_for('dashboard'))
        finally:
            cursor.close()
            conn.close()

    return render_template('register.html')


@app.route('/oauth/<provider>')
def oauth_login(provider):
    if provider not in ['google', 'facebook', 'apple']:
        return redirect(url_for('login'))

    client = oauth.create_client(provider)
    if not client:
        flash(f'Konfigurasi login {provider.capitalize()} belum diatur di server.', 'warning')
        return redirect(url_for('login'))

    session['oauth_merge'] = request.args.get('merge', '0') == '1'
    redirect_uri = url_for('oauth_callback', provider=provider, _external=True)
    return client.authorize_redirect(redirect_uri)


@app.route('/oauth/<provider>/callback')
def oauth_callback(provider):
    client = oauth.create_client(provider)
    if not client:
        return redirect(url_for('login'))

    token = client.authorize_access_token()
    user_info = {}

    if provider == 'google':
        user_info = token.get('userinfo') or client.userinfo()
        provider_id = user_info.get('sub')
        email = user_info.get('email')
        full_name = user_info.get('name', 'Pengguna Google')
        avatar_url = user_info.get('picture')
    elif provider == 'facebook':
        resp = client.get('me?fields=id,name,email,picture')
        user_info = resp.json()
        provider_id = user_info.get('id')
        email = user_info.get('email')
        full_name = user_info.get('name', 'Pengguna Facebook')
        avatar_url = user_info.get('picture', {}).get('data', {}).get('url')
    else:  # apple
        user_info = token.get('userinfo', {})
        provider_id = user_info.get('sub')
        email = user_info.get('email')
        full_name = user_info.get('name', 'Pengguna Apple')
        avatar_url = None

    conn = get_db_connection()
    if not conn:
        return redirect(url_for('login'))

    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT * FROM users WHERE (auth_provider = %s AND provider_id = %s) OR (email IS NOT NULL AND email = %s)",
            (provider, provider_id, email)
        )
        user = cursor.fetchone()

        if not user:
            user_uuid = str(uuid.uuid4())
            cursor.execute(
                """
                INSERT INTO users (client_uuid, full_name, email, auth_provider, provider_id, avatar_url)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (user_uuid, full_name, email, provider, provider_id, avatar_url)
            )
            user_id = cursor.lastrowid
            conn.commit()
        else:
            user_id = user['id']
            user_uuid = user['client_uuid']
            full_name = user['full_name']
            email = user['email']

        session['user_id'] = user_id
        session['user_uuid'] = user_uuid
        session['full_name'] = full_name
        session['email'] = email
        session['auth_provider'] = provider

        merge_flag = '1' if session.pop('oauth_merge', False) else None
        return redirect(url_for('dashboard', trigger_merge=merge_flag))
    finally:
        cursor.close()
        conn.close()


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# =========================================================================
# ROUTE HALAMAN UTAMA APLIKASI (Mendukung Cloud & Mode Tamu / Offline)
# =========================================================================
@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')


@app.route('/income')
def income():
    return render_template('income.html')


@app.route('/expense')
def expense():
    return render_template('expense.html')


@app.route('/savings')
def savings():
    return render_template('savings.html')


@app.route('/budget')
def budget():
    return render_template('budget.html')


@app.route('/history')
def history():
    return render_template('history.html')


@app.route('/report')
def report():
    return render_template('report.html')


@app.route('/wallet')
def wallet():
    return render_template('wallet.html')


@app.route('/profile')
def profile():
    return render_template('profile.html')


@app.route('/settings')
def settings():
    return render_template('settings.html')


# =========================================================================
# REST API: STATUS SESI, SINKRONISASI & MIGRASI AKUN TAMU (INDEXEDDB -> MYSQL)
# =========================================================================
@app.route('/api/session', methods=['GET'])
def api_session():
    if 'user_id' in session:
        return jsonify({
            'authenticated': True,
            'account_type': 'cloud',
            'user_uuid': session['user_uuid'],
            'full_name': session['full_name'],
            'email': session['email'],
            'auth_provider': session['auth_provider']
        })
    return jsonify({
        'authenticated': False,
        'account_type': 'guest'
    })


@app.route('/api/sync/merge-guest', methods=['POST'])
def api_merge_guest():
    """Menggabungkan seluruh data lokal IndexedDB Akun Tamu ke Akun Permanen MySQL."""
    if 'user_id' not in session:
        return jsonify({'status': 'error', 'message': 'Autentikasi diperlukan'}), 401

    payload = request.get_json(silent=True) or {}
    user_id = session['user_id']

    conn = get_db_connection()
    if not conn:
        return jsonify({'status': 'error', 'message': 'Koneksi database gagal'}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        # 1. Sinkronisasi Wallets
        wallet_id_map = {}
        for w in payload.get('wallets', []):
            cursor.execute(
                """
                INSERT INTO wallets (client_uuid, user_id, name, type, balance, icon, is_deleted)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    balance = VALUES(balance),
                    is_deleted = VALUES(is_deleted)
                """,
                (
                    w['client_uuid'], user_id, w['name'], w.get('type', 'cash'),
                    w.get('balance', 0), w.get('icon', 'wallet'), w.get('is_deleted', False)
                )
            )
            cursor.execute("SELECT id FROM wallets WHERE client_uuid = %s", (w['client_uuid'],))
            row = cursor.fetchone()
            if row:
                wallet_id_map[w['client_uuid']] = row['id']

        # 2. Sinkronisasi Kategori Kustom
        category_id_map = {}
        cursor.execute("SELECT id, client_uuid, name FROM categories WHERE user_id IS NULL OR user_id = %s", (user_id,))
        for cat in cursor.fetchall():
            category_id_map[cat['client_uuid']] = cat['id']
            category_id_map[cat['name'].lower()] = cat['id']

        for c in payload.get('categories', []):
            if not c.get('is_default', False):
                cursor.execute(
                    """
                    INSERT INTO categories (client_uuid, user_id, name, type, group_type, icon, is_default, is_deleted)
                    VALUES (%s, %s, %s, %s, %s, %s, FALSE, %s)
                    ON DUPLICATE KEY UPDATE name = VALUES(name), is_deleted = VALUES(is_deleted)
                    """,
                    (
                        c['client_uuid'], user_id, c['name'], c['type'],
                        c['group_type'], c.get('icon', 'tag'), c.get('is_deleted', False)
                    )
                )
                cursor.execute("SELECT id FROM categories WHERE client_uuid = %s", (c['client_uuid'],))
                row = cursor.fetchone()
                if row:
                    category_id_map[c['client_uuid']] = row['id']
                    category_id_map[c['name'].lower()] = row['id']

        # 3. Sinkronisasi Transaksi
        for tx in payload.get('transactions', []):
            w_id = wallet_id_map.get(tx.get('wallet_uuid'))
            c_id = category_id_map.get(tx.get('category_uuid')) or category_id_map.get(tx.get('category', '').lower())
            if w_id and c_id:
                cursor.execute(
                    """
                    INSERT INTO transactions (
                        client_uuid, user_id, wallet_id, category_id, type,
                        amount, transaction_date, note, is_deleted
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        amount = VALUES(amount),
                        note = VALUES(note),
                        is_deleted = VALUES(is_deleted)
                    """,
                    (
                        tx['client_uuid'], user_id, w_id, c_id, tx['type'],
                        tx['amount'], tx['transaction_date'], tx.get('note', ''),
                        tx.get('is_deleted', False)
                    )
                )

        # 4. Sinkronisasi Target Tabungan
        goal_id_map = {}
        for g in payload.get('saving_goals', []):
            cursor.execute(
                """
                INSERT INTO saving_goals (
                    client_uuid, user_id, title, target_amount, current_amount, target_date, status, is_deleted
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    current_amount = VALUES(current_amount),
                    status = VALUES(status),
                    is_deleted = VALUES(is_deleted)
                """,
                (
                    g['client_uuid'], user_id, g['title'], g['target_amount'],
                    g.get('current_amount', 0), g.get('target_date'),
                    g.get('status', 'active'), g.get('is_deleted', False)
                )
            )
            cursor.execute("SELECT id FROM saving_goals WHERE client_uuid = %s", (g['client_uuid'],))
            row = cursor.fetchone()
            if row:
                goal_id_map[g['client_uuid']] = row['id']

        # 5. Sinkronisasi Anggaran Bulanan
        for b in payload.get('budgets', []):
            c_id = category_id_map.get(b.get('category_uuid')) or category_id_map.get(b.get('category', '').lower())
            if c_id:
                cursor.execute(
                    """
                    INSERT INTO budgets (client_uuid, user_id, category_id, period_month, amount_limit, is_deleted)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        amount_limit = VALUES(amount_limit),
                        is_deleted = VALUES(is_deleted)
                    """,
                    (
                        b['client_uuid'], user_id, c_id, b['period_month'],
                        b['amount_limit'], b.get('is_deleted', False)
                    )
                )

        conn.commit()
        return jsonify({
            'status': 'success',
            'message': 'Seluruh data lokal berhasil digabungkan ke akun cloud.',
            'synced_at': datetime.utcnow().isoformat() + 'Z'
        })
    except Exception as exc:
        conn.rollback()
        return jsonify({'status': 'error', 'message': str(exc)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/api/sync/push', methods=['POST'])
def api_sync_push():
    """Menerima antrean perubahan offline dari client saat internet kembali aktif."""
    if 'user_id' not in session:
        return jsonify({'status': 'offline_local', 'message': 'Mode tamu disimpan lokal'}), 200
    return api_merge_guest()


@app.route('/api/sync/pull', methods=['GET'])
def api_sync_pull():
    """Mengambil seluruh data terbaru milik pengguna dari MySQL untuk disinkronkan ke IndexedDB."""
    if 'user_id' not in session:
        return jsonify({'status': 'guest'}), 200

    user_id = session['user_id']
    conn = get_db_connection()
    if not conn:
        return jsonify({'status': 'error', 'message': 'Database tidak tersedia'}), 500

    try:
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM wallets WHERE user_id = %s AND is_deleted = FALSE", (user_id,))
        wallets = cursor.fetchall()

        cursor.execute("SELECT * FROM categories WHERE (user_id IS NULL OR user_id = %s) AND is_deleted = FALSE", (user_id,))
        categories = cursor.fetchall()

        cursor.execute(
            """
            SELECT t.*, w.client_uuid AS wallet_uuid, w.name AS wallet_name,
                   c.client_uuid AS category_uuid, c.name AS category_name, c.group_type
            FROM transactions t
            JOIN wallets w ON t.wallet_id = w.id
            JOIN categories c ON t.category_id = c.id
            WHERE t.user_id = %s AND t.is_deleted = FALSE
            ORDER BY t.transaction_date DESC, t.id DESC
            """,
            (user_id,)
        )
        transactions = cursor.fetchall()

        cursor.execute("SELECT * FROM saving_goals WHERE user_id = %s AND is_deleted = FALSE", (user_id,))
        saving_goals = cursor.fetchall()

        cursor.execute(
            """
            SELECT b.*, c.client_uuid AS category_uuid, c.name AS category_name
            FROM budgets b
            JOIN categories c ON b.category_id = c.id
            WHERE b.user_id = %s AND b.is_deleted = FALSE
            """,
            (user_id,)
        )
        budgets = cursor.fetchall()

        return jsonify({
            'status': 'success',
            'wallets': wallets,
            'categories': categories,
            'transactions': transactions,
            'saving_goals': saving_goals,
            'budgets': budgets,
            'synced_at': datetime.utcnow().isoformat() + 'Z'
        })
    finally:
        cursor.close()
        conn.close()


# =========================================================================
# REST API: KEAMANAN PIN 6 DIGIT
# =========================================================================
@app.route('/api/security/pin', methods=['POST'])
def api_update_pin():
    if 'user_id' not in session:
        return jsonify({'status': 'local_only'}), 200

    data = request.get_json(silent=True) or {}
    enabled = bool(data.get('enabled', False))
    pin_code = str(data.get('pin', '')).strip()

    conn = get_db_connection()
    if not conn:
        return jsonify({'status': 'error', 'message': 'Database gagal terhubung'}), 500

    try:
        cursor = conn.cursor()
        if enabled and len(pin_code) == 6 and pin_code.isdigit():
            pin_hash = generate_password_hash(pin_code)
            cursor.execute(
                "UPDATE users SET is_pin_enabled = TRUE, pin_hash = %s WHERE id = %s",
                (pin_hash, session['user_id'])
            )
        else:
            cursor.execute(
                "UPDATE users SET is_pin_enabled = FALSE, pin_hash = NULL WHERE id = %s",
                (session['user_id'],)
            )
        conn.commit()
        return jsonify({'status': 'success'})
    finally:
        cursor.close()
        conn.close()


# =========================================================================
# REST API: EXPORT LAPORAN KEUANGAN (PDF & EXCEL)
# =========================================================================
@app.route('/api/export/pdf', methods=['POST'])
def export_pdf():
    payload = request.get_json(silent=True) or {}
    transactions = payload.get('transactions', [])
    period_label = payload.get('period', 'Periode Berjalan')

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font('Helvetica', 'B', 16)
    pdf.cell(0, 10, 'SMART FINANCE - Laporan Keuangan', ln=True)

    pdf.set_font('Helvetica', '', 11)
    pdf.cell(0, 8, f'Periode: {period_label}', ln=True)
    pdf.ln(4)

    # Header Tabel
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(30, 8, 'Tanggal', border=1)
    pdf.cell(55, 8, 'Keterangan', border=1)
    pdf.cell(35, 8, 'Kategori', border=1)
    pdf.cell(30, 8, 'Jenis', border=1)
    pdf.cell(40, 8, 'Nominal (Rp)', border=1, ln=True)

    pdf.set_font('Helvetica', '', 10)
    for tx in transactions:
        tgl = str(tx.get('transaction_date', '-'))[:10]
        note = str(tx.get('note') or tx.get('category', '-'))[:26]
        cat = str(tx.get('category', '-'))[:16]
        jenis = 'Masuk' if tx.get('type') == 'income' else 'Keluar'
        amt = f"{float(tx.get('amount', 0)):,.0f}".replace(',', '.')

        pdf.cell(30, 8, tgl, border=1)
        pdf.cell(55, 8, note, border=1)
        pdf.cell(35, 8, cat, border=1)
        pdf.cell(30, 8, jenis, border=1)
        pdf.cell(40, 8, amt, border=1, ln=True)

    buffer = io.BytesIO()
    pdf.output(buffer)
    buffer.seek(0)

    return send_file(
        buffer,
        mimetype='application/pdf',
        as_attachment=True,
        download_name='Laporan_Smart_Finance.pdf'
    )


@app.route('/api/export/excel', methods=['POST'])
def export_excel():
    payload = request.get_json(silent=True) or {}
    transactions = payload.get('transactions', [])

    wb = Workbook()
    ws = wb.active
    ws.title = 'Laporan Keuangan'

    ws.append(['Tanggal', 'Keterangan', 'Kategori', 'Dompet', 'Jenis', 'Nominal (Rp)'])

    for tx in transactions:
        ws.append([
            str(tx.get('transaction_date', '-')),
            str(tx.get('note') or tx.get('category', '-')),
            str(tx.get('category', '-')),
            str(tx.get('wallet_name', 'Tunai')),
            'Pemasukan' if tx.get('type') == 'income' else 'Pengeluaran',
            float(tx.get('amount', 0))
        ])

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return send_file(
        buffer,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='Laporan_Smart_Finance.xlsx'
    )


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
