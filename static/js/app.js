/* =========================================================================
   SMART FINANCE - Main Application UI & Business Logic Controller
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

    let deferredInstallPrompt = null;

    function formatRupiah(amount) {
        const num = Math.round(Number(amount || 0));
        return 'Rp ' + num.toLocaleString('id-ID');
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
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    // =========================================================================
    // HEADER TANGGAL & JUDUL HALAMAN
    // =========================================================================
    function initTopbarHeader() {
        const titleEl = document.getElementById('pageMainTitle');
        if (titleEl && ROUTE_TITLES[window.location.pathname]) {
            titleEl.textContent = ROUTE_TITLES[window.location.pathname];
        }

        const dateDisplay = document.getElementById('currentDateDisplay');
        if (dateDisplay) {
            dateDisplay.textContent = new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }
    }

    // =========================================================================
    // PWA SERVICE WORKER
    // =========================================================================
    function initPWA() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js').catch(() => {});
        }

        const settingsInstallBtn = document.getElementById('settingsInstallPwaBtn');
        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            deferredInstallPrompt = event;
        });

        if (settingsInstallBtn) {
            settingsInstallBtn.addEventListener('click', async () => {
                if (!deferredInstallPrompt) {
                    alert('Buka menu browser (⋮ atau Share) lalu pilih "Tambahkan ke Layar Utama" / "Install App".');
                    return;
                }
                deferredInstallPrompt.prompt();
                await deferredInstallPrompt.userChoice;
                deferredInstallPrompt = null;
            });
        }
    }

    // =========================================================================
    // SINKRONISASI DROPDOWN DOMPET
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
    // MODAL TAMBAH TRANSAKSI CEPAT
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

    function openQuickTxModal(presetType = 'expense') {
        const modal = document.getElementById('quickTxModal');
        const typeInput = document.getElementById('txTypeInput');
        const dateInput = document.getElementById('txDateInput');
        const amountInput = document.getElementById('txAmountInput');
        if (!modal) return;

        const targetType = presetType === 'income' ? 'income' : 'expense';
        if (typeInput) typeInput.value = targetType;

        modal.querySelectorAll('.tx-type-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.getAttribute('data-type') === targetType);
        });

        renderQuickTxCategories(targetType);
        if (dateInput && !dateInput.value) {
            dateInput.value = getTodayISO();
        }

        modal.classList.remove('hidden');
        if (amountInput) setTimeout(() => amountInput.focus(), 60);
    }

    function closeQuickTxModal() {
        const modal = document.getElementById('quickTxModal');
        if (modal) modal.classList.add('hidden');
    }

    function initNavigationAndQuickTxModal() {
        const openDrawerBtn = document.getElementById('openMobileMenuDrawer');
        const closeDrawerBtn = document.getElementById('closeMobileMenuDrawer');
        const drawerBackdrop = document.getElementById('mobileMenuDrawer');

        if (openDrawerBtn && drawerBackdrop) openDrawerBtn.addEventListener('click', () => drawerBackdrop.classList.remove('hidden'));
        if (closeDrawerBtn && drawerBackdrop) closeDrawerBtn.addEventListener('click', () => drawerBackdrop.classList.add('hidden'));
        if (drawerBackdrop) {
            drawerBackdrop.addEventListener('click', (e) => {
                if (e.target === drawerBackdrop) drawerBackdrop.classList.add('hidden');
            });
        }

        const mobileFab = document.getElementById('openQuickTxModalMobile');
        const desktopBtn = document.getElementById('openQuickTxModalDesktop');
        const closeModalBtn = document.getElementById('closeQuickTxModal');
        const modalBackdrop = document.getElementById('quickTxModal');

        if (mobileFab) mobileFab.addEventListener('click', () => openQuickTxModal('expense'));
        if (desktopBtn) desktopBtn.addEventListener('click', () => openQuickTxModal('expense'));
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeQuickTxModal);
        if (modalBackdrop) {
            modalBackdrop.addEventListener('click', (e) => {
                if (e.target === modalBackdrop) closeQuickTxModal();
            });
        }

        document.querySelectorAll('.open-quick-tx').forEach((btn) => {
            btn.addEventListener('click', () => {
                openQuickTxModal(btn.getAttribute('data-preset-type') || 'expense');
            });
        });

        document.querySelectorAll('.tx-type-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const chosenType = btn.getAttribute('data-type') || 'expense';
                document.getElementById('txTypeInput').value = chosenType;
                document.querySelectorAll('.tx-type-btn').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                renderQuickTxCategories(chosenType);
            });
        });

        const quickForm = document.getElementById('quickTransactionForm');
        if (quickForm) {
            quickForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (!window.SmartDB) return;

                const type = document.getElementById('txTypeInput').value;
                const amount = Number(document.getElementById('txAmountInput').value);
                const category = document.getElementById('txCategoryInput').value;
                const walletUuid = document.getElementById('txWalletSelect').value;
                const txDate = document.getElementById('txDateInput').value || getTodayISO();
                const note = document.getElementById('txNoteInput').value;

                if (amount <= 0) {
                    alert('Nominal transaksi harus lebih besar dari Rp 0.');
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
    // HALAMAN 1: DASHBOARD (SESUAI DESAIN TARGET)
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

        // Label bulan pada kartu pemasukan & pengeluaran
        const incMonthLbl = document.getElementById('kpiIncomeMonthLabel');
        const expMonthLbl = document.getElementById('kpiExpenseMonthLabel');
        if (incMonthLbl) incMonthLbl.textContent = `Pemasukan ${monthName}`;
        if (expMonthLbl) expMonthLbl.textContent = `Pengeluaran ${monthName}`;

        // 1. Total Saldo
        const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);
        document.getElementById('kpiTotalBalance').textContent = formatRupiah(totalBalance);
        const walletMeta = document.getElementById('kpiWalletCountMeta');
        if (walletMeta) walletMeta.textContent = `${wallets.length} dompet`;

        // 2. Pemasukan & Pengeluaran Bulan Ini
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

        // 3. Total Tabungan
        const totalSaved = goals.reduce((sum, g) => sum + Number(g.current_amount || 0), 0);
        document.getElementById('kpiTotalSavings').textContent = formatRupiah(totalSaved);
        document.getElementById('kpiSavingsMeta').textContent = `${goals.length} target aktif`;

        // 4. Target Tabungan (Maksimal 3)
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

        // 5. Tabel Transaksi Terbaru (5 Kolom: Tanggal, Deskripsi, Kategori, Dompet, Nominal)
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

    // =========================================================================
    // HALAMAN SUB-MENU (INCOME, EXPENSE, HISTORY, SAVINGS, BUDGET, REPORT, WALLET, SETTINGS)
    // =========================================================================
    function createTransactionRowHTML(tx, walletMap, showEditButton = false) {
        const isInc = tx.type === 'income';
        const sign = isInc ? '+' : '-';
        const cls = isInc ? 'text-success' : 'text-danger';
        const wName = walletMap[tx.wallet_uuid] || 'Dompet';
        const noteText = tx.note ? escapeHtml(tx.note) : escapeHtml(tx.category);
        const editBtn = showEditButton
            ? `<button type="button" class="btn btn-outline-navy btn-sm edit-tx-trigger" data-uuid="${escapeHtml(tx.uuid)}" style="margin-left:10px;">Ubah</button>`
            : '';

        return `
            <div class="tx-list-item">
                <div>
                    <div class="font-bold">${noteText}</div>
                    <div class="text-muted" style="font-size:12.5px;">
                        ${escapeHtml(tx.category)} • ${escapeHtml(wName)} • ${formatDateShort(tx.transaction_date)}
                    </div>
                </div>
                <div style="display:flex;align-items:center;">
                    <span class="font-bold ${cls}">${sign}${formatRupiah(tx.amount)}</span>
                    ${editBtn}
                </div>
            </div>
        `;
    }

    async function renderSingleTypePage(txType, prefix, walletMap) {
        const listEl = document.getElementById(`${prefix}ListContainer`);
        if (!listEl) return;

        const searchInput = document.getElementById(`${prefix}SearchInput`);
        const catFilter = document.getElementById(`${prefix}CategoryFilter`);
        const walletFilter = document.getElementById(`${prefix}WalletFilter`);
        const monthFilter = document.getElementById(`${prefix}MonthFilter`);

        if (monthFilter && !monthFilter.dataset.initialized) {
            monthFilter.value = getCurrentMonthISO();
            monthFilter.dataset.initialized = 'true';
        }

        const allTx = await window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false);
        const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
        const selectedCat = catFilter ? catFilter.value : 'all';
        const selectedWallet = walletFilter ? walletFilter.value : 'all';
        const selectedMonth = monthFilter ? monthFilter.value : '';

        const filtered = allTx
            .filter((tx) => tx.type === txType && !tx.is_transfer)
            .filter((tx) => {
                if (selectedCat !== 'all' && tx.category !== selectedCat) return false;
                if (selectedWallet !== 'all' && tx.wallet_uuid !== selectedWallet) return false;
                if (selectedMonth && String(tx.transaction_date || '').slice(0, 7) !== selectedMonth) return false;
                if (query && !`${tx.category} ${tx.note}`.toLowerCase().includes(query)) return false;
                return true;
            })
            .sort((a, b) => String(b.transaction_date).localeCompare(String(a.transaction_date)));

        const totalNominal = filtered.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        const totalEl = document.getElementById(`${prefix}TotalMonth`);
        const countEl = document.getElementById(`${prefix}CountMonth`);
        const resultCountEl = document.getElementById(`${prefix}ResultCount`);

        if (totalEl) totalEl.textContent = formatRupiah(totalNominal);
        if (countEl) countEl.textContent = `${filtered.length} Transaksi`;
        if (resultCountEl) resultCountEl.textContent = `${filtered.length} data ditampilkan`;

        listEl.innerHTML = filtered.length === 0
            ? `<p class="text-muted">Belum ada catatan ${txType === 'income' ? 'pemasukan' : 'pengeluaran'}.</p>`
            : filtered.map((tx) => createTransactionRowHTML(tx, walletMap, false)).join('');
    }

    function bindSingleTypeFilters(txType, prefix) {
        [`${prefix}SearchInput`, `${prefix}CategoryFilter`, `${prefix}WalletFilter`, `${prefix}MonthFilter`].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener(el.type === 'search' ? 'input' : 'change', async () => {
                const walletMap = await populateWalletDropdowns();
                await renderSingleTypePage(txType, prefix, walletMap);
            });
        });
    }

    async function renderHistoryPage(walletMap) {
        const listEl = document.getElementById('historyListContainer');
        if (!listEl) return;

        const searchVal = (document.getElementById('historySearchInput').value || '').toLowerCase().trim();
        const typeVal = document.getElementById('historyTypeFilter').value;
        const catVal = document.getElementById('historyCategoryFilter').value;
        const walletVal = document.getElementById('historyWalletFilter').value;
        const monthVal = document.getElementById('historyMonthFilter').value;

        const allTx = await window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false);
        const filtered = allTx
            .filter((tx) => {
                if (typeVal !== 'all' && tx.type !== typeVal) return false;
                if (catVal !== 'all' && tx.category !== catVal) return false;
                if (walletVal !== 'all' && tx.wallet_uuid !== walletVal) return false;
                if (monthVal && String(tx.transaction_date || '').slice(0, 7) !== monthVal) return false;
                if (searchVal && !`${tx.category} ${tx.note}`.toLowerCase().includes(searchVal)) return false;
                return true;
            })
            .sort((a, b) => String(b.transaction_date).localeCompare(String(a.transaction_date)));

        let totalInc = 0;
        let totalExp = 0;
        filtered.forEach((tx) => {
            if (tx.is_transfer) return;
            if (tx.type === 'income') totalInc += Number(tx.amount || 0);
            else totalExp += Number(tx.amount || 0);
        });

        document.getElementById('historyTotalIncome').textContent = formatRupiah(totalInc);
        document.getElementById('historyTotalExpense').textContent = formatRupiah(totalExp);
        document.getElementById('historyResultCount').textContent = `${filtered.length} transaksi ditampilkan`;

        if (filtered.length === 0) {
            listEl.innerHTML = '<p class="text-muted">Belum ada riwayat transaksi.</p>';
            return;
        }

        listEl.innerHTML = filtered.map((tx) => createTransactionRowHTML(tx, walletMap, true)).join('');
        listEl.querySelectorAll('.edit-tx-trigger').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const tx = await window.SmartDB.getById(window.SmartDB.STORES.TRANSACTIONS, btn.getAttribute('data-uuid'));
                if (!tx) return;
                document.getElementById('editTxUuid').value = tx.uuid;
                document.getElementById('editTxType').value = tx.type;
                document.getElementById('editTxAmount').value = tx.amount;
                document.getElementById('editTxCategory').value = tx.category;
                document.getElementById('editTxWallet').value = tx.wallet_uuid;
                document.getElementById('editTxDate').value = tx.transaction_date;
                document.getElementById('editTxNote').value = tx.note || '';
                document.getElementById('editTxModal').classList.remove('hidden');
            });
        });
    }

    function initHistoryPageBindings() {
        if (!document.getElementById('historyListContainer')) return;

        ['historySearchInput', 'historyTypeFilter', 'historyCategoryFilter', 'historyWalletFilter', 'historyMonthFilter'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener(el.type === 'search' ? 'input' : 'change', async () => {
                const walletMap = await populateWalletDropdowns();
                await renderHistoryPage(walletMap);
            });
        });

        const resetBtn = document.getElementById('resetHistoryFilterBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', async () => {
                document.getElementById('historySearchInput').value = '';
                document.getElementById('historyTypeFilter').value = 'all';
                document.getElementById('historyCategoryFilter').value = 'all';
                document.getElementById('historyWalletFilter').value = 'all';
                document.getElementById('historyMonthFilter').value = '';
                const walletMap = await populateWalletDropdowns();
                await renderHistoryPage(walletMap);
            });
        }

        const editModal = document.getElementById('editTxModal');
        const closeEditBtn = document.getElementById('closeEditTxModal');
        if (closeEditBtn && editModal) closeEditBtn.addEventListener('click', () => editModal.classList.add('hidden'));

        const editForm = document.getElementById('editTxForm');
        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await window.SmartDB.saveTransaction({
                    uuid: document.getElementById('editTxUuid').value,
                    type: document.getElementById('editTxType').value,
                    amount: Number(document.getElementById('editTxAmount').value),
                    category: document.getElementById('editTxCategory').value,
                    wallet_uuid: document.getElementById('editTxWallet').value,
                    transaction_date: document.getElementById('editTxDate').value,
                    note: document.getElementById('editTxNote').value
                });
                editModal.classList.add('hidden');
            });
        }

        const deleteBtn = document.getElementById('deleteTxBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                if (confirm('Hapus transaksi ini?')) {
                    await window.SmartDB.deleteTransaction(document.getElementById('editTxUuid').value);
                    editModal.classList.add('hidden');
                }
            });
        }
    }

    async function renderSavingsPage() {
        const gridEl = document.getElementById('savingsGoalsGrid');
        if (!gridEl) return;

        const goals = await window.SmartDB.getAll(window.SmartDB.STORES.GOALS, false);
        const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount || 0), 0);
        const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount || 0), 0);
        const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

        document.getElementById('savingsTotalSaved').textContent = formatRupiah(totalSaved);
        document.getElementById('savingsOverallMeta').textContent = `${overallPct}% dari keseluruhan target (${formatRupiah(totalTarget)})`;
        document.getElementById('savingsActiveCount').textContent = `${goals.length} Target`;
        document.getElementById('goalsListCount').textContent = `${goals.length} target`;

        if (goals.length === 0) {
            gridEl.innerHTML = '<article class="card"><p class="text-muted">Belum ada target tabungan.</p></article>';
            return;
        }

        gridEl.innerHTML = goals.map((g) => {
            const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
            return `
                <article class="card">
                    <div class="goal-card-top">
                        <div>
                            <h3 style="font-size:15.5px;font-weight:700;">${escapeHtml(g.title)}</h3>
                            <span class="text-muted" style="font-size:12px;">Target: ${formatDateShort(g.deadline)}</span>
                        </div>
                        <span class="text-success font-bold">${pct}%</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill bg-success" style="width:${pct}%;"></div>
                    </div>
                    <div class="goal-card-footer">
                        <span><strong>${formatRupiah(g.current_amount)}</strong> / ${formatRupiah(g.target_amount)}</span>
                        <div style="display:flex;gap:6px;">
                            <button type="button" class="btn btn-outline-danger btn-sm delete-goal-btn" data-uuid="${escapeHtml(g.uuid)}">Hapus</button>
                            <button type="button" class="btn btn-success btn-sm deposit-goal-btn" data-uuid="${escapeHtml(g.uuid)}" data-title="${escapeHtml(g.title)}">+ Setor</button>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        gridEl.querySelectorAll('.deposit-goal-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                document.getElementById('depositGoalUuid').value = btn.getAttribute('data-uuid');
                document.getElementById('depositGoalNameLabel').textContent = btn.getAttribute('data-title');
                document.getElementById('depositGoalModal').classList.remove('hidden');
            });
        });

        gridEl.querySelectorAll('.delete-goal-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (confirm('Hapus target tabungan ini?')) {
                    await window.SmartDB.deleteGoal(btn.getAttribute('data-uuid'));
                }
            });
        });
    }

    function initSavingsPageBindings() {
        if (!document.getElementById('savingsGoalsGrid')) return;

        const calcBtn = document.getElementById('calculateSavingsBtn');
        if (calcBtn) {
            calcBtn.addEventListener('click', () => {
                const target = Number(document.getElementById('calcTargetAmount').value);
                const months = Number(document.getElementById('calcMonths').value);
                if (target <= 0 || months <= 0) return;
                document.getElementById('calcMonthlyOutput').textContent = `${formatRupiah(target / months)} / bulan`;
                document.getElementById('calcDailyOutput').textContent = `Sekitar ${formatRupiah(target / months / 30)} / hari selama ${months} bulan`;
                document.getElementById('calcResultBox').classList.remove('hidden');
            });
        }

        const newGoalModal = document.getElementById('newGoalModal');
        const openNewGoal = document.getElementById('openNewGoalModal');
        const closeNewGoal = document.getElementById('closeNewGoalModal');
        if (openNewGoal) {
            openNewGoal.addEventListener('click', () => {
                const next = new Date();
                next.setMonth(next.getMonth() + 6);
                document.getElementById('goalDeadlineInput').value = next.toISOString().split('T')[0];
                newGoalModal.classList.remove('hidden');
            });
        }
        if (closeNewGoal) closeNewGoal.addEventListener('click', () => newGoalModal.classList.add('hidden'));

        const newGoalForm = document.getElementById('newGoalForm');
        if (newGoalForm) {
            newGoalForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await window.SmartDB.saveGoal({
                    title: document.getElementById('goalTitleInput').value,
                    target_amount: Number(document.getElementById('goalTargetInput').value),
                    current_amount: Number(document.getElementById('goalInitialInput').value || 0),
                    deadline: document.getElementById('goalDeadlineInput').value
                });
                newGoalForm.reset();
                newGoalModal.classList.add('hidden');
            });
        }

        const depositModal = document.getElementById('depositGoalModal');
        const closeDeposit = document.getElementById('closeDepositGoalModal');
        if (closeDeposit) closeDeposit.addEventListener('click', () => depositModal.classList.add('hidden'));

        const depositForm = document.getElementById('depositGoalForm');
        if (depositForm) {
            depositForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await window.SmartDB.depositToGoal(
                    document.getElementById('depositGoalUuid').value,
                    Number(document.getElementById('depositAmountInput').value),
                    document.getElementById('depositWalletSelect').value
                );
                depositForm.reset();
                depositModal.classList.add('hidden');
            });
        }
    }

    async function renderBudgetPage() {
        const container = document.getElementById('budgetListContainer');
        if (!container) return;

        const monthSelector = document.getElementById('budgetMonthSelector');
        if (monthSelector && !monthSelector.value) monthSelector.value = getCurrentMonthISO();
        const selectedMonth = monthSelector ? monthSelector.value : getCurrentMonthISO();

        const [budgets, transactions] = await Promise.all([
            window.SmartDB.getAll(window.SmartDB.STORES.BUDGETS, false),
            window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false)
        ]);

        const monthBudgets = budgets.filter((b) => b.month_year === selectedMonth);
        const spentByCat = {};
        transactions.forEach((tx) => {
            if (tx.type === 'expense' && !tx.is_transfer && String(tx.transaction_date || '').slice(0, 7) === selectedMonth) {
                spentByCat[tx.category] = (spentByCat[tx.category] || 0) + Number(tx.amount || 0);
            }
        });

        let totalLimit = 0;
        let totalSpent = 0;
        monthBudgets.forEach((b) => {
            totalLimit += Number(b.limit_amount || 0);
            totalSpent += Number(spentByCat[b.category] || 0);
        });

        const overallPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
        document.getElementById('budgetTotalLimit').textContent = formatRupiah(totalLimit);
        document.getElementById('budgetRemainingMeta').textContent = `Sisa anggaran: ${formatRupiah(Math.max(0, totalLimit - totalSpent))}`;
        document.getElementById('budgetTotalSpent').textContent = formatRupiah(totalSpent);
        document.getElementById('budgetUsagePctLabel').textContent = `${overallPct}%`;
        document.getElementById('budgetCategoryCount').textContent = `${monthBudgets.length} kategori`;

        const overallBar = document.getElementById('budgetOverallProgressBar');
        if (overallBar) {
            overallBar.style.width = `${Math.min(100, overallPct)}%`;
            overallBar.className = 'progress-fill ' + (overallPct >= 100 ? 'bg-danger' : (overallPct >= 80 ? 'bg-warning' : 'bg-success'));
        }

        if (monthBudgets.length === 0) {
            container.innerHTML = '<article class="card"><p class="text-muted">Belum ada batas anggaran diatur untuk bulan ini.</p></article>';
            return;
        }

        container.innerHTML = monthBudgets.map((b) => {
            const spent = Number(spentByCat[b.category] || 0);
            const limit = Number(b.limit_amount || 0);
            const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            const barClass = pct >= 100 ? 'bg-danger' : (pct >= 80 ? 'bg-warning' : 'bg-success');
            return `
                <article class="card">
                    <div class="budget-item-top">
                        <div>
                            <strong>${escapeHtml(b.category)}</strong>
                            <span class="text-muted" style="font-size:12.5px;display:block;">Terpakai ${formatRupiah(spent)} dari ${formatRupiah(limit)}</span>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <strong>${pct}%</strong>
                            <button type="button" class="btn btn-outline-danger btn-sm delete-budget-btn" data-uuid="${escapeHtml(b.uuid)}">Hapus</button>
                        </div>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill ${barClass}" style="width:${Math.min(100, pct)}%;"></div>
                    </div>
                </article>
            `;
        }).join('');

        container.querySelectorAll('.delete-budget-btn').forEach((btn) => {
            btn.addEventListener('click', async () => {
                if (confirm('Hapus anggaran ini?')) {
                    await window.SmartDB.deleteBudget(btn.getAttribute('data-uuid'));
                }
            });
        });
    }

    function initBudgetPageBindings() {
        if (!document.getElementById('budgetListContainer')) return;

        const monthSelector = document.getElementById('budgetMonthSelector');
        if (monthSelector) {
            monthSelector.value = getCurrentMonthISO();
            monthSelector.addEventListener('change', renderBudgetPage);
        }

        const modal = document.getElementById('newBudgetModal');
        const openBtn = document.getElementById('openNewBudgetModal');
        const closeBtn = document.getElementById('closeNewBudgetModal');
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                document.getElementById('budgetMonthInput').value = monthSelector ? monthSelector.value : getCurrentMonthISO();
                modal.classList.remove('hidden');
            });
        }
        if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

        const form = document.getElementById('newBudgetForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await window.SmartDB.saveBudget({
                    category: document.getElementById('budgetCategoryInput').value,
                    limit_amount: Number(document.getElementById('budgetLimitInput').value),
                    month_year: document.getElementById('budgetMonthInput').value
                });
                form.reset();
                modal.classList.add('hidden');
            });
        }
    }

    async function renderReportPage() {
        const tableBody = document.getElementById('reportCategoryTableBody');
        if (!tableBody) return;

        const monthInput = document.getElementById('reportMonthFilter');
        const walletInput = document.getElementById('reportWalletFilter');
        if (monthInput && !monthInput.value) monthInput.value = getCurrentMonthISO();

        const activeMonth = monthInput ? monthInput.value : getCurrentMonthISO();
        const activeWallet = walletInput ? walletInput.value : 'all';

        const allTx = await window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false);
        const filtered = allTx.filter((tx) => {
            if (tx.is_transfer) return false;
            if (activeMonth && String(tx.transaction_date || '').slice(0, 7) !== activeMonth) return false;
            if (activeWallet !== 'all' && tx.wallet_uuid !== activeWallet) return false;
            return true;
        });

        let totalIncome = 0;
        let totalExpense = 0;
        const grouped = {};

        filtered.forEach((tx) => {
            const amt = Number(tx.amount || 0);
            if (tx.type === 'income') totalIncome += amt;
            else totalExpense += amt;

            const key = `${tx.type}__${tx.category}`;
            if (!grouped[key]) grouped[key] = { category: tx.category, type: tx.type, count: 0, total: 0 };
            grouped[key].count += 1;
            grouped[key].total += amt;
        });

        const netCashflow = totalIncome - totalExpense;
        const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netCashflow / totalIncome) * 100)) : 0;

        document.getElementById('reportTotalIncome').textContent = formatRupiah(totalIncome);
        document.getElementById('reportTotalExpense').textContent = formatRupiah(totalExpense);
        document.getElementById('reportNetCashflow').textContent = (netCashflow >= 0 ? '+' : '-') + formatRupiah(Math.abs(netCashflow));
        document.getElementById('reportSavingsRateMeta').textContent = `Rasio tabungan: ${savingsRate}%`;

        const rows = Object.values(grouped).sort((a, b) => b.total - a.total);
        document.getElementById('reportCategorySummaryCount').textContent = `${rows.length} kategori tercatat`;

        if (rows.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-muted">Belum ada data pada periode ini.</td></tr>';
            return;
        }

        tableBody.innerHTML = rows.map((row) => {
            const isInc = row.type === 'income';
            const base = isInc ? totalIncome : totalExpense;
            const share = base > 0 ? Math.round((row.total / base) * 100) : 0;
            return `
                <tr>
                    <td><strong>${escapeHtml(row.category)}</strong></td>
                    <td><span class="${isInc ? 'text-success' : 'text-danger'} font-semibold">${isInc ? 'Pemasukan' : 'Pengeluaran'}</span></td>
                    <td>${row.count}x</td>
                    <td class="text-right font-bold">${formatRupiah(row.total)}</td>
                    <td class="text-right">${share}%</td>
                </tr>
            `;
        }).join('');
    }

    function initReportPageBindings() {
        if (!document.getElementById('reportCategoryTableBody')) return;

        const applyBtn = document.getElementById('applyReportFilterBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', async () => {
                await renderReportPage();
                if (window.SmartCharts) await window.SmartCharts.renderReportCharts();
            });
        }

        const excelBtn = document.getElementById('exportExcelBtn');
        if (excelBtn) {
            excelBtn.addEventListener('click', async () => {
                const walletMap = await populateWalletDropdowns();
                const monthVal = document.getElementById('reportMonthFilter').value;
                const allTx = await window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false);
                const lines = ['Tanggal,Jenis,Kategori,Dompet,Nominal,Catatan'];
                allTx.filter((tx) => !monthVal || String(tx.transaction_date).startsWith(monthVal)).forEach((tx) => {
                    lines.push([
                        tx.transaction_date,
                        tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
                        `"${tx.category}"`,
                        `"${walletMap[tx.wallet_uuid] || 'Dompet'}"`,
                        tx.amount,
                        `"${tx.note || ''}"`
                    ].join(','));
                });
                const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Laporan-SmartFinance-${monthVal || 'Semua'}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        const pdfBtn = document.getElementById('exportPdfBtn');
        if (pdfBtn) pdfBtn.addEventListener('click', () => window.print());
    }

    async function renderWalletPage() {
        const gridEl = document.getElementById('walletsGridContainer');
        if (!gridEl) return;

        const wallets = await window.SmartDB.getAll(window.SmartDB.STORES.WALLETS, false);
        const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);

        document.getElementById('walletTotalBalance').textContent = formatRupiah(totalBalance);
        document.getElementById('walletActiveCount').textContent = `${wallets.length} Dompet`;
        document.getElementById('walletListCount').textContent = `${wallets.length} dompet terdaftar`;

        const typeMeta = {
            cash: { label: 'Tunai', icon: 'banknote' },
            bank: { label: 'Bank', icon: 'landmark' },
            ewallet: { label: 'E-Wallet', icon: 'smartphone' }
        };

        gridEl.innerHTML = wallets.map((w) => {
            const meta = typeMeta[w.type] || typeMeta.cash;
            return `
                <article class="card">
                    <div class="wallet-card-header">
                        <i data-lucide="${meta.icon}"></i>
                        <span class="wallet-badge">${meta.label}</span>
                    </div>
                    <span class="kpi-label">${escapeHtml(w.name)}</span>
                    <div class="wallet-balance">${formatRupiah(w.balance)}</div>
                </article>
            `;
        }).join('');

        refreshIcons();
    }

    function initWalletPageBindings() {
        if (!document.getElementById('walletsGridContainer')) return;

        const newWalletModal = document.getElementById('newWalletModal');
        const openWalletBtn = document.getElementById('openNewWalletModal');
        const closeWalletBtn = document.getElementById('closeNewWalletModal');
        if (openWalletBtn) openWalletBtn.addEventListener('click', () => newWalletModal.classList.remove('hidden'));
        if (closeWalletBtn) closeWalletBtn.addEventListener('click', () => newWalletModal.classList.add('hidden'));

        const newWalletForm = document.getElementById('newWalletForm');
        if (newWalletForm) {
            newWalletForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await window.SmartDB.saveWallet({
                    name: document.getElementById('walletNameInput').value,
                    type: document.getElementById('walletTypeInput').value,
                    balance: Number(document.getElementById('walletBalanceInput').value || 0)
                });
                newWalletForm.reset();
                newWalletModal.classList.add('hidden');
            });
        }

        const transferModal = document.getElementById('transferWalletModal');
        const openTransferBtn = document.getElementById('openTransferModal');
        const closeTransferBtn = document.getElementById('closeTransferModal');
        if (openTransferBtn) openTransferBtn.addEventListener('click', () => transferModal.classList.remove('hidden'));
        if (closeTransferBtn) closeTransferBtn.addEventListener('click', () => transferModal.classList.add('hidden'));

        const transferForm = document.getElementById('transferWalletForm');
        if (transferForm) {
            transferForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    await window.SmartDB.transferBetweenWallets(
                        document.getElementById('transferFromSelect').value,
                        document.getElementById('transferToSelect').value,
                        Number(document.getElementById('transferAmountInput').value),
                        document.getElementById('transferNoteInput').value
                    );
                    transferForm.reset();
                    transferModal.classList.add('hidden');
                } catch (err) {
                    alert(err.message);
                }
            });
        }
    }

    function initProfileAndSettingsBindings() {
        const profileForm = document.getElementById('updateProfileForm');
        if (profileForm) {
            const nameInput = document.getElementById('profileNameInput');
            const displayNameEl = document.getElementById('profileDisplayName');
            const storedName = window.localStorage.getItem('sf_user_name');
            if (storedName && nameInput) {
                nameInput.value = storedName;
                if (displayNameEl) displayNameEl.textContent = storedName;
            }
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const newName = nameInput.value.trim();
                window.localStorage.setItem('sf_user_name', newName);
                if (displayNameEl) displayNameEl.textContent = newName;
                alert('Nama profil berhasil disimpan!');
            });
        }

        const exportJsonBtn = document.getElementById('exportJsonBackupBtn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', async () => {
                const backup = await window.SmartDB.exportFullBackup();
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `SmartFinance-Backup-${getTodayISO()}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        const importJsonInput = document.getElementById('importJsonBackupInput');
        if (importJsonInput) {
            importJsonInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const parsed = JSON.parse(await file.text());
                    await window.SmartDB.importFullBackup(parsed);
                    alert('Data cadangan JSON berhasil dipulihkan!');
                } catch (err) {
                    alert('Gagal membaca berkas: ' + err.message);
                }
                importJsonInput.value = '';
            });
        }

        const resetLocalBtn = document.getElementById('resetLocalDataBtn');
        if (resetLocalBtn) {
            resetLocalBtn.addEventListener('click', async () => {
                if (confirm('Hapus seluruh catatan di perangkat ini dan kembalikan ke Rp 0?')) {
                    await window.SmartDB.clearAllLocalData();
                    alert('Seluruh data berhasil direset.');
                }
            });
        }
    }

    async function refreshAllViews() {
        if (!window.SmartDB) return;
        await window.SmartDB.init();
        const walletMap = await populateWalletDropdowns();

        await Promise.all([
            renderDashboardPage(walletMap),
            renderSingleTypePage('income', 'income', walletMap),
            renderSingleTypePage('expense', 'expense', walletMap),
            renderHistoryPage(walletMap),
            renderSavingsPage(),
            renderBudgetPage(),
            renderReportPage(),
            renderWalletPage()
        ]);

        refreshIcons();
    }

    document.addEventListener('DOMContentLoaded', async () => {
        refreshIcons();
        initTopbarHeader();
        initPWA();
        initNavigationAndQuickTxModal();

        bindSingleTypeFilters('income', 'income');
        bindSingleTypeFilters('expense', 'expense');
        initHistoryPageBindings();
        initSavingsPageBindings();
        initBudgetPageBindings();
        initReportPageBindings();
        initWalletPageBindings();
        initProfileAndSettingsBindings();

        await refreshAllViews();
    });

    window.addEventListener('smartfinance:data-changed', refreshAllViews);

    window.SmartApp = {
        refreshAllViews,
        openQuickTxModal,
        formatRupiah
    };
})(window);
