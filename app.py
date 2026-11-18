import os
from flask import Flask, render_template, redirect, url_for, jsonify, send_from_directory

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

app = Flask(
    __name__,
    static_folder=os.path.join(BASE_DIR, 'static'),
    template_folder=os.path.join(BASE_DIR, 'templates')
)
app.secret_key = os.environ.get('SECRET_KEY', 'smart-finance-local-first-2026')


# =========================================================================
# HALAMAN UTAMA (LANGSUNG KE BERANDA / DASHBOARD)
# =========================================================================
@app.route('/')
@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html', active_page='dashboard')


# Alihkan semua rute akun lama langsung ke Beranda
@app.route('/login')
@app.route('/register')
@app.route('/logout')
def redirect_auth_to_home():
    return redirect(url_for('dashboard'))


# =========================================================================
# MENU FITUR KEUANGAN
# =========================================================================
@app.route('/income')
def income():
    return render_template('income.html', active_page='income')


@app.route('/expense')
def expense():
    return render_template('expense.html', active_page='expense')


@app.route('/savings')
def savings():
    return render_template('savings.html', active_page='savings')


@app.route('/budget')
def budget():
    return render_template('budget.html', active_page='budget')


@app.route('/history')
def history():
    return render_template('history.html', active_page='history')


@app.route('/report')
def report():
    return render_template('report.html', active_page='report')


@app.route('/wallet')
def wallet():
    return render_template('wallet.html', active_page='wallet')


@app.route('/profile')
def profile():
    return render_template('profile.html', active_page='profile')


@app.route('/settings')
def settings():
    return render_template('settings.html', active_page='settings')


# =========================================================================
# ASET PWA & ENDPOINT LOKAL
# =========================================================================
@app.route('/manifest.json')
def manifest():
    return send_from_directory(app.static_folder, 'manifest.json')


@app.route('/service-worker.js')
def service_worker():
    return send_from_directory(app.static_folder, 'service-worker.js')


@app.route('/api/sync', methods=['POST'])
@app.route('/api/sync/merge', methods=['POST'])
def local_sync_ack():
    return jsonify({
        'status': 'local_only',
        'message': 'Data tersimpan aman secara lokal di perangkat.'
    }), 200


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
