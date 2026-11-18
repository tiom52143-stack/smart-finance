/* =========================================================================
   SMART FINANCE - Main Application UI & Business Logic Controller
   ========================================================================= */
(function (window) {
    'use strict';

    const EXPENSE_CATEGORIES = [
        { name: 'Makan', label: 'Makan', icon: 'utensils' },
        { name: 'Transportasi', label: 'Transpor', icon: 'car' },
        { name: 'Tagihan', label: 'Tagihan', icon: 'file-text' },
        { name: 'Kesehatan', label: 'Kesehatan', icon: 'heart-pulse' },
        { name: 'Hiburan', label: 'Hiburan', icon: 'film' },
        { name: 'Belanja', label: 'Belanja', icon: 'shopping-bag' },
        { name: 'Pendidikan', label: 'Pendidikan', icon: 'graduation-cap' },
        { name: 'Lainnya', label: 'Lainnya', icon: 'more-horizontal' }
    ];

    const INCOME_CATEGORIES = [
        { name: 'Gaji', label: 'Gaji', icon: 'briefcase' },
        { name: 'Bonus', label: 'Bonus', icon: 'award' },
        { name: 'Bisnis', label: 'Bisnis', icon: 'store' },
        { name: 'Investasi', label: 'Investasi', icon: 'trending-up' },
        { name: 'Hadiah', label: 'Hadiah', icon: 'gift' },
        { name: 'Lainnya', label: 'Lainnya', icon: 'more-horizontal' }
    ];

    let deferredInstallPrompt = null;

    // =========================================================================
    // UTILITAS UMUM
    // =========================================================================
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

    function formatDateIndo(dateStr) {
        if (!dateStr) return '-';
        try {
            const parts = String(dateStr).split('-');
            if (parts.length !== 3) return dateStr;
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            return d.toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch (e) {
            return dateStr;
        }
    }

    function refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        }
    }

    function getInitials(name) {
        const clean = String(name || 'SF').trim();
        if (!clean) return 'SF';
        const words = clean.split(/\s+/);
        if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
        return (words[0][0] + words[1][0]).toUpperCase();
    }

    // =========================================================================
    // REGISTRASI PWA SERVICE WORKER & TOMBOL INSTALL
    // =========================================================================
    function initPWA() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js').catch(() => {
                navigator.serviceWorker.register('/static/service-worker.js').catch((err) => {
                    console.warn('[PWA] Service worker belum aktif:', err);
                });
            });
        }

        const landingInstallBtn = document.getElementById('installPwaBtn');
        const settingsInstallBtn = document.getElementById('settingsInstallPwaBtn');

        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            deferredInstallPrompt = event;
            if (landingInstallBtn) landingInstallBtn.classList.remove('hidden');
        });

        async function triggerInstall() {
            if (!deferredInstallPrompt) {
                alert('Untuk memasang aplikasi: buka menu browser (⋮ atau Share) lalu pilih "Tambahkan ke Layar Utama" / "Install App".');
                return;
            }
            deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
            if (landingInstallBtn) landingInstallBtn.classList.add('hidden');
        }

        if (landingInstallBtn) landingInstallBtn.addEventListener('click', triggerInstall);
        if (settingsInstallBtn) settingsInstallBtn.addEventListener('click', triggerInstall);
    }

    // =========================================================================
    // MODE TAMU (GUEST ACCESS) & IDENTITAS PROFIL LOKAL
    // =========================================================================
    function activateGuestMode() {
        window.localStorage.setItem('sf_user_mode', 'guest');
        if (!window.localStorage.getItem('sf_user_name')) {
            window.localStorage.setItem('sf_user_name', 'Pengguna Tamu');
        }
        window.location.href = '/dashboard';
    }

    function initAuthAndGuestBindings() {
        const landingGuestBtn = document.getElementById('landingGuestBtn');
        const guestLoginBtn = document.getElementById('guestLoginBtn');

        if (landingGuestBtn) {
            landingGuestBtn.addEventListener('click', activateGuestMode);
        }
        if (guestLoginBtn) {
            guestLoginBtn.addEventListener('click', activateGuestMode);
        }

        // Atur tampilan banner tamu & nama pengguna
        const userEmailEl = document.getElementById('profileDisplayEmail');
        const serverHasEmail = userEmailEl && userEmailEl.textContent.includes('@');
        const localName = window.localStorage.getItem('sf_user_name');
        const localEmail = window.localStorage.getItem('sf_user_email');

        const isAuthenticated = Boolean(serverHasEmail || (localEmail && localEmail.includes('@')));
        const sidebarGuestBanner = document.getElementById('sidebarGuestBanner');
        if (sidebarGuestBanner && isAuthenticated) {
            sidebarGuestBanner.classList.add('hidden');
        }

        const greetingEl = document.getElementById('userGreetingName');
        const avatarBadge = document.getElementById('userAvatarBadge');
        if (greetingEl) {
            const currentName = greetingEl.textContent.trim();
            const displayName = (currentName && currentName !== 'Pengguna') ? currentName : (localName || 'Pengguna');
            greetingEl.textContent = displayName;
            if (avatarBadge) avatarBadge.textContent = getInitials(displayName);
        }
    }

    // =========================================================================
    // SINKRONISASI DAFTAR DOMPET KE SELURUH DROPDOWN <SELECT>
    // =========================================================================
    async function populateWalletDropdowns() {
        if (!window.SmartDB) return {};
        const wallets = await window.SmartDB.getAll(window.SmartDB.STORES.WALLETS, false);
        const walletMap = {};
        wallets.forEach((w) => {
            walletMap[w.uuid] = w.name;
        });

        const formSelectIds = [
            'txWalletSelect',
            'editTxWallet',
            'depositWalletSelect',
            'transferFromSelect',
            'transferToSelect'
        ];

        formSelectIds.forEach((id) => {
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

        const filterSelectIds = [
            'incomeWalletFilter',
            'expenseWalletFilter',
            'historyWalletFilter',
            'reportWalletFilter'
        ];

        filterSelectIds.forEach((id) => {
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
    // NAVIGASI DRAWER HP & MODAL TAMBAH TRANSAKSI CEPAT (3 KETUKAN)
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
        if (amountInput) {
            setTimeout(() => amountInput.focus(), 80);
        }
    }

    function closeQuickTxModal() {
        const modal = document.getElementById('quickTxModal');
        if (modal) modal.classList.add('hidden');
    }

    function initNavigationAndQuickTxModal() {
        // Drawer Menu HP
        const openDrawerBtn = document.getElementById('openMobileMenuDrawer');
        const closeDrawerBtn = document.getElementById('closeMobileMenuDrawer');
        const drawerBackdrop = document.getElementById('mobileMenuDrawer');

        if (openDrawerBtn && drawerBackdrop) {
            openDrawerBtn.addEventListener('click', () => drawerBackdrop.classList.remove('hidden'));
        }
        if (closeDrawerBtn && drawerBackdrop) {
            closeDrawerBtn.addEventListener('click', () => drawerBackdrop.classList.add('hidden'));
        }
        if (drawerBackdrop) {
            drawerBackdrop.addEventListener('click', (e) => {
                if (e.target === drawerBackdrop) drawerBackdrop.classList.add('hidden');
            });
        }

        // Pemicu Modal Transaksi Cepat
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
                const preset = btn.getAttribute('data-preset-type') || 'expense';
                openQuickTxModal(preset);
            });
        });

        // Switch Pemasukan / Pengeluaran di dalam Modal
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

        // Submit Form Transaksi Cepat
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

        // Buka otomatis jika diakses melalui PWA Shortcut (?action=new-tx)
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'new-tx') {
            openQuickTxModal('expense');
        }
    }

    // =========================================================================
    // HALAMAN 1: DASHBOARD
    // =========================================================================
    async function renderDashboardPage(walletMap) {
        if (!document.getElementById('kpiTotalBalance')) return;

        const dateDisplay = document.getElementById('currentDateDisplay');
        if (dateDisplay) {
            dateDisplay.textContent = new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        }

        const [wallets, transactions, budgets, goals] = await Promise.all([
            window.SmartDB.getAll(window.SmartDB.STORES.WALLETS, false),
            window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false),
            window.SmartDB.getAll(window.SmartDB.STORES.BUDGETS, false),
            window.SmartDB.getAll(window.SmartDB.STORES.GOALS, false)
        ]);

        const currentMonth = getCurrentMonthISO();

        // 1. Total Saldo Bersih & Strip Dompet
        const totalBalance = wallets.reduce((sum, w) => sum + Number(w.balance || 0), 0);
        document.getElementById('kpiTotalBalance').textContent = formatRupiah(totalBalance);

        const walletStrip = document.getElementById('dashboardWalletStrip');
        if (walletStrip) {
            walletStrip.innerHTML = wallets.map((w) => `
                <div class="wallet-mini-card">
                    <span class="wallet-name">${escapeHtml(w.name)}</span>
                    <span class="wallet-amt">${formatRupiah(w.balance)}</span>
                </div>
            `).join('');
        }

        // 2. Arus Kas Bulan Ini
        let monthIncome = 0;
        let monthExpense = 0;
        const expenseByCategory = {};

        transactions.forEach((tx) => {
            if (tx.is_transfer) return;
            const txMonth = String(tx.transaction_date || '').slice(0, 7);
            if (txMonth === currentMonth) {
                if (tx.type === 'income') {
                    monthIncome += Number(tx.amount || 0);
                } else if (tx.type === 'expense') {
                    const amt = Number(tx.amount || 0);
                    monthExpense += amt;
                    expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + amt;
                }
            }
        });

        const kpiIncomeEl = document.getElementById('kpiMonthIncome');
        const kpiExpenseEl = document.getElementById('kpiMonthExpense');
        const mobIncomeEl = document.getElementById('mobileMonthIncome');
        const mobExpenseEl = document.getElementById('mobileMonthExpense');

        if (kpiIncomeEl) kpiIncomeEl.textContent = formatRupiah(monthIncome);
        if (kpiExpenseEl) kpiExpenseEl.textContent = formatRupiah(monthExpense);
        if (mobIncomeEl) mobIncomeEl.textContent = formatRupiah(monthIncome);
        if (mobExpenseEl) mobExpenseEl.textContent = formatRupiah(monthExpense);

        // 3. Total Tabungan
        const totalSaved = goals.reduce((sum, g) => sum + Number(g.current_amount || 0), 0);
        const totalTarget = goals.reduce((sum, g) => sum + Number(g.target_amount || 0), 0);
        const overallSavingsPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

        const kpiSavingsEl = document.getElementById('kpiTotalSavings');
        const kpiSavingsMetaEl = document.getElementById('kpiSavingsMeta');
        if (kpiSavingsEl) kpiSavingsEl.textContent = formatRupiah(totalSaved);
        if (kpiSavingsMetaEl) kpiSavingsMetaEl.textContent = `${overallSavingsPct}% dari total target tercapai`;

        // 4. Ringkasan Anggaran Mobile
        const monthBudgets = budgets.filter((b) => b.month_year === currentMonth);
        const totalBudgetLimit = monthBudgets.reduce((sum, b) => sum + Number(b.limit_amount || 0), 0);
        const mobBudgetBar = document.getElementById('mobileBudgetProgressBar');
        const mobBudgetText = document.getElementById('mobileBudgetSummaryText');

        if (mobBudgetBar && mobBudgetText) {
            if (totalBudgetLimit > 0) {
                const usedPct = Math.round((monthExpense / totalBudgetLimit) * 100);
                mobBudgetBar.style.width = `${Math.min(100, usedPct)}%`;
                mobBudgetBar.className = 'progress-fill ' + (usedPct >= 100 ? 'bg-danger' : (usedPct >= 80 ? 'bg-warning' : 'bg-success'));
                mobBudgetText.textContent = `Terpakai ${formatRupiah(monthExpense)} dari ${formatRupiah(totalBudgetLimit)} (${usedPct}%)`;
            } else {
                mobBudgetBar.style.width = '0%';
                mobBudgetText.textContent = 'Belum ada batas anggaran diatur untuk bulan ini.';
            }
        }

        // 5. Progres Target Tabungan (Maksimal 3 di Dashboard)
        const goalsListEl = document.getElementById('dashboardGoalsList');
        if (goalsListEl) {
            if (goals.length === 0) {
                goalsListEl.innerHTML = '<p class="text-muted">Belum ada target tabungan aktif. Buat target pertama Anda di menu Tabungan.</p>';
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
                            <p class="card-subtext">${formatRupiah(g.current_amount)} / ${formatRupiah(g.target_amount)}</p>
                        </div>
                    `;
                }).join('');
            }
        }

        // 6. Tabel 5 Transaksi Terakhir
        const recentBody = document.getElementById('recentTransactionsBody');
        if (recentBody) {
            const sortedTx = [...transactions].sort((a, b) => {
                if (a.transaction_date === b.transaction_date) {
                    return String(b.updated_at).localeCompare(String(a.updated_at));
                }
                return String(b.transaction_date).localeCompare(String(a.transaction_date));
            });

            if (sortedTx.length === 0) {
                recentBody.innerHTML = '<tr><td colspan="4" class="text-muted">Belum ada catatan transaksi. Klik tombol + untuk mulai mencatat.</td></tr>';
            } else {
                recentBody.innerHTML = sortedTx.slice(0, 5).map((tx) => {
                    const isInc = tx.type === 'income';
                    const sign = isInc ? '+' : '-';
                    const cls = isInc ? 'text-success' : 'text-danger';
                    const wName = walletMap[tx.wallet_uuid] || 'Dompet';
                    const notePart = tx.note ? ` • <span class="text-muted">${escapeHtml(tx.note)}</span>` : '';
                    return `
                        <tr>
                            <td>${formatDateIndo(tx.transaction_date)}</td>
                            <td><strong>${escapeHtml(tx.category)}</strong>${notePart}</td>
                            <td>${escapeHtml(wName)}</td>
                            <td class="text-right font-bold ${cls}">${sign}${formatRupiah(tx.amount)}</td>
                        </tr>
                    `;
                }).join('');
            }
        }
    }

    // =========================================================================
    // HALAMAN 2 & 3: PEMASUKAN (INCOME) & PENGELUARAN (EXPENSE)
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
                        ${escapeHtml(tx.category)} • ${escapeHtml(wName)} • ${formatDateIndo(tx.transaction_date)}
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
                if (query) {
                    const hay = `${tx.category} ${tx.note}`.toLowerCase();
                    if (!hay.includes(query)) return false;
                }
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

        if (filtered.length === 0) {
            listEl.innerHTML = `<p class="text-muted">Tidak ada data ${txType === 'income' ? 'pemasukan' : 'pengeluaran'} pada filter yang dipilih.</p>`;
        } else {
            listEl.innerHTML = filtered.map((tx) => createTransactionRowHTML(tx, walletMap, false)).join('');
        }
    }

    function bindSingleTypeFilters(txType, prefix) {
        const ids = [`${prefix}SearchInput`, `${prefix}CategoryFilter`, `${prefix}WalletFilter`, `${prefix}MonthFilter`];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const evt = el.tagName === 'INPUT' && el.type === 'search' ? 'input' : 'change';
            el.addEventListener(evt, async () => {
                const walletMap = await populateWalletDropdowns();
                await renderSingleTypePage(txType, prefix, walletMap);
            });
        });
    }

    // =========================================================================
    // HALAMAN 4: RIWAYAT TRANSAKSI (HISTORY + EDIT / HAPUS)
    // =========================================================================
    async function openEditTxModal(uuid) {
        const tx = await window.SmartDB.getById(window.SmartDB.STORES.TRANSACTIONS, uuid);
        if (!tx) return;

        document.getElementById('editTxUuid').value = tx.uuid;
        document.getElementById('editTxType').value = tx.type;
        document.getElementById('editTxAmount').value = tx.amount;
        document.getElementById('editTxCategory').value = tx.category;
        document.getElementById('editTxWallet').value = tx.wallet_uuid;
        document.getElementById('editTxDate').value = tx.transaction_date;
        document.getElementById('editTxNote').value = tx.note || '';

        document.getElementById('editTxModal').classList.remove('hidden');
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
                if (searchVal) {
                    const hay = `${tx.category} ${tx.note}`.toLowerCase();
                    if (!hay.includes(searchVal)) return false;
                }
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
            listEl.innerHTML = '<p class="text-muted">Tidak ditemukan catatan transaksi yang sesuai dengan filter.</p>';
            return;
        }

        listEl.innerHTML = filtered.map((tx) => createTransactionRowHTML(tx, walletMap, true)).join('');

        listEl.querySelectorAll('.edit-tx-trigger').forEach((btn) => {
            btn.addEventListener('click', () => {
                openEditTxModal(btn.getAttribute('data-uuid'));
            });
        });
    }

    function initHistoryPageBindings() {
        if (!document.getElementById('historyListContainer')) return;

        ['historySearchInput', 'historyTypeFilter', 'historyCategoryFilter', 'historyWalletFilter', 'historyMonthFilter'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            const evt = el.tagName === 'INPUT' && el.type === 'search' ? 'input' : 'change';
            el.addEventListener(evt, async () => {
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

        const closeEditBtn = document.getElementById('closeEditTxModal');
        const editModal = document.getElementById('editTxModal');
        if (closeEditBtn && editModal) {
            closeEditBtn.addEventListener('click', () => editModal.classList.add('hidden'));
        }

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
                const uuid = document.getElementById('editTxUuid').value;
                if (confirm('Hapus transaksi ini secara permanen? Saldo dompet akan disesuaikan otomatis.')) {
                    await window.SmartDB.deleteTransaction(uuid);
                    editModal.classList.add('hidden');
                }
            });
        }
    }

    // =========================================================================
    // HALAMAN 5: TARGET TABUNGAN (SAVINGS + KALKULATOR)
    // =========================================================================
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
            gridEl.innerHTML = '<article class="card"><p class="text-muted">Belum ada target tabungan. Klik tombol <strong>"Target Baru"</strong> untuk mulai merencanakan tabungan Anda.</p></article>';
            return;
        }

        gridEl.innerHTML = goals.map((g) => {
            const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
            const isDone = pct >= 100;
            return `
                <article class="card">
                    <div class="goal-card-top">
                        <div>
                            <h3 style="font-size:16px;font-weight:700;">${escapeHtml(g.title)}</h3>
                            <span class="text-muted" style="font-size:12.5px;">Target: ${formatDateIndo(g.deadline)}</span>
                        </div>
                        <span class="badge-pct ${isDone ? 'text-success' : ''}">${pct}%</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill bg-success" style="width:${pct}%;"></div>
                    </div>
                    <div class="goal-card-footer">
                        <span><strong>${formatRupiah(g.current_amount)}</strong> / ${formatRupiah(g.target_amount)}</span>
                        <div style="display:flex;gap:6px;">
                            <button type="button" class="btn btn-outline-danger btn-sm delete-goal-btn" data-uuid="${escapeHtml(g.uuid)}" title="Hapus Target">Hapus</button>
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

        // Kalkulator Simulasi Tabungan
        const calcBtn = document.getElementById('calculateSavingsBtn');
        if (calcBtn) {
            calcBtn.addEventListener('click', () => {
                const target = Number(document.getElementById('calcTargetAmount').value);
                const months = Number(document.getElementById('calcMonths').value);
                if (target <= 0 || months <= 0) {
                    alert('Masukkan nominal impian dan jangka waktu bulan yang valid.');
                    return;
                }
                const perMonth = target / months;
                const perDay = perMonth / 30;
                document.getElementById('calcMonthlyOutput').textContent = `${formatRupiah(perMonth)} / bulan`;
                document.getElementById('calcDailyOutput').textContent = `Atau sekitar ${formatRupiah(perDay)} / hari selama ${months} bulan`;
                document.getElementById('calcResultBox').classList.remove('hidden');
            });
        }

        // Modal Target Baru
        const newGoalModal = document.getElementById('newGoalModal');
        const openNewGoal = document.getElementById('openNewGoalModal');
        const closeNewGoal = document.getElementById('closeNewGoalModal');

        if (openNewGoal) {
            openNewGoal.addEventListener('click', () => {
                const nextYear = new Date();
                nextYear.setMonth(nextYear.getMonth() + 6);
                document.getElementById('goalDeadlineInput').value = nextYear.toISOString().split('T')[0];
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

        // Modal Setor Tabungan
        const depositModal = document.getElementById('depositGoalModal');
        const closeDeposit = document.getElementById('closeDepositGoalModal');
        if (closeDeposit) closeDeposit.addEventListener('click', () => depositModal.classList.add('hidden'));

        const depositForm = document.getElementById('depositGoalForm');
        if (depositForm) {
            depositForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const goalUuid = document.getElementById('depositGoalUuid').value;
                const amount = Number(document.getElementById('depositAmountInput').value);
                const walletUuid = document.getElementById('depositWalletSelect').value;

                await window.SmartDB.depositToGoal(goalUuid, amount, walletUuid);
                depositForm.reset();
                depositModal.classList.add('hidden');
            });
        }
    }

    // =========================================================================
    // HALAMAN 6: ANGGARAN BULANAN (BUDGET)
    // =========================================================================
    async function renderBudgetPage() {
        const container = document.getElementById('budgetListContainer');
        if (!container) return;

        const monthSelector = document.getElementById('budgetMonthSelector');
        if (monthSelector && !monthSelector.value) {
            monthSelector.value = getCurrentMonthISO();
        }
        const selectedMonth = monthSelector ? monthSelector.value : getCurrentMonthISO();

        const [budgets, transactions] = await Promise.all([
            window.SmartDB.getAll(window.SmartDB.STORES.BUDGETS, false),
            window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false)
        ]);

        const monthBudgets = budgets.filter((b) => b.month_year === selectedMonth);

        // Hitung total pengeluaran per kategori pada bulan terpilih
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
        const remaining = Math.max(0, totalLimit - totalSpent);

        document.getElementById('budgetTotalLimit').textContent = formatRupiah(totalLimit);
        document.getElementById('budgetRemainingMeta').textContent = `Sisa anggaran tersedia: ${formatRupiah(remaining)}`;
        document.getElementById('budgetTotalSpent').textContent = formatRupiah(totalSpent);
        document.getElementById('budgetUsagePctLabel').textContent = `${overallPct}%`;
        document.getElementById('budgetCategoryCount').textContent = `${monthBudgets.length} kategori`;

        const overallBar = document.getElementById('budgetOverallProgressBar');
        if (overallBar) {
            overallBar.style.width = `${Math.min(100, overallPct)}%`;
            overallBar.className = 'progress-fill ' + (overallPct >= 100 ? 'bg-danger' : (overallPct >= 80 ? 'bg-warning' : 'bg-success'));
        }

        if (monthBudgets.length === 0) {
            container.innerHTML = '<article class="card"><p class="text-muted">Belum ada batas anggaran diatur untuk bulan ini. Klik tombol <strong>"Atur Anggaran"</strong> untuk mulai menetapkan batas pengeluaran.</p></article>';
            return;
        }

        container.innerHTML = monthBudgets.map((b) => {
            const spent = Number(spentByCat[b.category] || 0);
            const limit = Number(b.limit_amount || 0);
            const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            const barClass = pct >= 100 ? 'bg-danger' : (pct >= 80 ? 'bg-warning' : 'bg-success');
            const textClass = pct >= 100 ? 'text-danger' : (pct >= 80 ? 'text-warning' : 'text-success');

            return `
                <article class="card">
                    <div class="budget-item-top">
                        <div>
                            <strong>${escapeHtml(b.category)}</strong>
                            <span class="text-muted" style="font-size:13px;display:block;">
                                Terpakai ${formatRupiah(spent)} dari ${formatRupiah(limit)}
                            </span>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px;">
                            <strong class="${textClass}">${pct}%</strong>
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
                if (confirm('Hapus batas anggaran untuk kategori ini?')) {
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

    // =========================================================================
    // HALAMAN 7: LAPORAN & EKSPOR EXCEL / PDF (REPORT)
    // =========================================================================
    async function getFilteredReportData() {
        const monthInput = document.getElementById('reportMonthFilter');
        const walletInput = document.getElementById('reportWalletFilter');

        if (monthInput && !monthInput.value) {
            monthInput.value = getCurrentMonthISO();
        }

        const activeMonth = monthInput ? monthInput.value : getCurrentMonthISO();
        const activeWallet = walletInput ? walletInput.value : 'all';

        const allTx = await window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false);
        const filtered = allTx.filter((tx) => {
            if (tx.is_transfer) return false;
            if (activeMonth && String(tx.transaction_date || '').slice(0, 7) !== activeMonth) return false;
            if (activeWallet !== 'all' && tx.wallet_uuid !== activeWallet) return false;
            return true;
        });

        return { activeMonth, activeWallet, filtered };
    }

    async function renderReportPage() {
        const tableBody = document.getElementById('reportCategoryTableBody');
        if (!tableBody) return;

        const { filtered } = await getFilteredReportData();

        let totalIncome = 0;
        let totalExpense = 0;
        const grouped = {};

        filtered.forEach((tx) => {
            const amt = Number(tx.amount || 0);
            if (tx.type === 'income') totalIncome += amt;
            else totalExpense += amt;

            const key = `${tx.type}__${tx.category}`;
            if (!grouped[key]) {
                grouped[key] = {
                    category: tx.category,
                    type: tx.type,
                    count: 0,
                    total: 0
                };
            }
            grouped[key].count += 1;
            grouped[key].total += amt;
        });

        const netCashflow = totalIncome - totalExpense;
        const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netCashflow / totalIncome) * 100)) : 0;

        document.getElementById('reportTotalIncome').textContent = formatRupiah(totalIncome);
        document.getElementById('reportTotalExpense').textContent = formatRupiah(totalExpense);

        const netEl = document.getElementById('reportNetCashflow');
        netEl.textContent = (netCashflow >= 0 ? '+' : '-') + formatRupiah(Math.abs(netCashflow));
        netEl.className = 'kpi-value ' + (netCashflow >= 0 ? 'text-success' : 'text-danger');
        document.getElementById('reportSavingsRateMeta').textContent = `Rasio tabungan: ${savingsRate}%`;

        const rows = Object.values(grouped).sort((a, b) => b.total - a.total);
        document.getElementById('reportCategorySummaryCount').textContent = `${rows.length} kategori tercatat`;

        if (rows.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-muted">Belum ada data transaksi pada periode yang dipilih.</td></tr>';
            return;
        }

        tableBody.innerHTML = rows.map((row) => {
            const isInc = row.type === 'income';
            const baseTotal = isInc ? totalIncome : totalExpense;
            const share = baseTotal > 0 ? Math.round((row.total / baseTotal) * 100) : 0;
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
                if (window.SmartCharts) {
                    await window.SmartCharts.renderReportCharts();
                }
            });
        }

        // Ekspor CSV / Excel (.csv UTF-8 BOM)
        const excelBtn = document.getElementById('exportExcelBtn');
        if (excelBtn) {
            excelBtn.addEventListener('click', async () => {
                const walletMap = await populateWalletDropdowns();
                const { activeMonth, filtered } = await getFilteredReportData();

                if (filtered.length === 0) {
                    alert('Tidak ada transaksi untuk diekspor pada periode ini.');
                    return;
                }

                const lines = ['Tanggal,Jenis,Kategori,Dompet,Nominal,Catatan'];
                filtered.forEach((tx) => {
                    const row = [
                        tx.transaction_date,
                        tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
                        `"${String(tx.category).replace(/"/g, '""')}"`,
                        `"${String(walletMap[tx.wallet_uuid] || 'Dompet').replace(/"/g, '""')}"`,
                        tx.amount,
                        `"${String(tx.note || '').replace(/"/g, '""')}"`
                    ];
                    lines.push(row.join(','));
                });

                const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Laporan-SmartFinance-${activeMonth || 'Semua'}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        // Unduh / Cetak PDF Laporan
        const pdfBtn = document.getElementById('exportPdfBtn');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => {
                window.print();
            });
        }
    }

    // =========================================================================
    // HALAMAN 8: DOMPET & TRANSFER SALDO (WALLET)
    // =========================================================================
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

    // =========================================================================
    // HALAMAN 9 & 10: PROFIL & PENGATURAN (CADANGAN JSON, PENGINGAT, RESET)
    // =========================================================================
    function initProfileAndSettingsBindings() {
        // Halaman Profil
        const profileForm = document.getElementById('updateProfileForm');
        if (profileForm) {
            const nameInput = document.getElementById('profileNameInput');
            const emailInput = document.getElementById('profileEmailInput');
            const displayNameEl = document.getElementById('profileDisplayName');
            const displayEmailEl = document.getElementById('profileDisplayEmail');
            const avatarEl = document.getElementById('profileAvatarInitial');
            const badgeEl = document.getElementById('profileAccountBadge');

            const storedName = window.localStorage.getItem('sf_user_name');
            const storedEmail = window.localStorage.getItem('sf_user_email');

            if (storedName && nameInput) {
                nameInput.value = storedName;
                if (displayNameEl) displayNameEl.textContent = storedName;
            }
            if (storedEmail && emailInput && !emailInput.value) {
                emailInput.value = storedEmail;
                if (displayEmailEl) displayEmailEl.textContent = storedEmail;
            }
            if (avatarEl && displayNameEl) {
                avatarEl.textContent = getInitials(displayNameEl.textContent);
            }
            if (badgeEl && ((emailInput && emailInput.value.includes('@')))) {
                badgeEl.className = 'status-pill status-online';
                badgeEl.textContent = 'Akun Terhubung';
            }

            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const newName = nameInput.value.trim();
                const newEmail = emailInput.value.trim();
                window.localStorage.setItem('sf_user_name', newName);
                if (newEmail) window.localStorage.setItem('sf_user_email', newEmail);

                if (displayNameEl) displayNameEl.textContent = newName;
                if (displayEmailEl && newEmail) displayEmailEl.textContent = newEmail;
                if (avatarEl) avatarEl.textContent = getInitials(newName);
                alert('Perubahan profil berhasil disimpan!');
            });
        }

        // Pengingat Harian (Settings)
        const reminderToggle = document.getElementById('dailyReminderToggle');
        const reminderBox = document.getElementById('reminderTimeBox');
        const saveReminderBtn = document.getElementById('saveReminderBtn');

        if (reminderToggle && reminderBox && window.SmartDB) {
            window.SmartDB.getSetting('daily_reminder_enabled', false).then((enabled) => {
                reminderToggle.checked = Boolean(enabled);
                if (enabled) reminderBox.classList.remove('hidden');
            });

            window.SmartDB.getSetting('daily_reminder_time', '20:00').then((timeVal) => {
                const timeInput = document.getElementById('reminderTimeInput');
                if (timeInput && timeVal) timeInput.value = timeVal;
            });

            reminderToggle.addEventListener('change', async () => {
                if (reminderToggle.checked) {
                    reminderBox.classList.remove('hidden');
                    if ('Notification' in window && Notification.permission === 'default') {
                        await Notification.requestPermission();
                    }
                    await window.SmartDB.setSetting('daily_reminder_enabled', true);
                } else {
                    reminderBox.classList.add('hidden');
                    await window.SmartDB.setSetting('daily_reminder_enabled', false);
                }
            });

            if (saveReminderBtn) {
                saveReminderBtn.addEventListener('click', async () => {
                    const timeVal = document.getElementById('reminderTimeInput').value;
                    const noteVal = document.getElementById('reminderNoteInput').value;
                    await window.SmartDB.setSetting('daily_reminder_time', timeVal);
                    await window.SmartDB.setSetting('daily_reminder_note', noteVal);
                    alert(`Pengingat harian dijadwalkan setiap pukul ${timeVal}.`);
                });
            }
        }

        // Ekspor Cadangan JSON
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

        // Pulihkan Cadangan JSON
        const importJsonInput = document.getElementById('importJsonBackupInput');
        if (importJsonInput) {
            importJsonInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    const parsed = JSON.parse(text);
                    await window.SmartDB.importFullBackup(parsed);
                    alert('Data cadangan JSON berhasil dipulihkan!');
                } catch (err) {
                    alert('Gagal membaca berkas cadangan: ' + err.message);
                }
                importJsonInput.value = '';
            });
        }

        // Reset Data Lokal Perangkat
        const resetLocalBtn = document.getElementById('resetLocalDataBtn');
        if (resetLocalBtn) {
            resetLocalBtn.addEventListener('click', async () => {
                if (confirm('PERINGATAN: Seluruh catatan transaksi, anggaran, dan target tabungan di perangkat ini akan dihapus. Lanjutkan?')) {
                    await window.SmartDB.clearAllLocalData();
                    alert('Seluruh data lokal perangkat berhasil direset ke kondisi awal.');
                }
            });
        }
    }

    // =========================================================================
    // REFRESH SELURUH KOMPONEN HALAMAN AKTIF
    // =========================================================================
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

    // =========================================================================
    // INISIALISASI SAAT HALAMAN SELESAI DIMUAT
    // =========================================================================
    document.addEventListener('DOMContentLoaded', async () => {
        refreshIcons();
        initPWA();
        initAuthAndGuestBindings();
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

    window.addEventListener('smartfinance:data-changed', () => {
        refreshAllViews();
    });

    window.SmartApp = {
        refreshAllViews,
        openQuickTxModal,
        formatRupiah
    };
})(window);
