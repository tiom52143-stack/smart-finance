/* =========================================================================
   SMART FINANCE - Main Application Controller
   Tahap 1: Pondasi + Tanggal Otomatis (Poin 1) + Tambah Transaksi (Poin 2)
   ========================================================================= */
(function (window) {
    'use strict';

    const EXPENSE_CATEGORIES = [
        { name: 'Makan', label: 'Makan', icon: 'utensils' },
        { name: 'Transport', label: 'Transport', icon: 'car' },
        { name: 'Tagihan', label: 'Tagihan', icon: 'file-text' },
        { name: 'Belanja', label: 'Belanja', icon: 'shopping-bag' },
        { name: 'Hiburan', label: 'Hiburan', icon: 'film' },
        { name: 'Kesehatan', label: 'Kesehatan', icon: 'heart-pulse' },
        { name: 'Pendidikan', label: 'Pendidikan', icon: 'graduation-cap' },
        { name: 'Lainnya', label: 'Lainnya', icon: 'more-horizontal' }
    ];

    const INCOME_CATEGORIES = [
        { name: 'Gaji', label: 'Gaji', icon: 'briefcase' },
        { name: 'Usaha', label: 'Usaha', icon: 'store' },
        { name: 'Bonus', label: 'Bonus', icon: 'award' },
        { name: 'Investasi', label: 'Investasi', icon: 'trending-up' },
        { name: 'Hadiah', label: 'Hadiah', icon: 'gift' },
        { name: 'Lainnya', label: 'Lainnya', icon: 'more-horizontal' }
    ];

    const ROUTE_TITLES = {
        '/': 'Dashboard',
        '/dashboard': 'Dashboard',
        '/income': 'Income',
        '/expense': 'Expense',
        '/savings': 'Savings',
        '/budget': 'Budget',
        '/history': 'History',
        '/report': 'Report',
        '/wallet': 'Wallet',
        '/profile': 'Profil',
        '/settings': 'Pengaturan'
    };

    // =========================================================================
    // UTILITAS FORMAT ANGKA, TANGGAL & IKON
    // =========================================================================
    function formatRupiah(amount) {
        const num = Math.round(Number(amount || 0));
        return 'Rp ' + num.toLocaleString('id-ID');
    }

    function parseRupiahDigits(rawValue) {
        const digits = String(rawValue || '').replace(/[^\d]/g, '');
        return digits ? Number(digits) : 0;
    }

    function formatThousandInput(inputEl) {
        if (!inputEl) return;
        const num = parseRupiahDigits(inputEl.value);
        inputEl.value = num > 0 ? num.toLocaleString('id-ID') : '';
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, ''');
    }

    function getTodayISO() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().split('T')[0];
    }

    function getCurrentMonthISO() {
        return getTodayISO().slice(0, 7);
    }

    function formatDateShort(dateStr) {
        if (!dateStr) return '-';
        try {
            const parts = String(dateStr).split('-');
            if (parts.length !== 3) return dateStr;
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        } catch (e) {
            return dateStr;
        }
    }

    function refreshIcons() {
        try {
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        } catch (err) {
            console.warn('[SmartFinance] Ikon Lucide belum siap:', err);
        }
    }

    // =========================================================================
    // POIN 1: TANGGAL OTOMATIS REAL-TIME & JUDUL HEADER SESUAI HALAMAN
    // =========================================================================
    function updateLiveHeaderDate() {
        const titleEl = document.getElementById('pageMainTitle');
        const currentPath = window.location.pathname;
        if (titleEl && ROUTE_TITLES[currentPath]) {
            titleEl.textContent = ROUTE_TITLES[currentPath];
        }

        const dateDisplay = document.getElementById('currentDateDisplay');
        if (dateDisplay) {
            const now = new Date();
            dateDisplay.textContent = now.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    }

    function initTopbarHeader() {
        updateLiveHeaderDate();
        // Perbarui otomatis setiap 1 menit (agar berganti tepat saat lewat tengah malam)
        setInterval(updateLiveHeaderDate, 60000);
        // Perbarui juga saat pengguna kembali membuka tab browser
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) updateLiveHeaderDate();
        });
    }

    // =========================================================================
    // SERVICE WORKER REGISTRATION
    // =========================================================================
    function initServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then((reg) => reg.update())
                .catch(() => {});
        }
    }

    // =========================================================================
    // SINKRONISASI DAFTAR DOMPET KE DROPDOWN
    // =========================================================================
    async function populateWalletDropdowns() {
        if (!window.SmartDB) return {};
        const wallets = await window.SmartDB.getAll(window.SmartDB.STORES.WALLETS, false);
        const walletMap = {};
        wallets.forEach((w) => {
            walletMap[w.uuid] = w.name;
        });

        ['txWalletSelect', 'editTxWallet', 'depositWalletSelect', 'transferFromSelect', 'transferToSelect'].forEach((id) => {
            const selectEl = document.getElementById(id);
            if (!selectEl) return;
            const prevValue = selectEl.value;
            selectEl.innerHTML = wallets
                .map((w) => `<option value="${escapeHtml(w.uuid)}">${escapeHtml(w.name)} (${formatRupiah(w.balance)})</option>`)
                .join('');
            if (prevValue && walletMap[prevValue]) {
                selectEl.value = prevValue;
            } else if (id === 'transferToSelect' && wallets.length > 1) {
                selectEl.value = wallets[1].uuid;
            }
        });

        ['incomeWalletFilter', 'expenseWalletFilter', 'historyWalletFilter', 'reportWalletFilter'].forEach((id) => {
            const selectEl = document.getElementById(id);
            if (!selectEl) return;
            const prevValue = selectEl.value || 'all';
            selectEl.innerHTML = '<option value="all">Semua Dompet</option>' +
                wallets.map((w) => `<option value="${escapeHtml(w.uuid)}">${escapeHtml(w.name)}</option>`).join('');
            selectEl.value = prevValue;
        });

        return walletMap;
    }

    // =========================================================================
    // POIN 2: MODAL TAMBAH TRANSAKSI CEPAT (DASHBOARD & GLOBAL)
    // =========================================================================
    function renderQuickTxCategories(type) {
        const grid = document.getElementById('txCategoryGrid');
        const catInput = document.getElementById('txCategoryInput');
        if (!grid || !catInput) return;

        const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        catInput.value = list[0].name;

        grid.innerHTML = list.map((item, index) => `
            <button type="button" class="cat-chip ${index === 0 ? 'active' : ''}" data-cat="${escapeHtml(item.name)}">
                <i data-lucide="${item.icon}"></i>
                <span>${escapeHtml(item.label)}</span>
            </button>
        `).join('');

        grid.querySelectorAll('.cat-chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                grid.querySelectorAll('.cat-chip').forEach((c) => c.classList.remove('active'));
                chip.classList.add('active');
                catInput.value = chip.getAttribute('data-cat');
            });
        });

        refreshIcons();
    }

    async function openQuickTxModal(presetType = 'expense') {
        const modal = document.getElementById('quickTxModal');
        const typeInput = document.getElementById('txTypeInput');
        const dateInput = document.getElementById('txDateInput');
        const amountInput = document.getElementById('txAmountInput');
        if (!modal) return;

        if (window.SmartDB) {
            await window.SmartDB.init();
            await populateWalletDropdowns();
        }

        const targetType = presetType === 'income' ? 'income' : 'expense';
        if (typeInput) typeInput.value = targetType;

        modal.querySelectorAll('.tx-type-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.getAttribute('data-type') === targetType);
        });

        renderQuickTxCategories(targetType);
        if (dateInput) {
            dateInput.value = getTodayISO();
        }

        modal.classList.remove('hidden');
        if (amountInput) {
            setTimeout(() => amountInput.focus(), 60);
        }
    }

    function closeQuickTxModal() {
        const modal = document.getElementById('quickTxModal');
        if (modal) modal.classList.add('hidden');
    }

    function initNavigationAndQuickTxModal() {
        // Delegasi klik global agar tombol Tambah Transaksi selalu merespons
        document.addEventListener('click', (event) => {
            const trigger = event.target.closest('#openQuickTxModalDesktop, #openQuickTxModalMobile, .open-quick-tx');
            if (trigger) {
                event.preventDefault();
                const preset = trigger.getAttribute('data-preset-type') || 'expense';
                openQuickTxModal(preset);
                return;
            }

            if (event.target.closest('#closeQuickTxModal') || event.target.id === 'quickTxModal') {
                closeQuickTxModal();
                return;
            }

            if (event.target.closest('#openMobileMenuDrawer')) {
                const drawer = document.getElementById('mobileMenuDrawer');
                if (drawer) drawer.classList.remove('hidden');
                return;
            }

            if (event.target.closest('#closeMobileMenuDrawer') || event.target.id === 'mobileMenuDrawer') {
                const drawer = document.getElementById('mobileMenuDrawer');
                if (drawer) drawer.classList.add('hidden');
            }
        });

        // Switch Pengeluaran / Pemasukan di dalam modal
        document.querySelectorAll('.tx-type-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const chosenType = btn.getAttribute('data-type') || 'expense';
                const typeInput = document.getElementById('txTypeInput');
                if (typeInput) typeInput.value = chosenType;
                document.querySelectorAll('.tx-type-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                renderQuickTxCategories(chosenType);
            });
        });

        // Format titik ribuan otomatis pada input nominal
        document.addEventListener('input', (event) => {
            if (event.target.classList && event.target.classList.contains('rupiah-input')) {
                formatThousandInput(event.target);
            }
        });

        // Submit Transaksi Baru
        const quickForm = document.getElementById('quickTransactionForm');
        if (quickForm) {
            quickForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (!window.SmartDB) {
                    alert('Penyimpanan lokal belum siap. Silakan muat ulang halaman.');
                    return;
                }

                const type = document.getElementById('txTypeInput').value;
                const amount = parseRupiahDigits(document.getElementById('txAmountInput').value);
                const category = document.getElementById('txCategoryInput').value;
                const walletUuid = document.getElementById('txWalletSelect').value;
                const txDate = document.getElementById('txDateInput').value || getTodayISO();
                const note = document.getElementById('txNoteInput').value.trim();

                if (amount <= 0) {
                    alert('Masukkan nominal transaksi lebih besar dari Rp 0.');
                    return;
                }

                await window.SmartDB.saveTransaction({
                    type,
                    amount,
                    category,
                    wallet_uuid: walletUuid,
                    transaction_date: txDate,
                    note
                });

                quickForm.reset();
                document.getElementById('txDateInput').value = getTodayISO();
                closeQuickTxModal();
            });
        }
    }

    // =========================================================================
    // RENDER DASHBOARD UTAMA
    // =========================================================================
    async function renderDashboardPage(walletMap) {
        if (!document.getElementById('kpiTotalBalance')) return;

        const [wallets, transactions, budgets, goals] = await Promise.all([
            window.SmartDB.getAll(window.SmartDB.STORES.WALLETS, false),
            window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false),
            window.SmartDB.getAll(window.SmartDB.STORES.BUDGETS, false),
            window.SmartDB.getAll(window.SmartDB.STORES.GOALS, false)
        ]);

        const currentMonth = getCurrentMonthISO();
        const monthName = new Date().toLocaleDateString('id-ID', { month: 'long' });

        const incMonthLbl = document.getElementById('kpiIncomeMonthLabel');
        const expMonthLbl = document.getElementById('kpiExpenseMonthLabel');
        if (incMonthLbl) incMonthLbl.textContent = `Pemasukan ${monthName}`;
        if (expMonthLbl) expMonthLbl.textContent = `Pengeluaran ${monthName}`;

        const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);
        document.getElementById('kpiTotalBalance').textContent = formatRupiah(totalBalance);
        const walletMeta = document.getElementById('kpiWalletCountMeta');
        if (walletMeta) walletMeta.textContent = `${wallets.length} dompet`;

        let monthIncome = 0;
        let monthExpense = 0;
        transactions.forEach((tx) => {
            if (tx.is_transfer) return;
            if (String(tx.transaction_date || '').slice(0, 7) === currentMonth) {
                if (tx.type === 'income') monthIncome += Number(tx.amount || 0);
                else if (tx.type === 'expense') monthExpense += Number(tx.amount || 0);
            }
        });

        document.getElementById('kpiMonthIncome').textContent = formatRupiah(monthIncome);
        document.getElementById('kpiMonthExpense').textContent = formatRupiah(monthExpense);

        const monthBudgets = budgets.filter((b) => b.month_year === currentMonth);
        const totalBudgetLimit = monthBudgets.reduce((sum, b) => sum + Number(b.limit_amount || 0), 0);
        const budgetPct = totalBudgetLimit > 0 ? Math.round((monthExpense / totalBudgetLimit) * 100) : 0;
        const expSubMeta = document.getElementById('kpiExpenseSubMeta');
        if (expSubMeta) expSubMeta.textContent = `${budgetPct}% dari anggaran`;

        const totalSaved = goals.reduce((sum, g) => sum + Number(g.current_amount || 0), 0);
        document.getElementById('kpiTotalSavings').textContent = formatRupiah(totalSaved);
        document.getElementById('kpiSavingsMeta').textContent = `${goals.length} target aktif`;

        const goalsListEl = document.getElementById('dashboardGoalsList');
        if (goalsListEl) {
            if (goals.length === 0) {
                goalsListEl.innerHTML = '<p class="text-muted" style="font-size:13px;">Belum ada target tabungan aktif.</p>';
            } else {
                goalsListEl.innerHTML = goals.slice(0, 3).map((g) => {
                    const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
                    return `
                        <div>
                            <div class="goal-mini-top">
                                <strong>${escapeHtml(g.title)}</strong>
                                <span class="text-success font-bold">${pct}%</span>
                            </div>
                            <div class="progress-track">
                                <div class="progress-fill bg-success" style="width:${pct}%;"></div>
                            </div>
                            <p class="card-subtext">${formatRupiah(g.current_amount)} dari ${formatRupiah(g.target_amount)}</p>
                        </div>
                    `;
                }).join('');
            }
        }

        const recentBody = document.getElementById('recentTransactionsBody');
        if (recentBody) {
            const sortedTx = [...transactions].sort((a, b) => {
                if (a.transaction_date === b.transaction_date) {
                    return String(b.updated_at).localeCompare(String(a.updated_at));
                }
                return String(b.transaction_date).localeCompare(String(a.transaction_date));
            });

            if (sortedTx.length === 0) {
                recentBody.innerHTML = '<tr><td colspan="5" class="text-muted">Belum ada catatan transaksi.</td></tr>';
            } else {
                recentBody.innerHTML = sortedTx.slice(0, 5).map((tx) => {
                    const isInc = tx.type === 'income';
                    const sign = isInc ? '+' : '-';
                    const cls = isInc ? 'text-success' : 'text-danger';
                    const wName = walletMap[tx.wallet_uuid] || 'Dompet';
                    const desc = tx.note ? escapeHtml(tx.note) : escapeHtml(tx.category);
                    return `
                        <tr>
                            <td class="text-muted">${formatDateShort(tx.transaction_date)}</td>
                            <td><strong>${desc}</strong></td>
                            <td class="text-muted">${escapeHtml(tx.category)}</td>
                            <td class="text-muted">${escapeHtml(wName)}</td>
                            <td class="text-right font-bold ${cls}">${sign}${formatRupiah(tx.amount)}</td>
                        </tr>
                    `;
                }).join('');
            }
        }
    }

    async function refreshAllViews() {
        if (!window.SmartDB) return;
        try {
            await window.SmartDB.init();
            const walletMap = await populateWalletDropdowns();
            await renderDashboardPage(walletMap);
            if (window.SmartCharts && typeof window.SmartCharts.renderAll === 'function') {
                await window.SmartCharts.renderAll();
            }
            refreshIcons();
        } catch (err) {
            console.error('[SmartFinance] Gagal memuat tampilan:', err);
        }
    }

    // =========================================================================
    // INISIALISASI SAAT HALAMAN SIAP
    // =========================================================================
    document.addEventListener('DOMContentLoaded', async () => {
        refreshIcons();
        initTopbarHeader();
        initServiceWorker();
        initNavigationAndQuickTxModal();
        await refreshAllViews();
    });

    window.addEventListener('smartfinance:data-changed', refreshAllViews);

    window.SmartApp = {
        refreshAllViews,
        openQuickTxModal,
        formatRupiah,
        parseRupiahDigits
    };
})(window);
