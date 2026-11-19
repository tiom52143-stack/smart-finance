<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#081C38">
    <title>{% block title %}SMART FINANCE — Dashboard Keuangan{% endblock %}</title>

    <link rel="manifest" href="{{ url_for('static', filename='manifest.json') }}">
    <link rel="icon" type="image/png" sizes="192x192" href="{{ url_for('static', filename='images/icons/icon-192x192.png') }}">
    <link rel="apple-touch-icon" href="{{ url_for('static', filename='images/icons/icon-192x192.png') }}">

    <!-- Font & Pustaka Grafik/Ikon -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <!-- Stylesheet Utama -->
    <link rel="stylesheet" href="{{ url_for('static', filename='css/variables.css') }}?v=3">
    <link rel="stylesheet" href="{{ url_for('static', filename='css/main.css') }}?v=3">
    <link rel="stylesheet" href="{{ url_for('static', filename='css/responsive.css') }}?v=3">
</head>
<body>
    <div class="app-shell">
        <!-- SIDEBAR BIRU TUA -->
        <aside class="sidebar">
            <a href="{{ url_for('dashboard') }}" class="sidebar-brand">
                <span class="brand-icon-box">
                    <i data-lucide="bar-chart-2" style="width:19px;height:19px;"></i>
                </span>
                <span>SMART FINANCE</span>
            </a>

            <nav class="sidebar-nav">
                <a href="{{ url_for('dashboard') }}" class="nav-item {{ 'active' if active_page == 'dashboard' else '' }}">
                    <i data-lucide="home"></i>
                    <span>Dashboard</span>
                </a>
                <a href="{{ url_for('income') }}" class="nav-item {{ 'active' if active_page == 'income' else '' }}">
                    <i data-lucide="arrow-up"></i>
                    <span>Income</span>
                </a>
                <a href="{{ url_for('expense') }}" class="nav-item {{ 'active' if active_page == 'expense' else '' }}">
                    <i data-lucide="arrow-down"></i>
                    <span>Expense</span>
                </a>
                <a href="{{ url_for('savings') }}" class="nav-item {{ 'active' if active_page == 'savings' else '' }}">
                    <i data-lucide="target"></i>
                    <span>Savings</span>
                </a>
                <a href="{{ url_for('budget') }}" class="nav-item {{ 'active' if active_page == 'budget' else '' }}">
                    <i data-lucide="pie-chart"></i>
                    <span>Budget</span>
                </a>
                <a href="{{ url_for('history') }}" class="nav-item {{ 'active' if active_page == 'history' else '' }}">
                    <i data-lucide="list"></i>
                    <span>History</span>
                </a>
                <a href="{{ url_for('report') }}" class="nav-item {{ 'active' if active_page == 'report' else '' }}">
                    <i data-lucide="bar-chart-3"></i>
                    <span>Report</span>
                </a>
                <a href="{{ url_for('wallet') }}" class="nav-item {{ 'active' if active_page == 'wallet' else '' }}">
                    <i data-lucide="wallet"></i>
                    <span>Wallet</span>
                </a>
            </nav>

            <div class="sidebar-footer-nav">
                <a href="{{ url_for('profile') }}" class="nav-item {{ 'active' if active_page == 'profile' else '' }}">
                    <i data-lucide="user"></i>
                    <span>Profil</span>
                </a>
                <a href="{{ url_for('settings') }}" class="nav-item {{ 'active' if active_page == 'settings' else '' }}">
                    <i data-lucide="settings"></i>
                    <span>Pengaturan</span>
                </a>
            </div>
        </aside>

        <!-- AREA KONTEN UTAMA -->
        <div class="main-content">
            <header class="topbar">
                <div>
                    <h1 id="pageMainTitle" class="page-title">{% block page_title %}Dashboard{% endblock %}</h1>
                    <p id="currentDateDisplay" class="page-subtitle"></p>
                </div>

                <div class="topbar-actions">
                    <span id="networkStatusPill" class="status-pill status-online">
                        <span class="status-dot"></span>
                        <span id="networkStatusText">Online</span>
                    </span>
                    <button type="button" id="openQuickTxModalDesktop" class="btn btn-success open-quick-tx">
                        <i data-lucide="plus" style="width:16px;height:16px;"></i>
                        <span>Tambah transaksi</span>
                    </button>
                </div>
            </header>

            <main>
                {% block content %}{% endblock %}
            </main>
        </div>
    </div>

    <!-- NAVIGASI BAWAH MOBILE (5 TOMBOL) -->
    <nav class="mobile-bottom-nav">
        <a href="{{ url_for('dashboard') }}" class="bottom-nav-item {{ 'active' if active_page == 'dashboard' else '' }}">
            <i data-lucide="home"></i>
            <span>Dashboard</span>
        </a>
        <a href="{{ url_for('history') }}" class="bottom-nav-item {{ 'active' if active_page == 'history' else '' }}">
            <i data-lucide="list"></i>
            <span>History</span>
        </a>
        <button type="button" id="openQuickTxModalMobile" class="fab-center-btn open-quick-tx" aria-label="Tambah Transaksi">
            <i data-lucide="plus"></i>
        </button>
        <a href="{{ url_for('budget') }}" class="bottom-nav-item {{ 'active' if active_page == 'budget' else '' }}">
            <i data-lucide="pie-chart"></i>
            <span>Budget</span>
        </a>
        <button type="button" id="openMobileMenuDrawer" class="bottom-nav-item">
            <i data-lucide="grid"></i>
            <span>Menu</span>
        </button>
    </nav>

    <!-- DRAWER MENU MOBILE -->
    <div id="mobileMenuDrawer" class="modal-backdrop hidden" style="padding:24px;">
        <div class="modal-card" style="max-width:420px;max-height:calc(100vh - 48px);">
            <div class="modal-header">
                <h3 class="text-navy">Semua Menu</h3>
                <button type="button" id="closeMobileMenuDrawer" class="btn btn-outline-navy btn-sm">Tutup</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
                <a href="{{ url_for('income') }}" class="btn btn-outline-navy">Income</a>
                <a href="{{ url_for('expense') }}" class="btn btn-outline-navy">Expense</a>
                <a href="{{ url_for('savings') }}" class="btn btn-outline-navy">Savings</a>
                <a href="{{ url_for('report') }}" class="btn btn-outline-navy">Report</a>
                <a href="{{ url_for('wallet') }}" class="btn btn-outline-navy">Wallet</a>
                <a href="{{ url_for('profile') }}" class="btn btn-outline-navy">Profil</a>
                <a href="{{ url_for('settings') }}" class="btn btn-outline-navy" style="grid-column:span 2;">Pengaturan & PIN</a>
            </div>
        </div>
    </div>

    <!-- MODAL TAMBAH TRANSAKSI CEPAT (BERJARAK AMAN ATAS-BAWAH-KIRI-KANAN) -->
    <div id="quickTxModal" class="modal-backdrop hidden" style="padding:24px;">
        <div class="modal-card" style="max-width:440px;max-height:calc(100vh - 48px);margin:auto;">
            <div class="modal-header">
                <h3 class="text-navy">Tambah Transaksi</h3>
                <button type="button" id="closeQuickTxModal" class="btn btn-outline-navy btn-sm">✕</button>
            </div>

            <div class="tx-type-switch">
                <button type="button" class="tx-type-btn active" data-type="expense">Pengeluaran</button>
                <button type="button" class="tx-type-btn" data-type="income">Pemasukan</button>
            </div>

            <form id="quickTransactionForm">
                <input type="hidden" id="txTypeInput" value="expense">
                <input type="hidden" id="txCategoryInput" value="Makan">

                <div class="form-group">
                    <label for="txAmountInput">Nominal (Rp)</label>
                    <input type="text" id="txAmountInput" class="rupiah-input" inputmode="numeric" placeholder="Contoh: 50.000" required>
                </div>

                <div class="form-group">
                    <label>Kategori</label>
                    <div id="txCategoryGrid" class="cat-grid"></div>
                </div>

                <div class="form-group">
                    <label for="txWalletSelect">Dompet</label>
                    <select id="txWalletSelect" required></select>
                </div>

                <div class="form-group">
                    <label for="txDateInput">Tanggal</label>
                    <input type="date" id="txDateInput" required>
                </div>

                <div class="form-group">
                    <label for="txNoteInput">Deskripsi / Catatan</label>
                    <input type="text" id="txNoteInput" placeholder="Contoh: Makan siang">
                </div>

                <button type="submit" class="btn btn-success" style="width:100%;">Simpan Transaksi</button>
            </form>
        </div>
    </div>

    <!-- LAYAR KUNCI PIN 6 DIGIT -->
    <div id="pinLockOverlay" class="pin-overlay hidden" aria-hidden="true">
        <div class="pin-card">
            <i data-lucide="lock" style="width:32px;height:32px;margin-bottom:8px;"></i>
            <h3>Masukkan PIN Keamanan</h3>
            <p style="font-size:13px;color:#94A3B8;margin-top:4px;">Masukkan 6 digit PIN untuk membuka SMART FINANCE</p>
            <div id="pinDots" class="pin-dots">
                <span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <p id="pinErrorMsg" class="text-danger hidden" style="font-size:13px;margin-bottom:8px;">PIN salah, silakan coba lagi.</p>
            <div class="pin-keypad">
                <button type="button" data-num="1">1</button>
                <button type="button" data-num="2">2</button>
                <button type="button" data-num="3">3</button>
                <button type="button" data-num="4">4</button>
                <button type="button" data-num="5">5</button>
                <button type="button" data-num="6">6</button>
                <button type="button" data-num="7">7</button>
                <button type="button" data-num="8">8</button>
                <button type="button" data-num="9">9</button>
                <button type="button" id="pinClear">C</button>
                <button type="button" data-num="0">0</button>
                <button type="button" id="pinBackspace">⌫</button>
            </div>
        </div>
    </div>

    <!-- MODUL JAVASCRIPT -->
    <script src="{{ url_for('static', filename='js/db-local.js') }}?v=3"></script>
    <script src="{{ url_for('static', filename='js/sync.js') }}?v=3"></script>
    <script src="{{ url_for('static', filename='js/pin-lock.js') }}?v=3"></script>
    <script src="{{ url_for('static', filename='js/charts.js') }}?v=3"></script>
    <script src="{{ url_for('static', filename='js/app.js') }}?v=3"></script>
</body>
</html>
