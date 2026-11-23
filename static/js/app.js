/* =========================================================================
   SMART FINANCE - Main Application Controller
   Lengkap Poin 1–10: Dashboard, Income, Expense, Savings, Budget, History,
                      Report, Wallet, Profile & Settings
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

    const WALLET_TYPE_META = {
        cash: { label: 'Tunai', icon: 'banknote' },
        bank: { label: 'Bank', icon: 'landmark' },
        ewallet: { label: 'E-Wallet', icon: 'smartphone' }
    };

    const CHART_PALETTE = [
        '#0B2545',
        '#1FA66A',
        '#2563EB',
        '#F59E0B',
        '#DC2626',
        '#7C3AED',
        '#0D9488',
        '#64748B'
    ];

    let deferredInstallPrompt = null;

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
        return String(str || '').replace(/[&<>"']/g, function (ch) {
            if (ch === '&') return '&' + 'amp;';
            if (ch === '<') return '&' + 'lt;';
            if (ch === '>') return '&' + 'gt;';
            if (ch === '"') return '&' + 'quot;';
            if (ch === "'") return '&#' + '039;';
            return ch;
        });
    }

    function computeInitials(name) {
        const cleaned = String(name || '').trim();
        if (!cleaned || cleaned.toLowerCase() === 'pengguna') return 'SF';
        const parts = cleaned.split(/\s+/);
        if (parts.length === 1) {
            return parts[0].slice(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    function normalizeCategoryName(cat) {
        if (cat === 'Transportasi') return 'Transport';
        if (cat === 'Bisnis') return 'Usaha';
        return String(cat || 'Lainnya');
    }

    function mapCategoryToHistoryOption(cat) {
        const norm = normalizeCategoryName(cat);
        if (norm === 'Transport') return 'Transportasi';
        if (norm === 'Usaha') return 'Bisnis';
        return norm;
    }

    function getTodayISO() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().split('T')[0];
    }

    function getCurrentMonthISO() {
        return getTodayISO().slice(0, 7);
    }

    function formatMonthLabelID(monthISO) {
        if (!monthISO || monthISO.length < 7) return 'Periode bulan ini';
        const parts = monthISO.split('-');
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
        return d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }

    function formatMonthShortID(monthISO) {
        if (!monthISO || monthISO.length < 7) return monthISO;
        const parts = monthISO.split('-');
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
        return d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    }

    function getLastSixMonths(endMonthISO) {
        const base = (endMonthISO && endMonthISO.length >= 7) ? endMonthISO : getCurrentMonthISO();
        const parts = base.split('-');
        const year = Number(parts[0]);
        const month = Number(parts[1]) - 1;
        const result = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(year, month - i, 1);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            result.push(y + '-' + m);
        }
        return result;
    }

    function formatDateShort(dateStr) {
        if (!dateStr) return '-';
        try {
            const parts = String(dateStr).split('-');
            if (parts.length !== 3) return dateStr;
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
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
        setInterval(updateLiveHeaderDate, 60000);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) updateLiveHeaderDate();
        });
    }

    // =========================================================================
    // SERVICE WORKER & PWA INSTALL PROMPT
    // =========================================================================
    function initServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/service-worker.js')
                .then(function (reg) { reg.update(); })
                .catch(function () {});
        }

        window.addEventListener('beforeinstallprompt', function (event) {
            event.preventDefault();
            deferredInstallPrompt = event;
        });

        window.addEventListener('appinstalled', function () {
            deferredInstallPrompt = null;
        });
    }

    // =========================================================================
    // SINKRONISASI DAFTAR DOMPET KE DROPDOWN
    // =========================================================================
    async function populateWalletDropdowns() {
        if (!window.SmartDB) return {};
        const wallets = await window.SmartDB.getAll(window.SmartDB.STORES.WALLETS, false);
        const walletMap = {};
        wallets.forEach(function (w) {
            walletMap[w.uuid] = w.name;
        });

        ['txWalletSelect', 'editTxWallet', 'depositWalletSelect', 'transferFromSelect', 'transferToSelect'].forEach(function (id) {
            const selectEl = document.getElementById(id);
            if (!selectEl) return;
            const prevValue = selectEl.value;
            selectEl.innerHTML = wallets
                .map(function (w) {
                    return '<option value="' + escapeHtml(w.uuid) + '">' + escapeHtml(w.name) + ' (' + formatRupiah(w.balance) + ')</option>';
                })
                .join('');
            if (prevValue && walletMap[prevValue]) {
                selectEl.value = prevValue;
            } else if (id === 'transferToSelect' && wallets.length > 1) {
                selectEl.value = wallets[1].uuid;
            }
        });

        ['incomeWalletFilter', 'expenseWalletFilter', 'historyWalletFilter', 'reportWalletFilter'].forEach(function (id) {
            const selectEl = document.getElementById(id);
            if (!selectEl) return;
            const prevValue = selectEl.value || 'all';
            selectEl.innerHTML = '<option value="all">Semua Dompet</option>' +
                wallets.map(function (w) {
                    return '<option value="' + escapeHtml(w.uuid) + '">' + escapeHtml(w.name) + '</option>';
                }).join('');
            selectEl.value = prevValue;
        });

        return walletMap;
    }

    // =========================================================================
    // POIN 2, 3 & 4: MODAL TAMBAH TRANSAKSI CEPAT
    // =========================================================================
    function renderQuickTxCategories(type) {
        const grid = document.getElementById('txCategoryGrid');
        const catInput = document.getElementById('txCategoryInput');
        if (!grid || !catInput) return;

        const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        catInput.value = list[0].name;

        grid.innerHTML = list.map(function (item, index) {
            const activeCls = index === 0 ? 'active' : '';
            return '<button type="button" class="cat-chip ' + activeCls + '" data-cat="' + escapeHtml(item.name) + '">' +
                '<i data-lucide="' + item.icon + '"></i>' +
                '<span>' + escapeHtml(item.label) + '</span>' +
                '</button>';
        }).join('');

        grid.querySelectorAll('.cat-chip').forEach(function (chip) {
            chip.addEventListener('click', function () {
                grid.querySelectorAll('.cat-chip').forEach(function (c) {
                    c.classList.remove('active');
                });
                chip.classList.add('active');
                catInput.value = chip.getAttribute('data-cat');
            });
        });

        refreshIcons();
    }

    async function openQuickTxModal(presetType) {
        const modal = document.getElementById('quickTxModal');
        const typeInput = document.getElementById('txTypeInput');
        const dateInput = document.getElementById('txDateInput');
        const amountInput = document.getElementById('txAmountInput');
        if (!modal) return;

        if (window.SmartDB) {
            await window.SmartDB.init();
            await populateWalletDropdowns();
        }

        const defaultType = window.location.pathname === '/income' ? 'income' : 'expense';
        const targetType = presetType ? (presetType === 'income' ? 'income' : 'expense') : defaultType;
        if (typeInput) typeInput.value = targetType;

        modal.querySelectorAll('.tx-type-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-type') === targetType);
        });

        renderQuickTxCategories(targetType);
        if (dateInput) {
            dateInput.value = getTodayISO();
        }

        modal.classList.remove('hidden');
        if (amountInput) {
            setTimeout(function () { amountInput.focus(); }, 60);
        }
    }

    function closeQuickTxModal() {
        const modal = document.getElementById('quickTxModal');
        if (modal) modal.classList.add('hidden');
    }

    function initNavigationAndQuickTxModal() {
        document.addEventListener('click', function (event) {
            const trigger = event.target.closest('#openQuickTxModalDesktop, #openQuickTxModalMobile, .open-quick-tx');
            if (trigger) {
                event.preventDefault();
                const preset = trigger.getAttribute('data-preset-type') || (window.location.pathname === '/income' ? 'income' : 'expense');
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

        document.querySelectorAll('.tx-type-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const chosenType = btn.getAttribute('data-type') || 'expense';
                const typeInput = document.getElementById('txTypeInput');
                if (typeInput) typeInput.value = chosenType;
                document.querySelectorAll('.tx-type-btn').forEach(function (b) {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                renderQuickTxCategories(chosenType);
            });
        });

        document.addEventListener('input', function (event) {
            if (event.target.classList && event.target.classList.contains('rupiah-input')) {
                formatThousandInput(event.target);
            }
        });

        const quickForm = document.getElementById('quickTransactionForm');
        if (quickForm) {
            quickForm.addEventListener('submit', async function (event) {
                event.preventDefault();
                if (!window.SmartDB) {
                    alert('Penyimpanan lokal belum siap. Silakan muat ulang halaman.');
                    return;
                }

                const type = document.getElementById('txTypeInput').value;
                const amount = parseRupiahDigits(document.getElementById('txAmountInput').value);
                const category = normalizeCategoryName(document.getElementById('txCategoryInput').value);
                const walletUuid = document.getElementById('txWalletSelect').value;
                const txDate = document.getElementById('txDateInput').value || getTodayISO();
                const note = document.getElementById('txNoteInput').value.trim();

                if (amount <= 0) {
                    alert('Masukkan nominal transaksi lebih besar dari Rp 0.');
                    return;
                }

                await window.SmartDB.saveTransaction({
                    type: type,
                    amount: amount,
                    category: category,
                    wallet_uuid: walletUuid,
                    transaction_date: txDate,
                    note: note
                });

                quickForm.reset();
                document.getElementById('txDateInput').value = getTodayISO();
                closeQuickTxModal();
                await refreshAllViews();
            });
        }
    }

    // =========================================================================
    // RENDER DASHBOARD UTAMA
    // =========================================================================
    async function renderDashboardPage(walletMap) {
        if (!document.getElementById('kpiTotalBalance')) return;

        const results = await Promise.all([
            window.SmartDB.getAll(window.SmartDB.STORES.WALLETS, false),
            window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false),
            window.SmartDB.getAll(window.SmartDB.STORES.BUDGETS, false),
            window.SmartDB.getAll(window.SmartDB.STORES.GOALS, false)
        ]);

        const wallets = results[0];
        const transactions = results[1];
        const budgets = results[2];
        const goals = results[3];

        const currentMonth = getCurrentMonthISO();
        const monthName = new Date().toLocaleDateString('id-ID', { month: 'long' });

        const incMonthLbl = document.getElementById('kpiIncomeMonthLabel');
        const expMonthLbl = document.getElementById('kpiExpenseMonthLabel');
        if (incMonthLbl) incMonthLbl.textContent = 'Pemasukan ' + monthName;
        if (expMonthLbl) expMonthLbl.textContent = 'Pengeluaran ' + monthName;

        const totalBalance = wallets.reduce(function (sum, w) {
            return sum + Number(w.balance || 0);
        }, 0);
        document.getElementById('kpiTotalBalance').textContent = formatRupiah(totalBalance);
        const walletMeta = document.getElementById('kpiWalletCountMeta');
        if (walletMeta) walletMeta.textContent = wallets.length + ' dompet';

        let monthIncome = 0;
        let monthExpense = 0;
        transactions.forEach(function (tx) {
            if (tx.is_transfer) return;
            if (String(tx.transaction_date || '').slice(0, 7) === currentMonth) {
                if (tx.type === 'income') monthIncome += Number(tx.amount || 0);
                else if (tx.type === 'expense') monthExpense += Number(tx.amount || 0);
            }
        });

        document.getElementById('kpiMonthIncome').textContent = formatRupiah(monthIncome);
        document.getElementById('kpiMonthExpense').textContent = formatRupiah(monthExpense);

        const monthBudgets = budgets.filter(function (b) {
            return b.month_year === currentMonth;
        });
        const totalBudgetLimit = monthBudgets.reduce(function (sum, b) {
            return sum + Number(b.limit_amount || 0);
        }, 0);
        const budgetPct = totalBudgetLimit > 0 ? Math.round((monthExpense / totalBudgetLimit) * 100) : 0;
        const expSubMeta = document.getElementById('kpiExpenseSubMeta');
        if (expSubMeta) expSubMeta.textContent = budgetPct + '% dari anggaran';

        const totalSaved = goals.reduce(function (sum, g) {
            return sum + Number(g.current_amount || 0);
        }, 0);
        document.getElementById('kpiTotalSavings').textContent = formatRupiah(totalSaved);
        document.getElementById('kpiSavingsMeta').textContent = goals.length + ' target aktif';

        const goalsListEl = document.getElementById('dashboardGoalsList');
        if (goalsListEl) {
            if (goals.length === 0) {
                goalsListEl.innerHTML = '<p class="text-muted" style="font-size:13px;">Belum ada target tabungan aktif.</p>';
            } else {
                goalsListEl.innerHTML = goals.slice(0, 3).map(function (g) {
                    const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
                    return '<div>' +
                        '<div class="goal-mini-top">' +
                        '<strong>' + escapeHtml(g.title) + '</strong>' +
                        '<span class="text-success font-bold">' + pct + '%</span>' +
                        '</div>' +
                        '<div class="progress-track">' +
                        '<div class="progress-fill bg-success" style="width:' + pct + '%;"></div>' +
                        '</div>' +
                        '<p class="card-subtext">' + formatRupiah(g.current_amount) + ' dari ' + formatRupiah(g.target_amount) + '</p>' +
                        '</div>';
                }).join('');
            }
        }

        const recentBody = document.getElementById('recentTransactionsBody');
        if (recentBody) {
            const sortedTx = transactions.slice().sort(function (a, b) {
                if (a.transaction_date === b.transaction_date) {
                    return String(b.updated_at).localeCompare(String(a.updated_at));
                }
                return String(b.transaction_date).localeCompare(String(a.transaction_date));
            });

            if (sortedTx.length === 0) {
                recentBody.innerHTML = '<tr><td colspan="5" class="text-muted">Belum ada catatan transaksi.</td></tr>';
            } else {
                recentBody.innerHTML = sortedTx.slice(0, 5).map(function (tx) {
                    const isInc = tx.type === 'income';
                    const sign = isInc ? '+' : '-';
                    const cls = isInc ? 'text-success' : 'text-danger';
                    const wName = walletMap[tx.wallet_uuid] || 'Dompet';
                    const desc = tx.note ? escapeHtml(tx.note) : escapeHtml(tx.category);
                    return '<tr>' +
                        '<td class="text-muted">' + formatDateShort(tx.transaction_date) + '</td>' +
                        '<td><strong>' + desc + '</strong></td>' +
                        '<td class="text-muted">' + escapeHtml(tx.category) + '</td>' +
                        '<td class="text-muted">' + escapeHtml(wName) + '</td>' +
                        '<td class="text-right font-bold ' + cls + '">' + sign + formatRupiah(tx.amount) + '</td>' +
                        '</tr>';
                }).join('');
            }
        }
    }

    // =========================================================================
    // POIN 3: RENDER HALAMAN INCOME (PEMASUKAN)
    // =========================================================================
    function initIncomePageFilters() {
        const monthInput = document.getElementById('incomeMonthFilter');
        if (monthInput && !monthInput.value) {
            monthInput.value = getCurrentMonthISO();
        }

        ['incomeMonthFilter', 'incomeCategoryFilter', 'incomeWalletFilter'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', refreshAllViews);
            }
        });

        const searchInput = document.getElementById('incomeSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', refreshAllViews);
        }
    }

    async function renderIncomePage(walletMap) {
        const listContainer = document.getElementById('incomeListContainer');
        const totalEl = document.getElementById('incomeTotalMonth');
        const countEl = document.getElementById('incomeCountMonth');
        if (!listContainer || !totalEl || !countEl) return;

        const monthInput = document.getElementById('incomeMonthFilter');
        if (monthInput && !monthInput.value) {
            monthInput.value = getCurrentMonthISO();
        }

        const selectedMonth = (monthInput && monthInput.value) ? monthInput.value : getCurrentMonthISO();
        const selectedCategory = (document.getElementById('incomeCategoryFilter') || {}).value || 'all';
        const selectedWallet = (document.getElementById('incomeWalletFilter') || {}).value || 'all';
        const keyword = ((document.getElementById('incomeSearchInput') || {}).value || '').trim().toLowerCase();

        const allTransactions = await window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false);
        const incomeTransactions = allTransactions.filter(function (tx) {
            return tx.type === 'income' && !tx.is_transfer;
        });

        const periodIncomes = incomeTransactions.filter(function (tx) {
            return String(tx.transaction_date || '').slice(0, 7) === selectedMonth;
        });

        const periodTotal = periodIncomes.reduce(function (sum, tx) {
            return sum + Number(tx.amount || 0);
        }, 0);

        totalEl.textContent = formatRupiah(periodTotal);
        countEl.textContent = periodIncomes.length + ' Transaksi';

        const subEl = document.getElementById('incomeMonthSubtitle');
        if (subEl) {
            subEl.textContent = 'Periode ' + formatMonthLabelID(selectedMonth);
        }

        const filteredIncomes = periodIncomes.filter(function (tx) {
            if (selectedCategory !== 'all' && normalizeCategoryName(tx.category) !== normalizeCategoryName(selectedCategory)) return false;
            if (selectedWallet !== 'all' && tx.wallet_uuid !== selectedWallet) return false;
            if (keyword) {
                const hay = (String(tx.note || '') + ' ' + String(tx.category || '')).toLowerCase();
                if (hay.indexOf(keyword) === -1) return false;
            }
            return true;
        }).sort(function (a, b) {
            if (a.transaction_date === b.transaction_date) {
                return String(b.updated_at).localeCompare(String(a.updated_at));
            }
            return String(b.transaction_date).localeCompare(String(a.transaction_date));
        });

        if (filteredIncomes.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; padding:28px 16px;">' +
                '<p class="text-muted" style="font-size:14px; margin:0 0 6px 0;">Belum ada pemasukan tercatat untuk periode ini.</p>' +
                '<p class="card-subtext" style="margin:0;">Klik tombol <strong>+ Tambah Pemasukan</strong> di atas untuk mencatat pemasukan baru.</p>' +
                '</div>';
            return;
        }

        listContainer.innerHTML = '<div style="display:flex; flex-direction:column; gap:10px;">' +
            filteredIncomes.map(function (tx) {
                const wName = walletMap[tx.wallet_uuid] || 'Dompet';
                const title = tx.note ? escapeHtml(tx.note) : escapeHtml(tx.category);
                return '<div style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border:1px solid #E2E8F0; border-radius:12px; background:#FFFFFF;">' +
                    '<div style="display:flex; align-items:center; gap:12px; min-width:0;">' +
                    '<div style="width:40px; height:40px; border-radius:10px; background:rgba(31,166,106,0.12); color:#1FA66A; display:flex; align-items:center; justify-content:center; flex-shrink:0;">' +
                    '<i data-lucide="arrow-down-left"></i>' +
                    '</div>' +
                    '<div style="min-width:0;">' +
                    '<div style="font-weight:600; color:#0B2545; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + title + '</div>' +
                    '<div class="text-muted" style="font-size:12px;">' + escapeHtml(tx.category) + ' • ' + escapeHtml(wName) + ' • ' + formatDateShort(tx.transaction_date) + '</div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="text-success font-bold" style="font-size:14px; white-space:nowrap;">+' + formatRupiah(tx.amount) + '</div>' +
                    '</div>';
            }).join('') +
            '</div>';
    }

    // =========================================================================
    // POIN 4: RENDER HALAMAN EXPENSE (PENGELUARAN)
    // =========================================================================
    function initExpensePageFilters() {
        const monthInput = document.getElementById('expenseMonthFilter');
        if (monthInput && !monthInput.value) {
            monthInput.value = getCurrentMonthISO();
        }

        ['expenseMonthFilter', 'expenseCategoryFilter', 'expenseWalletFilter'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', refreshAllViews);
            }
        });

        const searchInput = document.getElementById('expenseSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', refreshAllViews);
        }
    }

    async function renderExpensePage(walletMap) {
        const listContainer = document.getElementById('expenseListContainer');
        const totalEl = document.getElementById('expenseTotalMonth');
        const countEl = document.getElementById('expenseCountMonth');
        if (!listContainer || !totalEl || !countEl) return;

        const monthInput = document.getElementById('expenseMonthFilter');
        if (monthInput && !monthInput.value) {
            monthInput.value = getCurrentMonthISO();
        }

        const selectedMonth = (monthInput && monthInput.value) ? monthInput.value : getCurrentMonthISO();
        const selectedCategory = (document.getElementById('expenseCategoryFilter') || {}).value || 'all';
        const selectedWallet = (document.getElementById('expenseWalletFilter') || {}).value || 'all';
        const keyword = ((document.getElementById('expenseSearchInput') || {}).value || '').trim().toLowerCase();

        const allTransactions = await window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false);
        const expenseTransactions = allTransactions.filter(function (tx) {
            return tx.type === 'expense' && !tx.is_transfer;
        });

        const periodExpenses = expenseTransactions.filter(function (tx) {
            return String(tx.transaction_date || '').slice(0, 7) === selectedMonth;
        });

        const periodTotal = periodExpenses.reduce(function (sum, tx) {
            return sum + Number(tx.amount || 0);
        }, 0);

        totalEl.textContent = formatRupiah(periodTotal);
        countEl.textContent = periodExpenses.length + ' Transaksi';

        const subEl = document.getElementById('expenseMonthSubtitle');
        if (subEl) {
            subEl.textContent = 'Periode ' + formatMonthLabelID(selectedMonth);
        }

        const filteredExpenses = periodExpenses.filter(function (tx) {
            if (selectedCategory !== 'all' && normalizeCategoryName(tx.category) !== normalizeCategoryName(selectedCategory)) return false;
            if (selectedWallet !== 'all' && tx.wallet_uuid !== selectedWallet) return false;
            if (keyword) {
                const hay = (String(tx.note || '') + ' ' + String(tx.category || '')).toLowerCase();
                if (hay.indexOf(keyword) === -1) return false;
            }
            return true;
        }).sort(function (a, b) {
            if (a.transaction_date === b.transaction_date) {
                return String(b.updated_at).localeCompare(String(a.updated_at));
            }
            return String(b.transaction_date).localeCompare(String(a.transaction_date));
        });

        if (filteredExpenses.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; padding:28px 16px;">' +
                '<p class="text-muted" style="font-size:14px; margin:0 0 6px 0;">Belum ada pengeluaran tercatat untuk periode ini.</p>' +
                '<p class="card-subtext" style="margin:0;">Klik tombol <strong>+ Tambah Pengeluaran</strong> di atas untuk mencatat pengeluaran baru.</p>' +
                '</div>';
            return;
        }

        listContainer.innerHTML = '<div style="display:flex; flex-direction:column; gap:10px;">' +
            filteredExpenses.map(function (tx) {
                const wName = walletMap[tx.wallet_uuid] || 'Dompet';
                const title = tx.note ? escapeHtml(tx.note) : escapeHtml(tx.category);
                return '<div style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border:1px solid #E2E8F0; border-radius:12px; background:#FFFFFF;">' +
                    '<div style="display:flex; align-items:center; gap:12px; min-width:0;">' +
                    '<div style="width:40px; height:40px; border-radius:10px; background:rgba(220,38,38,0.10); color:#DC2626; display:flex; align-items:center; justify-content:center; flex-shrink:0;">' +
                    '<i data-lucide="arrow-up-right"></i>' +
                    '</div>' +
                    '<div style="min-width:0;">' +
                    '<div style="font-weight:600; color:#0B2545; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + title + '</div>' +
                    '<div class="text-muted" style="font-size:12px;">' + escapeHtml(tx.category) + ' • ' + escapeHtml(wName) + ' • ' + formatDateShort(tx.transaction_date) + '</div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="text-danger font-bold" style="font-size:14px; color:#DC2626; white-space:nowrap;">-' + formatRupiah(tx.amount) + '</div>' +
                    '</div>';
            }).join('') +
            '</div>';
    }

    // =========================================================================
    // POIN 5: HALAMAN SAVINGS (TARGET TABUNGAN, SETOR DANA & SIMULASI)
    // =========================================================================
    function initSavingsPage() {
        document.addEventListener('click', async function (event) {
            if (event.target.closest('#openNewGoalModal')) {
                const modal = document.getElementById('newGoalModal');
                const deadlineInput = document.getElementById('goalDeadlineInput');
                const titleInput = document.getElementById('goalTitleInput');
                if (modal) {
                    if (deadlineInput && !deadlineInput.value) {
                        const future = new Date();
                        future.setMonth(future.getMonth() + 3);
                        deadlineInput.value = future.toISOString().split('T')[0];
                    }
                    modal.classList.remove('hidden');
                    if (titleInput) setTimeout(function () { titleInput.focus(); }, 60);
                }
                return;
            }

            if (event.target.closest('#closeNewGoalModal') || event.target.id === 'newGoalModal') {
                const modal = document.getElementById('newGoalModal');
                if (modal) modal.classList.add('hidden');
                return;
            }

            const depositBtn = event.target.closest('.open-deposit-goal-btn');
            if (depositBtn) {
                const modal = document.getElementById('depositGoalModal');
                const uuidInput = document.getElementById('depositGoalUuid');
                const nameLabel = document.getElementById('depositGoalNameLabel');
                const amountInput = document.getElementById('depositAmountInput');
                if (modal && uuidInput) {
                    await populateWalletDropdowns();
                    uuidInput.value = depositBtn.getAttribute('data-uuid') || '';
                    if (nameLabel) nameLabel.textContent = depositBtn.getAttribute('data-title') || '-';
                    modal.classList.remove('hidden');
                    if (amountInput) setTimeout(function () { amountInput.focus(); }, 60);
                }
                return;
            }

            if (event.target.closest('#closeDepositGoalModal') || event.target.id === 'depositGoalModal') {
                const modal = document.getElementById('depositGoalModal');
                if (modal) modal.classList.add('hidden');
                return;
            }

            const deleteBtn = event.target.closest('.delete-goal-btn');
            if (deleteBtn) {
                const goalUuid = deleteBtn.getAttribute('data-uuid');
                const goalTitle = deleteBtn.getAttribute('data-title') || 'target ini';
                if (goalUuid && window.confirm('Hapus target tabungan "' + goalTitle + '"?')) {
                    await window.SmartDB.deleteGoal(goalUuid);
                    await refreshAllViews();
                }
            }
        });

        const newGoalForm = document.getElementById('newGoalForm');
        if (newGoalForm) {
            newGoalForm.addEventListener('submit', async function (event) {
                event.preventDefault();
                if (!window.SmartDB) return;

                const title = document.getElementById('goalTitleInput').value.trim();
                const targetAmount = Number(document.getElementById('goalTargetInput').value || 0);
                const currentAmount = Number(document.getElementById('goalInitialInput').value || 0);
                const deadline = document.getElementById('goalDeadlineInput').value;

                if (!title || targetAmount <= 0) {
                    alert('Masukkan nama target dan nominal target lebih besar dari Rp 0.');
                    return;
                }

                await window.SmartDB.saveGoal({
                    title: title,
                    target_amount: targetAmount,
                    current_amount: currentAmount,
                    deadline: deadline
                });

                newGoalForm.reset();
                const modal = document.getElementById('newGoalModal');
                if (modal) modal.classList.add('hidden');
                await refreshAllViews();
            });
        }

        const depositGoalForm = document.getElementById('depositGoalForm');
        if (depositGoalForm) {
            depositGoalForm.addEventListener('submit', async function (event) {
                event.preventDefault();
                if (!window.SmartDB) return;

                const goalUuid = document.getElementById('depositGoalUuid').value;
                const amount = Number(document.getElementById('depositAmountInput').value || 0);
                const walletUuid = document.getElementById('depositWalletSelect').value;

                if (!goalUuid || amount <= 0) {
                    alert('Masukkan nominal setoran tabungan yang valid.');
                    return;
                }

                await window.SmartDB.depositToGoal(goalUuid, amount, walletUuid);
                depositGoalForm.reset();
                const modal = document.getElementById('depositGoalModal');
                if (modal) modal.classList.add('hidden');
                await refreshAllViews();
            });
        }

        const calcBtn = document.getElementById('calculateSavingsBtn');
        if (calcBtn) {
            calcBtn.addEventListener('click', function () {
                const target = Number(document.getElementById('calcTargetAmount').value || 0);
                const months = Number(document.getElementById('calcMonths').value || 0);
                const resultBox = document.getElementById('calcResultBox');
                const monthlyOut = document.getElementById('calcMonthlyOutput');
                const dailyOut = document.getElementById('calcDailyOutput');

                if (target <= 0 || months <= 0) {
                    alert('Masukkan nominal impian dan jangka waktu bulan yang valid.');
                    return;
                }

                const perMonth = Math.ceil(target / months);
                const perDay = Math.ceil(target / (months * 30));

                if (monthlyOut) monthlyOut.textContent = formatRupiah(perMonth) + ' / bulan';
                if (dailyOut) dailyOut.textContent = 'Atau sekitar ' + formatRupiah(perDay) + ' / hari';
                if (resultBox) resultBox.classList.remove('hidden');
            });
        }
    }

    async function renderSavingsPage() {
        const grid = document.getElementById('savingsGoalsGrid');
        if (!grid) return;

        const goals = await window.SmartDB.getAll(window.SmartDB.STORES.GOALS, false);
        const totalSaved = goals.reduce(function (sum, g) {
            return sum + Number(g.current_amount || 0);
        }, 0);
        const totalTarget = goals.reduce(function (sum, g) {
            return sum + Number(g.target_amount || 0);
        }, 0);
        const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

        const totalSavedEl = document.getElementById('savingsTotalSaved');
        const overallMetaEl = document.getElementById('savingsOverallMeta');
        const activeCountEl = document.getElementById('savingsActiveCount');
        const listCountEl = document.getElementById('goalsListCount');

        if (totalSavedEl) totalSavedEl.textContent = formatRupiah(totalSaved);
        if (overallMetaEl) overallMetaEl.textContent = overallPct + '% dari keseluruhan target';
        if (activeCountEl) activeCountEl.textContent = goals.length + ' Target';
        if (listCountEl) listCountEl.textContent = goals.length + ' target';

        if (goals.length === 0) {
            grid.innerHTML = '<article class="card">' +
                '<p class="text-muted">Belum ada target tabungan. Klik tombol <strong>"Target Baru"</strong> untuk mulai merencanakan tabungan Anda.</p>' +
                '</article>';
            return;
        }

        grid.innerHTML = goals.map(function (g) {
            const current = Number(g.current_amount || 0);
            const target = Number(g.target_amount || 0);
            const remaining = Math.max(0, target - current);
            const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            const isCompleted = current >= target && target > 0;
            const badgeText = isCompleted ? 'Tercapai' : pct + '%';

            return '<article class="card" style="display:flex; flex-direction:column; justify-content:space-between; gap:14px;">' +
                '<div>' +
                '<div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:10px;">' +
                '<div>' +
                '<h4 style="font-size:16px; font-weight:700; color:#0B2545; margin:0 0 4px 0;">' + escapeHtml(g.title) + '</h4>' +
                '<span class="text-muted" style="font-size:12px;">Target: ' + formatDateShort(g.deadline) + '</span>' +
                '</div>' +
                '<div style="display:flex; align-items:center; gap:6px;">' +
                '<span class="text-success font-bold" style="font-size:13px; background:rgba(31,166,106,0.12); padding:4px 10px; border-radius:999px;">' + badgeText + '</span>' +
                '<button type="button" class="icon-btn delete-goal-btn" data-uuid="' + escapeHtml(g.uuid) + '" data-title="' + escapeHtml(g.title) + '" title="Hapus Target">' +
                '<i data-lucide="trash-2"></i>' +
                '</button>' +
                '</div>' +
                '</div>' +
                '<div class="progress-track" style="margin-bottom:8px;">' +
                '<div class="progress-fill bg-success" style="width:' + pct + '%;"></div>' +
                '</div>' +
                '<div style="display:flex; justify-content:space-between; font-size:13px;">' +
                '<strong class="text-success">' + formatRupiah(current) + '</strong>' +
                '<span class="text-muted">dari ' + formatRupiah(target) + '</span>' +
                '</div>' +
                '<p class="card-subtext" style="margin:6px 0 0 0;">Sisa kebutuhan: ' + formatRupiah(remaining) + '</p>' +
                '</div>' +
                '<button type="button" class="btn btn-success btn-block open-deposit-goal-btn" data-uuid="' + escapeHtml(g.uuid) + '" data-title="' + escapeHtml(g.title) + '">' +
                '<i data-lucide="plus-circle"></i>' +
                '<span>Setor Dana</span>' +
                '</button>' +
                '</article>';
        }).join('');
    }

    // =========================================================================
    // POIN 6: HALAMAN BUDGET (ANGGARAN BULANAN PER KATEGORI)
    // =========================================================================
    function initBudgetPage() {
        const monthSelector = document.getElementById('budgetMonthSelector');
        if (monthSelector) {
            if (!monthSelector.value) {
                monthSelector.value = getCurrentMonthISO();
            }
            monthSelector.addEventListener('change', refreshAllViews);
        }

        document.addEventListener('click', async function (event) {
            if (event.target.closest('#openNewBudgetModal')) {
                const modal = document.getElementById('newBudgetModal');
                const modalMonth = document.getElementById('budgetMonthInput');
                const limitInput = document.getElementById('budgetLimitInput');
                if (modal) {
                    if (modalMonth) {
                        modalMonth.value = (monthSelector && monthSelector.value) ? monthSelector.value : getCurrentMonthISO();
                    }
                    if (limitInput) limitInput.value = '';
                    modal.classList.remove('hidden');
                    if (limitInput) setTimeout(function () { limitInput.focus(); }, 60);
                }
                return;
            }

            const editBtn = event.target.closest('.edit-budget-btn');
            if (editBtn) {
                const modal = document.getElementById('newBudgetModal');
                const catSelect = document.getElementById('budgetCategoryInput');
                const limitInput = document.getElementById('budgetLimitInput');
                const modalMonth = document.getElementById('budgetMonthInput');
                if (modal) {
                    const cat = normalizeCategoryName(editBtn.getAttribute('data-category'));
                    if (catSelect) catSelect.value = cat;
                    if (limitInput) limitInput.value = editBtn.getAttribute('data-limit') || '';
                    if (modalMonth) {
                        modalMonth.value = editBtn.getAttribute('data-month') || getCurrentMonthISO();
                    }
                    modal.classList.remove('hidden');
                    if (limitInput) setTimeout(function () { limitInput.focus(); }, 60);
                }
                return;
            }

            if (event.target.closest('#closeNewBudgetModal') || event.target.id === 'newBudgetModal') {
                const modal = document.getElementById('newBudgetModal');
                if (modal) modal.classList.add('hidden');
                return;
            }

            const deleteBtn = event.target.closest('.delete-budget-btn');
            if (deleteBtn) {
                const uuid = deleteBtn.getAttribute('data-uuid');
                const catName = deleteBtn.getAttribute('data-category') || 'kategori ini';
                if (uuid && window.confirm('Hapus batas anggaran untuk kategori "' + catName + '"?')) {
                    await window.SmartDB.deleteBudget(uuid);
                    await refreshAllViews();
                }
            }
        });

        const newBudgetForm = document.getElementById('newBudgetForm');
        if (newBudgetForm) {
            newBudgetForm.addEventListener('submit', async function (event) {
                event.preventDefault();
                if (!window.SmartDB) return;

                const category = normalizeCategoryName(document.getElementById('budgetCategoryInput').value);
                const limitAmount = Number(document.getElementById('budgetLimitInput').value || 0);
                const monthYear = document.getElementById('budgetMonthInput').value || getCurrentMonthISO();

                if (limitAmount <= 0) {
                    alert('Masukkan batas maksimal anggaran lebih besar dari Rp 0.');
                    return;
                }

                await window.SmartDB.saveBudget({
                    category: category,
                    limit_amount: limitAmount,
                    month_year: monthYear
                });

                if (monthSelector) {
                    monthSelector.value = monthYear;
                }

                newBudgetForm.reset();
                const modal = document.getElementById('newBudgetModal');
                if (modal) modal.classList.add('hidden');
                await refreshAllViews();
            });
        }
    }

    async function renderBudgetPage() {
        const listContainer = document.getElementById('budgetListContainer');
        if (!listContainer) return;

        const monthSelector = document.getElementById('budgetMonthSelector');
        if (monthSelector && !monthSelector.value) {
            monthSelector.value = getCurrentMonthISO();
        }
        const selectedMonth = (monthSelector && monthSelector.value) ? monthSelector.value : getCurrentMonthISO();

        const results = await Promise.all([
            window.SmartDB.getAll(window.SmartDB.STORES.BUDGETS, false),
            window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false)
        ]);

        const allBudgets = results[0];
        const allTransactions = results[1];

        const monthBudgets = allBudgets.filter(function (b) {
            return b.month_year === selectedMonth;
        });

        const spentByCategory = {};
        allTransactions.forEach(function (tx) {
            if (tx.type !== 'expense' || tx.is_transfer) return;
            if (String(tx.transaction_date || '').slice(0, 7) !== selectedMonth) return;
            const cat = normalizeCategoryName(tx.category);
            spentByCategory[cat] = (spentByCategory[cat] || 0) + Number(tx.amount || 0);
        });

        let totalLimit = 0;
        let totalSpent = 0;

        monthBudgets.forEach(function (b) {
            const cat = normalizeCategoryName(b.category);
            totalLimit += Number(b.limit_amount || 0);
            totalSpent += Number(spentByCategory[cat] || 0);
        });

        const remainingTotal = totalLimit - totalSpent;
        const overallPct = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;
        const barWidth = Math.min(100, overallPct);

        const totalLimitEl = document.getElementById('budgetTotalLimit');
        const remainingMetaEl = document.getElementById('budgetRemainingMeta');
        const totalSpentEl = document.getElementById('budgetTotalSpent');
        const usagePctLabelEl = document.getElementById('budgetUsagePctLabel');
        const overallBarEl = document.getElementById('budgetOverallProgressBar');
        const categoryCountEl = document.getElementById('budgetCategoryCount');

        if (totalLimitEl) totalLimitEl.textContent = formatRupiah(totalLimit);
        if (remainingMetaEl) {
            remainingMetaEl.textContent = remainingTotal >= 0
                ? 'Sisa anggaran tersedia: ' + formatRupiah(remainingTotal)
                : 'Melebihi batas sebesar: ' + formatRupiah(Math.abs(remainingTotal));
        }
        if (totalSpentEl) totalSpentEl.textContent = formatRupiah(totalSpent);
        if (categoryCountEl) categoryCountEl.textContent = monthBudgets.length + ' kategori';

        let overallColor = '#1FA66A';
        if (overallPct >= 100) overallColor = '#DC2626';
        else if (overallPct >= 80) overallColor = '#F59E0B';

        if (usagePctLabelEl) {
            usagePctLabelEl.textContent = overallPct + '%';
            usagePctLabelEl.style.color = overallColor;
        }
        if (overallBarEl) {
            overallBarEl.style.width = barWidth + '%';
            overallBarEl.style.backgroundColor = overallColor;
        }

        if (monthBudgets.length === 0) {
            listContainer.innerHTML = '<article class="card">' +
                '<p class="text-muted">Belum ada batas anggaran diatur untuk bulan ini. Klik tombol <strong>"Atur Anggaran"</strong> untuk mulai menetapkan batas pengeluaran.</p>' +
                '</article>';
            return;
        }

        listContainer.innerHTML = monthBudgets.map(function (b) {
            const cat = normalizeCategoryName(b.category);
            const limit = Number(b.limit_amount || 0);
            const spent = Number(spentByCategory[cat] || 0);
            const sisa = limit - spent;
            const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            const fillWidth = Math.min(100, pct);

            let statusColor = '#1FA66A';
            let statusBg = 'rgba(31,166,106,0.12)';
            let statusText = 'Aman (' + pct + '%)';

            if (pct >= 100) {
                statusColor = '#DC2626';
                statusBg = 'rgba(220,38,38,0.12)';
                statusText = 'Melebihi Batas (' + pct + '%)';
            } else if (pct >= 80) {
                statusColor = '#D97706';
                statusBg = 'rgba(245,158,11,0.15)';
                statusText = 'Hampir Penuh (' + pct + '%)';
            }

            const sisaLabel = sisa >= 0
                ? 'Sisa: ' + formatRupiah(sisa)
                : 'Over: ' + formatRupiah(Math.abs(sisa));

            return '<article class="card" style="margin-bottom:12px;">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap;">' +
                '<div style="display:flex; align-items:center; gap:10px;">' +
                '<h4 style="font-size:16px; font-weight:700; color:#0B2545; margin:0;">' + escapeHtml(cat) + '</h4>' +
                '<span style="font-size:12px; font-weight:700; color:' + statusColor + '; background:' + statusBg + '; padding:3px 10px; border-radius:999px;">' + statusText + '</span>' +
                '</div>' +
                '<div style="display:flex; align-items:center; gap:6px;">' +
                '<button type="button" class="icon-btn edit-budget-btn" data-category="' + escapeHtml(cat) + '" data-limit="' + limit + '" data-month="' + escapeHtml(b.month_year) + '" title="Ubah Anggaran">' +
                '<i data-lucide="pencil"></i>' +
                '</button>' +
                '<button type="button" class="icon-btn delete-budget-btn" data-uuid="' + escapeHtml(b.uuid) + '" data-category="' + escapeHtml(cat) + '" title="Hapus Anggaran">' +
                '<i data-lucide="trash-2"></i>' +
                '</button>' +
                '</div>' +
                '</div>' +
                '<div class="progress-track" style="margin-bottom:8px;">' +
                '<div class="progress-fill" style="width:' + fillWidth + '%; background-color:' + statusColor + ';"></div>' +
                '</div>' +
                '<div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; flex-wrap:wrap; gap:6px;">' +
                '<span>Terpakai: <strong style="color:' + statusColor + ';">' + formatRupiah(spent) + '</strong> dari <strong>' + formatRupiah(limit) + '</strong></span>' +
                '<span class="text-muted font-bold">' + sisaLabel + '</span>' +
                '</div>' +
                '</article>';
        }).join('');
    }

    // =========================================================================
    // POIN 7: HALAMAN HISTORY (RIWAYAT LENGKAP, FILTER, EDIT & HAPUS)
    // =========================================================================
    function initHistoryPage() {
        const searchInput = document.getElementById('historySearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', refreshAllViews);
        }

        ['historyTypeFilter', 'historyCategoryFilter', 'historyWalletFilter', 'historyMonthFilter'].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', refreshAllViews);
            }
        });

        const resetBtn = document.getElementById('resetHistoryFilterBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                if (searchInput) searchInput.value = '';
                const typeEl = document.getElementById('historyTypeFilter');
                const catEl = document.getElementById('historyCategoryFilter');
                const walletEl = document.getElementById('historyWalletFilter');
                const monthEl = document.getElementById('historyMonthFilter');
                if (typeEl) typeEl.value = 'all';
                if (catEl) catEl.value = 'all';
                if (walletEl) walletEl.value = 'all';
                if (monthEl) monthEl.value = '';
                refreshAllViews();
            });
        }

        document.addEventListener('click', async function (event) {
            const editCard = event.target.closest('.history-tx-item');
            if (editCard) {
                const uuid = editCard.getAttribute('data-uuid');
                if (!uuid || !window.SmartDB) return;

                const tx = await window.SmartDB.getById(window.SmartDB.STORES.TRANSACTIONS, uuid);
                if (!tx) return;

                await populateWalletDropdowns();

                const modal = document.getElementById('editTxModal');
                if (!modal) return;

                document.getElementById('editTxUuid').value = tx.uuid;
                document.getElementById('editTxType').value = tx.type === 'income' ? 'income' : 'expense';
                document.getElementById('editTxAmount').value = Number(tx.amount || 0);
                document.getElementById('editTxCategory').value = mapCategoryToHistoryOption(tx.category);
                document.getElementById('editTxWallet').value = tx.wallet_uuid;
                document.getElementById('editTxDate').value = tx.transaction_date || getTodayISO();
                document.getElementById('editTxNote').value = tx.note || '';

                modal.classList.remove('hidden');
                return;
            }

            if (event.target.closest('#closeEditTxModal') || event.target.id === 'editTxModal') {
                const modal = document.getElementById('editTxModal');
                if (modal) modal.classList.add('hidden');
                return;
            }

            if (event.target.closest('#deleteTxBtn')) {
                const uuid = document.getElementById('editTxUuid').value;
                if (!uuid || !window.SmartDB) return;

                if (window.confirm('Hapus catatan transaksi ini? Saldo dompet terkait akan otomatis disesuaikan kembali.')) {
                    await window.SmartDB.deleteTransaction(uuid);
                    const modal = document.getElementById('editTxModal');
                    if (modal) modal.classList.add('hidden');
                    await refreshAllViews();
                }
            }
        });

        const editTxForm = document.getElementById('editTxForm');
        if (editTxForm) {
            editTxForm.addEventListener('submit', async function (event) {
                event.preventDefault();
                if (!window.SmartDB) return;

                const uuid = document.getElementById('editTxUuid').value;
                const type = document.getElementById('editTxType').value;
                const amount = Number(document.getElementById('editTxAmount').value || 0);
                const category = normalizeCategoryName(document.getElementById('editTxCategory').value);
                const walletUuid = document.getElementById('editTxWallet').value;
                const txDate = document.getElementById('editTxDate').value || getTodayISO();
                const note = document.getElementById('editTxNote').value.trim();

                if (amount <= 0) {
                    alert('Masukkan nominal transaksi lebih besar dari Rp 0.');
                    return;
                }

                await window.SmartDB.saveTransaction({
                    uuid: uuid,
                    type: type,
                    amount: amount,
                    category: category,
                    wallet_uuid: walletUuid,
                    transaction_date: txDate,
                    note: note
                });

                const modal = document.getElementById('editTxModal');
                if (modal) modal.classList.add('hidden');
                await refreshAllViews();
            });
        }
    }

    async function renderHistoryPage(walletMap) {
        const listContainer = document.getElementById('historyListContainer');
        if (!listContainer) return;

        const keyword = ((document.getElementById('historySearchInput') || {}).value || '').trim().toLowerCase();
        const typeFilter = (document.getElementById('historyTypeFilter') || {}).value || 'all';
        const catFilter = (document.getElementById('historyCategoryFilter') || {}).value || 'all';
        const walletFilter = (document.getElementById('historyWalletFilter') || {}).value || 'all';
        const monthFilter = (document.getElementById('historyMonthFilter') || {}).value || '';

        const allTransactions = await window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false);

        const filtered = allTransactions.filter(function (tx) {
            if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
            if (catFilter !== 'all' && normalizeCategoryName(tx.category) !== normalizeCategoryName(catFilter)) return false;
            if (walletFilter !== 'all' && tx.wallet_uuid !== walletFilter) return false;
            if (monthFilter && String(tx.transaction_date || '').slice(0, 7) !== monthFilter) return false;
            if (keyword) {
                const wName = walletMap[tx.wallet_uuid] || '';
                const hay = (String(tx.note || '') + ' ' + String(tx.category || '') + ' ' + wName).toLowerCase();
                if (hay.indexOf(keyword) === -1) return false;
            }
            return true;
        }).sort(function (a, b) {
            if (a.transaction_date === b.transaction_date) {
                return String(b.updated_at).localeCompare(String(a.updated_at));
            }
            return String(b.transaction_date).localeCompare(String(a.transaction_date));
        });

        let totalIncome = 0;
        let totalExpense = 0;
        filtered.forEach(function (tx) {
            if (tx.is_transfer) return;
            if (tx.type === 'income') totalIncome += Number(tx.amount || 0);
            else if (tx.type === 'expense') totalExpense += Number(tx.amount || 0);
        });

        const incEl = document.getElementById('historyTotalIncome');
        const expEl = document.getElementById('historyTotalExpense');
        const countEl = document.getElementById('historyResultCount');

        if (incEl) incEl.textContent = formatRupiah(totalIncome);
        if (expEl) expEl.textContent = formatRupiah(totalExpense);
        if (countEl) countEl.textContent = filtered.length + ' transaksi ditampilkan';

        if (filtered.length === 0) {
            listContainer.innerHTML = '<p class="text-muted">Tidak ada catatan transaksi yang sesuai filter. Klik <strong>"Tambah Transaksi"</strong> untuk mencatat atau tekan <strong>"Reset"</strong>.</p>';
            return;
        }

        listContainer.innerHTML = filtered.map(function (tx) {
            const isInc = tx.type === 'income';
            const sign = isInc ? '+' : '-';
            const amountColor = isInc ? '#1FA66A' : '#DC2626';
            const iconBg = isInc ? 'rgba(31,166,106,0.12)' : 'rgba(220,38,38,0.10)';
            const iconName = tx.is_transfer ? 'repeat' : (isInc ? 'arrow-down-left' : 'arrow-up-right');
            const wName = walletMap[tx.wallet_uuid] || 'Dompet';
            const title = tx.note ? escapeHtml(tx.note) : escapeHtml(tx.category);
            const transferBadge = tx.is_transfer
                ? '<span style="font-size:11px; background:#E2E8F0; color:#334155; padding:2px 7px; border-radius:999px; margin-left:6px;">Transfer</span>'
                : '';

            return '<div class="history-tx-item" data-uuid="' + escapeHtml(tx.uuid) + '" role="button" tabindex="0" title="Klik untuk mengubah atau menghapus transaksi" style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 14px; border:1px solid #E2E8F0; border-radius:12px; background:#FFFFFF; margin-bottom:10px; cursor:pointer;">' +
                '<div style="display:flex; align-items:center; gap:12px; min-width:0;">' +
                '<div style="width:40px; height:40px; border-radius:10px; background:' + iconBg + '; color:' + amountColor + '; display:flex; align-items:center; justify-content:center; flex-shrink:0;">' +
                '<i data-lucide="' + iconName + '"></i>' +
                '</div>' +
                '<div style="min-width:0;">' +
                '<div style="font-weight:600; color:#0B2545; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + title + transferBadge + '</div>' +
                '<div class="text-muted" style="font-size:12px;">' + escapeHtml(tx.category) + ' • ' + escapeHtml(wName) + ' • ' + formatDateShort(tx.transaction_date) + '</div>' +
                '</div>' +
                '</div>' +
                '<div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">' +
                '<span class="font-bold" style="font-size:14px; color:' + amountColor + ';">' + sign + formatRupiah(tx.amount) + '</span>' +
                '<i data-lucide="chevron-right" style="width:16px; height:16px; color:#94A3B8;"></i>' +
                '</div>' +
                '</div>';
        }).join('');
    }

    // =========================================================================
    // POIN 8: HALAMAN REPORT (LAPORAN KEUANGAN, GRAFIK & EKSPOR EXCEL / PDF)
    // =========================================================================
    function initReportPage() {
        const monthInput = document.getElementById('reportMonthFilter');
        if (monthInput) {
            if (!monthInput.value) {
                monthInput.value = getCurrentMonthISO();
            }
            monthInput.addEventListener('change', refreshAllViews);
        }

        const walletFilter = document.getElementById('reportWalletFilter');
        if (walletFilter) {
            walletFilter.addEventListener('change', refreshAllViews);
        }

        const applyBtn = document.getElementById('applyReportFilterBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', refreshAllViews);
        }

        const exportExcelBtn = document.getElementById('exportExcelBtn');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', exportReportToCSV);
        }

        const exportPdfBtn = document.getElementById('exportPdfBtn');
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', exportReportToPDF);
        }
    }

    async function getFilteredReportData() {
        const monthInput = document.getElementById('reportMonthFilter');
        const selectedMonth = (monthInput && monthInput.value) ? monthInput.value : getCurrentMonthISO();
        const selectedWallet = (document.getElementById('reportWalletFilter') || {}).value || 'all';

        const results = await Promise.all([
            window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false),
            window.SmartDB.getAll(window.SmartDB.STORES.WALLETS, false)
        ]);
        const allTransactions = results[0];
        const wallets = results[1];
        const walletMap = {};
        wallets.forEach(function (w) {
            walletMap[w.uuid] = w.name;
        });

        const periodTransactions = allTransactions.filter(function (tx) {
            if (tx.is_transfer) return false;
            if (String(tx.transaction_date || '').slice(0, 7) !== selectedMonth) return false;
            if (selectedWallet !== 'all' && tx.wallet_uuid !== selectedWallet) return false;
            return true;
        }).sort(function (a, b) {
            return String(b.transaction_date).localeCompare(String(a.transaction_date));
        });

        return {
            selectedMonth: selectedMonth,
            selectedWallet: selectedWallet,
            walletLabel: selectedWallet === 'all' ? 'Semua Dompet' : (walletMap[selectedWallet] || 'Dompet'),
            walletMap: walletMap,
            allTransactions: allTransactions,
            periodTransactions: periodTransactions
        };
    }

    async function exportReportToCSV() {
        if (!window.SmartDB) return;
        const data = await getFilteredReportData();
        const lines = [];
        lines.push('LAPORAN KEUANGAN SMART FINANCE');
        lines.push('Periode;' + formatMonthLabelID(data.selectedMonth));
        lines.push('Dompet;' + data.walletLabel);
        lines.push('');
        lines.push('Tanggal;Jenis;Kategori;Dompet;Catatan;Nominal (Rp)');

        data.periodTransactions.forEach(function (tx) {
            const jenis = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
            const wName = (data.walletMap[tx.wallet_uuid] || 'Dompet').replace(/;/g, ',');
            const note = String(tx.note || '-').replace(/;/g, ',').replace(/\r?\n/g, ' ');
            const cat = normalizeCategoryName(tx.category).replace(/;/g, ',');
            lines.push([
                tx.transaction_date,
                jenis,
                cat,
                wName,
                note,
                Number(tx.amount || 0)
            ].join(';'));
        });

        const csvContent = '\uFEFF' + lines.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Laporan_SmartFinance_' + data.selectedMonth + '.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    async function exportReportToPDF() {
        if (!window.SmartDB) return;
        const data = await getFilteredReportData();

        let totalIncome = 0;
        let totalExpense = 0;
        data.periodTransactions.forEach(function (tx) {
            if (tx.type === 'income') totalIncome += Number(tx.amount || 0);
            else if (tx.type === 'expense') totalExpense += Number(tx.amount || 0);
        });
        const netCashflow = totalIncome - totalExpense;

        const rowsHtml = data.periodTransactions.length === 0
            ? '<tr><td colspan="5" style="text-align:center;color:#64748B;">Tidak ada transaksi pada periode ini.</td></tr>'
            : data.periodTransactions.map(function (tx) {
                const isInc = tx.type === 'income';
                const color = isInc ? '#1FA66A' : '#DC2626';
                const sign = isInc ? '+' : '-';
                return '<tr>' +
                    '<td>' + escapeHtml(formatDateShort(tx.transaction_date)) + '</td>' +
                    '<td>' + escapeHtml(normalizeCategoryName(tx.category)) + '</td>' +
                    '<td>' + escapeHtml(data.walletMap[tx.wallet_uuid] || 'Dompet') + '</td>' +
                    '<td>' + escapeHtml(tx.note || '-') + '</td>' +
                    '<td style="text-align:right;font-weight:700;color:' + color + ';">' + sign + formatRupiah(tx.amount) + '</td>' +
                    '</tr>';
            }).join('');

        const printWin = window.open('', '_blank', 'width=900,height=700');
        if (!printWin) {
            window.print();
            return;
        }

        printWin.document.write(
            '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">' +
            '<title>Laporan Keuangan — ' + escapeHtml(formatMonthLabelID(data.selectedMonth)) + '</title>' +
            '<style>' +
            'body{font-family:Arial,sans-serif;color:#0F172A;padding:28px;line-height:1.5;}' +
            '.top{border-bottom:3px solid #0B2545;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-end;}' +
            '.brand{font-size:20px;font-weight:800;color:#0B2545;}' +
            '.kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px;}' +
            '.box{border:1px solid #CBD5E1;border-radius:10px;padding:12px;}' +
            '.lbl{font-size:12px;color:#475569;display:block;margin-bottom:4px;}' +
            '.val{font-size:18px;font-weight:800;}' +
            'table{width:100%;border-collapse:collapse;font-size:13px;}' +
            'th,td{border-bottom:1px solid #E2E8F0;padding:9px 8px;text-align:left;}' +
            'th{background:#F1F5F9;color:#0B2545;}' +
            '</style></head><body>' +
            '<div class="top"><div><div class="brand">SMART FINANCE</div><div>Laporan Keuangan Bulanan</div></div>' +
            '<div style="text-align:right;font-size:13px;"><strong>Periode:</strong> ' + escapeHtml(formatMonthLabelID(data.selectedMonth)) + '<br><strong>Dompet:</strong> ' + escapeHtml(data.walletLabel) + '</div></div>' +
            '<div class="kpi">' +
            '<div class="box"><span class="lbl">Total Pemasukan</span><div class="val" style="color:#1FA66A;">' + formatRupiah(totalIncome) + '</div></div>' +
            '<div class="box"><span class="lbl">Total Pengeluaran</span><div class="val" style="color:#DC2626;">' + formatRupiah(totalExpense) + '</div></div>' +
            '<div class="box"><span class="lbl">Selisih Arus Kas Bersih</span><div class="val" style="color:' + (netCashflow >= 0 ? '#1FA66A' : '#DC2626') + ';">' + (netCashflow < 0 ? '-' : '') + formatRupiah(Math.abs(netCashflow)) + '</div></div>' +
            '</div>' +
            '<h3 style="color:#0B2545;margin-bottom:10px;">Rincian Transaksi</h3>' +
            '<table><thead><tr><th>Tanggal</th><th>Kategori</th><th>Dompet</th><th>Catatan</th><th style="text-align:right;">Nominal</th></tr></thead>' +
            '<tbody>' + rowsHtml + '</tbody></table>' +
            '<scr' + 'ipt>window.onload=function(){window.print();};</scr' + 'ipt>' +
            '</body></html>'
        );
        printWin.document.close();
    }

    function renderReportCharts(allTransactions, selectedMonth, selectedWallet, expenseByCategory, totalExpense) {
        if (typeof window.Chart === 'undefined') return;

        const trendCanvas = document.getElementById('reportTrendChart');
        if (trendCanvas) {
            const existingTrend = window.Chart.getChart(trendCanvas);
            if (existingTrend) existingTrend.destroy();

            const months = getLastSixMonths(selectedMonth);
            const incomeSeries = months.map(function (m) {
                return allTransactions.reduce(function (sum, tx) {
                    if (tx.is_transfer || tx.type !== 'income') return sum;
                    if (String(tx.transaction_date || '').slice(0, 7) !== m) return sum;
                    if (selectedWallet !== 'all' && tx.wallet_uuid !== selectedWallet) return sum;
                    return sum + Number(tx.amount || 0);
                }, 0);
            });
            const expenseSeries = months.map(function (m) {
                return allTransactions.reduce(function (sum, tx) {
                    if (tx.is_transfer || tx.type !== 'expense') return sum;
                    if (String(tx.transaction_date || '').slice(0, 7) !== m) return sum;
                    if (selectedWallet !== 'all' && tx.wallet_uuid !== selectedWallet) return sum;
                    return sum + Number(tx.amount || 0);
                }, 0);
            });

            new window.Chart(trendCanvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: months.map(formatMonthShortID),
                    datasets: [
                        {
                            label: 'Pemasukan',
                            data: incomeSeries,
                            backgroundColor: '#1FA66A',
                            borderRadius: 6
                        },
                        {
                            label: 'Pengeluaran',
                            data: expenseSeries,
                            backgroundColor: '#DC2626',
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function (val) {
                                    return 'Rp ' + Number(val).toLocaleString('id-ID');
                                }
                            }
                        }
                    }
                }
            });
        }

        const donutCanvas = document.getElementById('reportCategoryDonutChart');
        const legendListEl = document.getElementById('reportCategoryLegend');
        if (donutCanvas) {
            const existingDonut = window.Chart.getChart(donutCanvas);
            if (existingDonut) existingDonut.destroy();

            const entries = Object.keys(expenseByCategory)
                .map(function (cat) {
                    return { category: cat, amount: expenseByCategory[cat] };
                })
                .sort(function (a, b) {
                    return b.amount - a.amount;
                });

            if (entries.length === 0 || totalExpense <= 0) {
                new window.Chart(donutCanvas.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: ['Belum ada data'],
                        datasets: [{
                            data: [1],
                            backgroundColor: ['#E2E8F0'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '68%',
                        plugins: { legend: { display: false }, tooltip: { enabled: false } }
                    }
                });
                if (legendListEl) {
                    legendListEl.innerHTML = '<li><span>Belum ada data</span><strong>0%</strong></li>';
                }
            } else {
                const labels = entries.map(function (e) { return e.category; });
                const values = entries.map(function (e) { return e.amount; });
                const colors = entries.map(function (_, idx) { return CHART_PALETTE[idx % CHART_PALETTE.length]; });

                new window.Chart(donutCanvas.getContext('2d'), {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: values,
                            backgroundColor: colors,
                            borderWidth: 2,
                            borderColor: '#FFFFFF'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '68%',
                        plugins: { legend: { display: false } }
                    }
                });

                if (legendListEl) {
                    legendListEl.innerHTML = entries.map(function (item, idx) {
                        const pct = Math.round((item.amount / totalExpense) * 100);
                        const color = CHART_PALETTE[idx % CHART_PALETTE.length];
                        return '<li>' +
                            '<span style="display:flex;align-items:center;gap:8px;">' +
                            '<i style="width:10px;height:10px;border-radius:50%;background:' + color + ';display:inline-block;"></i>' +
                            escapeHtml(item.category) +
                            '</span>' +
                            '<strong>' + pct + '%</strong>' +
                            '</li>';
                    }).join('');
                }
            }
        }
    }

    async function renderReportPage() {
        const incEl = document.getElementById('reportTotalIncome');
        const expEl = document.getElementById('reportTotalExpense');
        const netEl = document.getElementById('reportNetCashflow');
        if (!incEl || !expEl || !netEl) return;

        const monthInput = document.getElementById('reportMonthFilter');
        if (monthInput && !monthInput.value) {
            monthInput.value = getCurrentMonthISO();
        }

        const data = await getFilteredReportData();
        let totalIncome = 0;
        let totalExpense = 0;
        let incomeCount = 0;
        let expenseCount = 0;

        const expenseByCategory = {};
        const groupMap = {};

        data.periodTransactions.forEach(function (tx) {
            const cat = normalizeCategoryName(tx.category);
            const amt = Number(tx.amount || 0);
            if (tx.type === 'income') {
                totalIncome += amt;
                incomeCount += 1;
            } else if (tx.type === 'expense') {
                totalExpense += amt;
                expenseCount += 1;
                expenseByCategory[cat] = (expenseByCategory[cat] || 0) + amt;
            }

            const key = tx.type + '__' + cat;
            if (!groupMap[key]) {
                groupMap[key] = {
                    category: cat,
                    type: tx.type,
                    count: 0,
                    total: 0
                };
            }
            groupMap[key].count += 1;
            groupMap[key].total += amt;
        });

        const netCashflow = totalIncome - totalExpense;
        const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netCashflow / totalIncome) * 100)) : 0;
        const periodLabel = formatMonthLabelID(data.selectedMonth);

        incEl.textContent = formatRupiah(totalIncome);
        expEl.textContent = formatRupiah(totalExpense);
        netEl.textContent = (netCashflow < 0 ? '-' : '') + formatRupiah(Math.abs(netCashflow));
        netEl.style.color = netCashflow >= 0 ? '#1FA66A' : '#DC2626';

        const incMeta = document.getElementById('reportIncomeMeta');
        const expMeta = document.getElementById('reportExpenseMeta');
        const rateMeta = document.getElementById('reportSavingsRateMeta');
        if (incMeta) incMeta.textContent = incomeCount + ' transaksi • ' + periodLabel;
        if (expMeta) expMeta.textContent = expenseCount + ' transaksi • ' + periodLabel;
        if (rateMeta) rateMeta.textContent = 'Rasio tabungan: ' + savingsRate + '%';

        const tableBody = document.getElementById('reportCategoryTableBody');
        const summaryCountEl = document.getElementById('reportCategorySummaryCount');
        const groupedRows = Object.values(groupMap).sort(function (a, b) {
            return b.total - a.total;
        });

        if (summaryCountEl) {
            summaryCountEl.textContent = groupedRows.length + ' kategori tercatat';
        }

        if (tableBody) {
            if (groupedRows.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-muted">Belum ada data transaksi pada periode yang dipilih.</td></tr>';
            } else {
                tableBody.innerHTML = groupedRows.map(function (row) {
                    const isInc = row.type === 'income';
                    const baseTotal = isInc ? totalIncome : totalExpense;
                    const sharePct = baseTotal > 0 ? Math.round((row.total / baseTotal) * 100) : 0;
                    const badgeColor = isInc ? '#1FA66A' : '#DC2626';
                    const badgeBg = isInc ? 'rgba(31,166,106,0.12)' : 'rgba(220,38,38,0.10)';
                    const typeLabel = isInc ? 'Pemasukan' : 'Pengeluaran';

                    return '<tr>' +
                        '<td><strong>' + escapeHtml(row.category) + '</strong></td>' +
                        '<td><span style="font-size:12px;font-weight:700;color:' + badgeColor + ';background:' + badgeBg + ';padding:3px 9px;border-radius:999px;">' + typeLabel + '</span></td>' +
                        '<td class="text-muted">' + row.count + ' transaksi</td>' +
                        '<td class="text-right font-bold" style="color:' + badgeColor + ';">' + formatRupiah(row.total) + '</td>' +
                        '<td class="text-right font-bold">' + sharePct + '%</td>' +
                        '</tr>';
                }).join('');
            }
        }

        renderReportCharts(data.allTransactions, data.selectedMonth, data.selectedWallet, expenseByCategory, totalExpense);
    }

    // =========================================================================
    // POIN 9: HALAMAN WALLET (MANAJEMEN MULTI-DOMPET, UBAH SALDO & TRANSFER)
    // =========================================================================
    function ensureWalletEditHiddenInput(formEl) {
        if (!formEl) return null;
        let hiddenEl = document.getElementById('walletEditUuidInput');
        if (!hiddenEl) {
            hiddenEl = document.createElement('input');
            hiddenEl.type = 'hidden';
            hiddenEl.id = 'walletEditUuidInput';
            hiddenEl.name = 'uuid';
            formEl.prepend(hiddenEl);
        }
        return hiddenEl;
    }

    function initWalletPage() {
        const newWalletForm = document.getElementById('newWalletForm');
        const editUuidInput = ensureWalletEditHiddenInput(newWalletForm);

        document.addEventListener('click', async function (event) {
            if (event.target.closest('#openNewWalletModal')) {
                const modal = document.getElementById('newWalletModal');
                const titleEl = document.getElementById('newWalletModalTitle');
                const nameInput = document.getElementById('walletNameInput');
                const typeInput = document.getElementById('walletTypeInput');
                const balInput = document.getElementById('walletBalanceInput');
                if (modal) {
                    if (editUuidInput) editUuidInput.value = '';
                    if (titleEl) titleEl.textContent = 'Tambah Dompet Baru';
                    if (nameInput) nameInput.value = '';
                    if (typeInput) typeInput.value = 'cash';
                    if (balInput) balInput.value = '0';
                    modal.classList.remove('hidden');
                    if (nameInput) setTimeout(function () { nameInput.focus(); }, 60);
                }
                return;
            }

            const editWalletBtn = event.target.closest('.edit-wallet-btn');
            if (editWalletBtn) {
                const uuid = editWalletBtn.getAttribute('data-uuid');
                if (!uuid || !window.SmartDB) return;

                const wallet = await window.SmartDB.getById(window.SmartDB.STORES.WALLETS, uuid);
                if (!wallet) return;

                const modal = document.getElementById('newWalletModal');
                const titleEl = document.getElementById('newWalletModalTitle');
                const nameInput = document.getElementById('walletNameInput');
                const typeInput = document.getElementById('walletTypeInput');
                const balInput = document.getElementById('walletBalanceInput');
                if (modal) {
                    if (editUuidInput) editUuidInput.value = wallet.uuid;
                    if (titleEl) titleEl.textContent = 'Ubah Dompet & Saldo';
                    if (nameInput) nameInput.value = wallet.name || '';
                    if (typeInput) typeInput.value = wallet.type || 'cash';
                    if (balInput) balInput.value = Number(wallet.balance || 0);
                    modal.classList.remove('hidden');
                    if (nameInput) setTimeout(function () { nameInput.focus(); }, 60);
                }
                return;
            }

            if (event.target.closest('#closeNewWalletModal') || event.target.id === 'newWalletModal') {
                const modal = document.getElementById('newWalletModal');
                if (modal) modal.classList.add('hidden');
                return;
            }

            if (event.target.closest('#openTransferModal')) {
                const modal = document.getElementById('transferWalletModal');
                const amountInput = document.getElementById('transferAmountInput');
                if (modal) {
                    await populateWalletDropdowns();
                    const fromSel = document.getElementById('transferFromSelect');
                    const toSel = document.getElementById('transferToSelect');
                    if (fromSel && toSel && fromSel.options.length > 1 && fromSel.value === toSel.value) {
                        toSel.selectedIndex = 1;
                    }
                    modal.classList.remove('hidden');
                    if (amountInput) setTimeout(function () { amountInput.focus(); }, 60);
                }
                return;
            }

            if (event.target.closest('#closeTransferModal') || event.target.id === 'transferWalletModal') {
                const modal = document.getElementById('transferWalletModal');
                if (modal) modal.classList.add('hidden');
            }
        });

        if (newWalletForm) {
            newWalletForm.addEventListener('submit', async function (event) {
                event.preventDefault();
                if (!window.SmartDB) return;

                const uuid = editUuidInput ? editUuidInput.value.trim() : '';
                const name = document.getElementById('walletNameInput').value.trim();
                const type = document.getElementById('walletTypeInput').value || 'cash';
                const balance = Number(document.getElementById('walletBalanceInput').value || 0);

                if (!name) {
                    alert('Masukkan nama dompet atau rekening.');
                    return;
                }

                await window.SmartDB.saveWallet({
                    uuid: uuid || undefined,
                    name: name,
                    type: type,
                    balance: balance
                });

                if (editUuidInput) editUuidInput.value = '';
                newWalletForm.reset();
                const modal = document.getElementById('newWalletModal');
                if (modal) modal.classList.add('hidden');
                await refreshAllViews();
            });
        }

        const transferForm = document.getElementById('transferWalletForm');
        if (transferForm) {
            transferForm.addEventListener('submit', async function (event) {
                event.preventDefault();
                if (!window.SmartDB) return;

                const fromUuid = document.getElementById('transferFromSelect').value;
                const toUuid = document.getElementById('transferToSelect').value;
                const amount = Number(document.getElementById('transferAmountInput').value || 0);
                const note = document.getElementById('transferNoteInput').value.trim();

                if (!fromUuid || !toUuid || fromUuid === toUuid) {
                    alert('Pilih dompet asal dan dompet tujuan yang berbeda.');
                    return;
                }

                if (amount <= 0) {
                    alert('Masukkan nominal transfer lebih besar dari Rp 0.');
                    return;
                }

                try {
                    await window.SmartDB.transferBetweenWallets(fromUuid, toUuid, amount, note);
                    transferForm.reset();
                    const modal = document.getElementById('transferWalletModal');
                    if (modal) modal.classList.add('hidden');
                    await refreshAllViews();
                } catch (err) {
                    alert(err.message || 'Gagal memproses transfer antar dompet.');
                }
            });
        }
    }

    async function renderWalletPage() {
        const grid = document.getElementById('walletsGridContainer');
        if (!grid) return;

        const wallets = await window.SmartDB.getAll(window.SmartDB.STORES.WALLETS, false);
        const totalBalance = wallets.reduce(function (sum, w) {
            return sum + Number(w.balance || 0);
        }, 0);

        const totalEl = document.getElementById('walletTotalBalance');
        const activeCountEl = document.getElementById('walletActiveCount');
        const listCountEl = document.getElementById('walletListCount');

        if (totalEl) totalEl.textContent = formatRupiah(totalBalance);
        if (activeCountEl) activeCountEl.textContent = wallets.length + ' Dompet';
        if (listCountEl) listCountEl.textContent = wallets.length + ' dompet terdaftar';

        if (wallets.length === 0) {
            grid.innerHTML = '<article class="card">' +
                '<p class="text-muted">Belum ada dompet aktif. Klik tombol <strong>"Tambah Dompet"</strong> untuk menambahkan rekening atau dompet baru.</p>' +
                '</article>';
            return;
        }

        grid.innerHTML = wallets.map(function (w) {
            const meta = WALLET_TYPE_META[w.type] || WALLET_TYPE_META.cash;
            const bal = Number(w.balance || 0);
            const balColor = bal < 0 ? '#DC2626' : '#0B2545';

            return '<article class="card">' +
                '<div class="wallet-card-header" style="display:flex; justify-content:space-between; align-items:center;">' +
                '<div style="display:flex; align-items:center; gap:8px;">' +
                '<i data-lucide="' + meta.icon + '"></i>' +
                '<span class="wallet-badge">' + escapeHtml(meta.label) + '</span>' +
                '</div>' +
                '<button type="button" class="icon-btn edit-wallet-btn" data-uuid="' + escapeHtml(w.uuid) + '" title="Ubah Nama atau Saldo Dompet">' +
                '<i data-lucide="pencil"></i>' +
                '</button>' +
                '</div>' +
                '<span class="kpi-label" style="display:block; margin-top:10px;">' + escapeHtml(w.name) + '</span>' +
                '<div class="wallet-balance" style="color:' + balColor + ';">' + formatRupiah(bal) + '</div>' +
                '</article>';
        }).join('');
    }

    // =========================================================================
    // POIN 10: HALAMAN PROFIL & PENGATURAN (PIN, PENGINGAT, BACKUP/RESTORE, RESET)
    // =========================================================================
    async function initPinLockGate() {
        if (!window.SmartDB || typeof window.SmartDB.getSetting !== 'function') return;
        try {
            await window.SmartDB.init();
            const pinEnabled = await window.SmartDB.getSetting('pin_enabled', false);
            const savedPin = await window.SmartDB.getSetting('app_pin', '');
            if (!pinEnabled || !/^\d{6}$/.test(String(savedPin))) return;
            if (window.sessionStorage.getItem('sf_pin_unlocked') === '1') return;
            if (document.getElementById('sfPinLockOverlay')) return;

            const overlay = document.createElement('div');
            overlay.id = 'sfPinLockOverlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0B2545;display:flex;align-items:center;justify-content:center;padding:20px;';
            overlay.innerHTML =
                '<div style="background:#FFFFFF;border-radius:16px;padding:26px 22px;max-width:360px;width:100%;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.28);">' +
                '<div style="width:52px;height:52px;border-radius:50%;background:rgba(31,166,106,0.14);color:#1FA66A;display:flex;align-items:center;justify-content:center;margin:0 auto 12px auto;">' +
                '<i data-lucide="lock"></i>' +
                '</div>' +
                '<h2 style="font-size:18px;font-weight:800;color:#0B2545;margin:0 0 6px 0;">SMART FINANCE Terkunci</h2>' +
                '<p style="font-size:13px;color:#64748B;margin:0 0 16px 0;">Masukkan 6 digit PIN keamanan Anda untuk melanjutkan.</p>' +
                '<form id="sfUnlockPinForm">' +
                '<input type="password" id="sfUnlockPinInput" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="••••••" required style="width:100%;text-align:center;font-size:22px;letter-spacing:8px;padding:12px;border:1.5px solid #CBD5E1;border-radius:10px;margin-bottom:12px;">' +
                '<div id="sfUnlockPinError" style="color:#DC2626;font-size:12.5px;margin-bottom:10px;display:none;">PIN salah. Silakan coba lagi.</div>' +
                '<button type="submit" class="btn btn-success btn-block">Buka Aplikasi</button>' +
                '</form>' +
                '</div>';

            document.body.appendChild(overlay);
            refreshIcons();

            const pinInput = document.getElementById('sfUnlockPinInput');
            if (pinInput) setTimeout(function () { pinInput.focus(); }, 60);

            const unlockForm = document.getElementById('sfUnlockPinForm');
            if (unlockForm) {
                unlockForm.addEventListener('submit', function (e) {
                    e.preventDefault();
                    const entered = (pinInput ? pinInput.value : '').trim();
                    if (entered === String(savedPin)) {
                        window.sessionStorage.setItem('sf_pin_unlocked', '1');
                        overlay.remove();
                    } else {
                        const errEl = document.getElementById('sfUnlockPinError');
                        if (errEl) errEl.style.display = 'block';
                        if (pinInput) {
                            pinInput.value = '';
                            pinInput.focus();
                        }
                    }
                });
            }
        } catch (err) {
            console.warn('[SmartFinance] Pengecekan kunci PIN dilewati:', err);
        }
    }

    function initDailyReminderChecker() {
        async function checkReminderNow() {
            if (!window.SmartDB || typeof window.SmartDB.getSetting !== 'function') return;
            const enabled = await window.SmartDB.getSetting('reminder_enabled', false);
            if (!enabled) return;

            const targetTime = await window.SmartDB.getSetting('reminder_time', '20:00');
            const note = await window.SmartDB.getSetting('reminder_note', 'Waktunya mencatat transaksi keuangan hari ini!');
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const currentHM = hh + ':' + mm;
            const todayKey = 'sf_reminded_' + getTodayISO();

            if (currentHM === targetTime && !window.localStorage.getItem(todayKey)) {
                window.localStorage.setItem(todayKey, '1');
                if ('Notification' in window && window.Notification.permission === 'granted') {
                    new window.Notification('SMART FINANCE — Pengingat Harian', { body: note });
                } else {
                    alert('Pengingat Harian SMART FINANCE:\n' + note);
                }
            }
        }

        setInterval(checkReminderNow, 30000);
    }

    function initProfilePage() {
        const updateProfileForm = document.getElementById('updateProfileForm');
        if (updateProfileForm) {
            updateProfileForm.addEventListener('submit', async function (event) {
                event.preventDefault();
                if (!window.SmartDB) return;

                const nameInput = document.getElementById('profileNameInput');
                const newName = (nameInput ? nameInput.value : '').trim();
                if (!newName) {
                    alert('Masukkan nama panggilan atau nama tampilan Anda.');
                    return;
                }

                await window.SmartDB.setSetting('user_name', newName);
                await refreshAllViews();
                alert('Nama tampilan profil berhasil diperbarui.');
            });
        }
    }

    async function renderProfilePage() {
        if (!window.SmartDB || typeof window.SmartDB.getSetting !== 'function') return;
        const savedName = await window.SmartDB.getSetting('user_name', 'Pengguna');
        const displayName = String(savedName || 'Pengguna').trim() || 'Pengguna';

        const nameHeading = document.getElementById('profileDisplayName');
        const avatarEl = document.getElementById('profileAvatarInitial');
        const nameInput = document.getElementById('profileNameInput');

        if (nameHeading) nameHeading.textContent = displayName;
        if (avatarEl) avatarEl.textContent = computeInitials(displayName);
        if (nameInput && document.activeElement !== nameInput) {
            nameInput.value = displayName === 'Pengguna' ? '' : displayName;
        }
    }

    function initSettingsPage() {
        // 1. Kunci Keamanan PIN 6 Digit
        const pinToggle = document.getElementById('pinLockToggle');
        const pinSetupBox = document.getElementById('pinSetupBox');
        if (pinToggle) {
            pinToggle.addEventListener('change', async function () {
                if (!window.SmartDB) return;
                if (pinToggle.checked) {
                    if (pinSetupBox) pinSetupBox.classList.remove('hidden');
                    const newPinEl = document.getElementById('newPinInput');
                    if (newPinEl) setTimeout(function () { newPinEl.focus(); }, 60);
                } else {
                    await window.SmartDB.setSetting('pin_enabled', false);
                    window.sessionStorage.removeItem('sf_pin_unlocked');
                    if (pinSetupBox) pinSetupBox.classList.add('hidden');
                    alert('Kunci keamanan PIN dinonaktifkan.');
                }
            });
        }

        const savePinForm = document.getElementById('savePinForm');
        if (savePinForm) {
            savePinForm.addEventListener('submit', async function (event) {
                event.preventDefault();
                if (!window.SmartDB) return;

                const pin1 = (document.getElementById('newPinInput').value || '').trim();
                const pin2 = (document.getElementById('confirmPinInput').value || '').trim();

                if (!/^\d{6}$/.test(pin1)) {
                    alert('PIN harus terdiri dari tepat 6 digit angka.');
                    return;
                }
                if (pin1 !== pin2) {
                    alert('Konfirmasi PIN tidak cocok. Silakan ulangi.');
                    return;
                }

                await window.SmartDB.setSetting('app_pin', pin1);
                await window.SmartDB.setSetting('pin_enabled', true);
                window.sessionStorage.setItem('sf_pin_unlocked', '1');
                savePinForm.reset();
                if (pinToggle) pinToggle.checked = true;
                alert('Kunci keamanan PIN 6 digit berhasil disimpan dan diaktifkan.');
            });
        }

        // 2. Pengingat Pencatatan Harian
        const reminderToggle = document.getElementById('dailyReminderToggle');
        const reminderTimeBox = document.getElementById('reminderTimeBox');
        if (reminderToggle) {
            reminderToggle.addEventListener('change', async function () {
                if (!window.SmartDB) return;
                if (reminderToggle.checked) {
                    if (reminderTimeBox) reminderTimeBox.classList.remove('hidden');
                    await window.SmartDB.setSetting('reminder_enabled', true);
                    if ('Notification' in window && window.Notification.permission === 'default') {
                        window.Notification.requestPermission().catch(function () {});
                    }
                } else {
                    if (reminderTimeBox) reminderTimeBox.classList.add('hidden');
                    await window.SmartDB.setSetting('reminder_enabled', false);
                }
            });
        }

        const saveReminderBtn = document.getElementById('saveReminderBtn');
        if (saveReminderBtn) {
            saveReminderBtn.addEventListener('click', async function () {
                if (!window.SmartDB) return;
                const timeVal = (document.getElementById('reminderTimeInput').value || '20:00').trim();
                const noteVal = (document.getElementById('reminderNoteInput').value || '').trim() || 'Waktunya mencatat transaksi keuangan hari ini!';

                await window.SmartDB.setSetting('reminder_enabled', true);
                await window.SmartDB.setSetting('reminder_time', timeVal);
                await window.SmartDB.setSetting('reminder_note', noteVal);

                if ('Notification' in window && window.Notification.permission === 'default') {
                    window.Notification.requestPermission().catch(function () {});
                }
                alert('Jadwal pengingat harian pada pukul ' + timeVal + ' berhasil disimpan.');
            });
        }

        // 3. Sinkronisasi & Cadangan JSON (Export / Import)
        const syncNowBtn = document.getElementById('settingsSyncNowBtn');
        if (syncNowBtn) {
            syncNowBtn.addEventListener('click', async function () {
                if (!window.SmartDB) return;
                await window.SmartDB.init();
                const queue = typeof window.SmartDB.getSyncQueue === 'function'
                    ? await window.SmartDB.getSyncQueue()
                    : [];
                await refreshAllViews();
                alert('Penyimpanan lokal telah diperiksa & disinkronkan.\nStatus: Siap Offline (' + queue.length + ' item antrean).');
            });
        }

        const exportJsonBtn = document.getElementById('exportJsonBackupBtn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', async function () {
                if (!window.SmartDB || typeof window.SmartDB.exportFullBackup !== 'function') {
                    alert('Fitur ekspor cadangan belum tersedia.');
                    return;
                }
                const backupPayload = await window.SmartDB.exportFullBackup();
                const jsonString = JSON.stringify(backupPayload, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'SmartFinance_Backup_' + getTodayISO() + '.json';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            });
        }

        const importJsonInput = document.getElementById('importJsonBackupInput');
        if (importJsonInput) {
            importJsonInput.addEventListener('change', function (event) {
                const file = event.target.files && event.target.files[0];
                if (!file || !window.SmartDB || typeof window.SmartDB.importFullBackup !== 'function') return;

                const reader = new FileReader();
                reader.onload = async function (loadEvent) {
                    try {
                        const parsed = JSON.parse(String(loadEvent.target.result || '{}'));
                        if (!parsed || typeof parsed !== 'object') {
                            throw new Error('Format berkas cadangan JSON tidak valid.');
                        }
                        if (!window.confirm('Pulihkan data dari berkas "' + file.name + '"? Data lokal saat ini akan digantikan dengan isi cadangan.')) {
                            importJsonInput.value = '';
                            return;
                        }
                        await window.SmartDB.importFullBackup(parsed);
                        importJsonInput.value = '';
                        await refreshAllViews();
                        alert('Cadangan data berhasil dipulihkan ke perangkat Anda.');
                    } catch (err) {
                        importJsonInput.value = '';
                        alert('Gagal memulihkan cadangan JSON: ' + (err.message || 'Berkas tidak dikenali.'));
                    }
                };
                reader.readAsText(file);
            });
        }

        // 4. Instalasi PWA & Reset Penyimpanan Lokal
        const installPwaBtn = document.getElementById('settingsInstallPwaBtn');
        if (installPwaBtn) {
            installPwaBtn.addEventListener('click', async function () {
                if (deferredInstallPrompt) {
                    deferredInstallPrompt.prompt();
                    await deferredInstallPrompt.userChoice;
                    deferredInstallPrompt = null;
                } else {
                    alert('Untuk memasang SMART FINANCE ke layar utama:\n• Di Chrome / Edge Desktop: Klik ikon "Install" (+) di sebelah kanan bilah alamat URL.\n• Di Android / iOS: Buka menu browser (⋮ atau Bagikan) lalu pilih "Tambahkan ke Layar Utama".');
                }
            });
        }

        const resetDataBtn = document.getElementById('resetLocalDataBtn');
        if (resetDataBtn) {
            resetDataBtn.addEventListener('click', async function () {
                if (!window.SmartDB || typeof window.SmartDB.clearAllLocalData !== 'function') return;

                const confirmed = window.confirm(
                    'PERINGATAN: Seluruh catatan transaksi, anggaran, target tabungan, dan saldo dompet di perangkat ini akan dihapus permanen.\n\nLanjutkan reset data lokal?'
                );
                if (!confirmed) return;

                await window.SmartDB.clearAllLocalData();
                window.sessionStorage.removeItem('sf_pin_unlocked');
                await refreshAllViews();
                alert('Seluruh data lokal perangkat berhasil dihapus dan dikembalikan ke pengaturan awal.');
            });
        }
    }

    async function renderSettingsPage() {
        if (!window.SmartDB || typeof window.SmartDB.getSetting !== 'function') return;

        const pinToggle = document.getElementById('pinLockToggle');
        const pinSetupBox = document.getElementById('pinSetupBox');
        if (pinToggle) {
            const pinEnabled = Boolean(await window.SmartDB.getSetting('pin_enabled', false));
            pinToggle.checked = pinEnabled;
            if (pinSetupBox) {
                pinSetupBox.classList.toggle('hidden', !pinEnabled);
            }
        }

        const reminderToggle = document.getElementById('dailyReminderToggle');
        const reminderTimeBox = document.getElementById('reminderTimeBox');
        const reminderTimeInput = document.getElementById('reminderTimeInput');
        const reminderNoteInput = document.getElementById('reminderNoteInput');
        if (reminderToggle) {
            const remEnabled = Boolean(await window.SmartDB.getSetting('reminder_enabled', false));
            const remTime = await window.SmartDB.getSetting('reminder_time', '20:00');
            const remNote = await window.SmartDB.getSetting('reminder_note', 'Waktunya mencatat transaksi keuangan hari ini!');

            reminderToggle.checked = remEnabled;
            if (reminderTimeBox) reminderTimeBox.classList.toggle('hidden', !remEnabled);
            if (reminderTimeInput && document.activeElement !== reminderTimeInput) {
                reminderTimeInput.value = remTime;
            }
            if (reminderNoteInput && document.activeElement !== reminderNoteInput) {
                reminderNoteInput.value = remNote;
            }
        }
    }

    async function refreshAllViews() {
        if (!window.SmartDB) return;
        try {
            await window.SmartDB.init();
            const walletMap = await populateWalletDropdowns();
            await renderDashboardPage(walletMap);
            await renderIncomePage(walletMap);
            await renderExpensePage(walletMap);
            await renderSavingsPage();
            await renderBudgetPage();
            await renderHistoryPage(walletMap);
            if (window.SmartCharts && typeof window.SmartCharts.renderAll === 'function') {
                await window.SmartCharts.renderAll();
            }
            await renderReportPage();
            await renderWalletPage();
            await renderProfilePage();
            await renderSettingsPage();
            refreshIcons();
        } catch (err) {
            console.error('[SmartFinance] Gagal memuat tampilan:', err);
        }
    }

    // =========================================================================
    // INISIALISASI SAAT HALAMAN SIAP
    // =========================================================================
    document.addEventListener('DOMContentLoaded', async function () {
        refreshIcons();
        initTopbarHeader();
        initServiceWorker();
        await initPinLockGate();
        initDailyReminderChecker();
        initNavigationAndQuickTxModal();
        initIncomePageFilters();
        initExpensePageFilters();
        initSavingsPage();
        initBudgetPage();
        initHistoryPage();
        initReportPage();
        initWalletPage();
        initProfilePage();
        initSettingsPage();
        await refreshAllViews();
    });

    window.addEventListener('smartfinance:data-changed', refreshAllViews);

    window.SmartApp = {
        refreshAllViews: refreshAllViews,
        openQuickTxModal: openQuickTxModal,
        formatRupiah: formatRupiah,
        parseRupiahDigits: parseRupiahDigits
    };
})(window);
