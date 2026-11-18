/* =========================================================================
   SMART FINANCE - Charts & Analytics Visualization Module (Chart.js)
   ========================================================================= */
(function (window) {
    'use strict';

    const PALETTE = [
        '#081C38', // Navy Utama
        '#E8A317', // Kuning Emas
        '#4A77A8', // Biru Slate
        '#89A8C9', // Biru Muda
        '#7C6992', // Ungu Lembut
        '#94A3B8', // Abu-abu
        '#1F9D63', // Hijau
        '#D64545'  // Merah
    ];

    const MONTH_NAMES_ID = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];

    let dashboardBarInstance = null;
    let dashboardDonutInstance = null;
    let reportTrendInstance = null;
    let reportDonutInstance = null;

    function formatRupiah(amount) {
        return 'Rp ' + Math.round(Number(amount || 0)).toLocaleString('id-ID');
    }

    function formatCompactRupiah(amount) {
        const val = Number(amount || 0);
        if (val >= 1000000) {
            return 'Rp ' + (val / 1000000).toFixed(1).replace('.', ',') + ' jt';
        }
        if (val >= 1000) {
            return 'Rp ' + Math.round(val / 1000) + ' rb';
        }
        return 'Rp ' + Math.round(val);
    }

    function getLastSixMonthsKeys() {
        const result = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            result.push({
                key: `${year}-${month}`,
                label: MONTH_NAMES_ID[d.getMonth()]
            });
        }
        return result;
    }

    function aggregateSixMonthCashflow(transactions, walletFilter = 'all') {
        const months = getLastSixMonthsKeys();
        const incomeMap = {};
        const expenseMap = {};

        months.forEach((m) => {
            incomeMap[m.key] = 0;
            expenseMap[m.key] = 0;
        });

        transactions.forEach((tx) => {
            if (tx.is_transfer) return;
            if (walletFilter !== 'all' && tx.wallet_uuid !== walletFilter) return;

            const monthKey = String(tx.transaction_date || '').slice(0, 7);
            if (Object.prototype.hasOwnProperty.call(incomeMap, monthKey)) {
                if (tx.type === 'income') {
                    incomeMap[monthKey] += Number(tx.amount || 0);
                } else if (tx.type === 'expense') {
                    expenseMap[monthKey] += Number(tx.amount || 0);
                }
            }
        });

        return {
            labels: months.map((m) => m.label),
            incomes: months.map((m) => incomeMap[m.key]),
            expenses: months.map((m) => expenseMap[m.key])
        };
    }

    function aggregateExpenseCategories(transactions, monthFilter = null, walletFilter = 'all') {
        const categoryTotals = {};
        let grandTotal = 0;

        transactions.forEach((tx) => {
            if (tx.type !== 'expense' || tx.is_transfer) return;
            if (walletFilter !== 'all' && tx.wallet_uuid !== walletFilter) return;
            if (monthFilter && String(tx.transaction_date || '').slice(0, 7) !== monthFilter) return;

            const cat = tx.category || 'Lainnya';
            const amt = Number(tx.amount || 0);
            categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
            grandTotal += amt;
        });

        const sorted = Object.entries(categoryTotals)
            .map(([category, total]) => ({
                category,
                total,
                percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0
            }))
            .sort((a, b) => b.total - a.total);

        return { items: sorted, grandTotal };
    }

    function renderCategoryLegendList(listElement, categoryData) {
        if (!listElement) return;
        const { items, grandTotal } = categoryData;

        if (grandTotal <= 0 || items.length === 0) {
            listElement.innerHTML = '<li><span class="text-muted">Belum ada pengeluaran</span><strong>0%</strong></li>';
            return;
        }

        listElement.innerHTML = items.slice(0, 6).map((item, index) => {
            const color = PALETTE[index % PALETTE.length];
            return `
                <li>
                    <span>
                        <i class="legend-dot" style="background-color:${color};"></i>${item.category}
                    </span>
                    <strong>${item.percentage}%</strong>
                </li>
            `;
        }).join('');
    }

    function createBarChart(canvas, labels, incomes, expenses, existingChart) {
        if (!canvas || typeof window.Chart === 'undefined') return null;
        if (existingChart) existingChart.destroy();

        return new window.Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Pemasukan',
                        data: incomes,
                        backgroundColor: '#1F9D63',
                        borderRadius: { topLeft: 5, topRight: 5 },
                        barPercentage: 0.7,
                        categoryPercentage: 0.55
                    },
                    {
                        label: 'Pengeluaran',
                        data: expenses,
                        backgroundColor: '#D64545',
                        borderRadius: { topLeft: 5, topRight: 5 },
                        barPercentage: 0.7,
                        categoryPercentage: 0.55
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${formatRupiah(ctx.parsed.y)}`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { color: '#E5EBF2' },
                        ticks: { color: '#64748B', font: { size: 12 } }
                    },
                    y: {
                        beginAtZero: true,
                        display: false
                    }
                }
            }
        });
    }

    function createDonutChart(canvas, categoryData, existingChart) {
        if (!canvas || typeof window.Chart === 'undefined') return null;
        if (existingChart) existingChart.destroy();

        const hasData = categoryData.grandTotal > 0 && categoryData.items.length > 0;
        const labels = hasData ? categoryData.items.map((i) => i.category) : ['Kosong'];
        const values = hasData ? categoryData.items.map((i) => i.total) : [1];
        const colors = hasData
            ? categoryData.items.map((_, idx) => PALETTE[idx % PALETTE.length])
            : ['#E2E8F0'];

        return new window.Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '66%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: hasData,
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${formatRupiah(ctx.parsed)}`
                        }
                    }
                }
            }
        });
    }

    async function renderDashboardCharts(transactions = null) {
        const barCanvas = document.getElementById('cashflowBarChart');
        const donutCanvas = document.getElementById('expenseDonutChart');
        if (!barCanvas && !donutCanvas) return;

        const txList = transactions || (window.SmartDB
            ? await window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false)
            : []);

        const currentMonth = new Date().toISOString().slice(0, 7);
        const sixMonthData = aggregateSixMonthCashflow(txList, 'all');
        const categoryData = aggregateExpenseCategories(txList, currentMonth, 'all');

        dashboardBarInstance = createBarChart(
            barCanvas,
            sixMonthData.labels,
            sixMonthData.incomes,
            sixMonthData.expenses,
            dashboardBarInstance
        );

        dashboardDonutInstance = createDonutChart(
            donutCanvas,
            categoryData,
            dashboardDonutInstance
        );

        const donutCenterTotal = document.getElementById('donutCenterTotal');
        if (donutCenterTotal) {
            donutCenterTotal.textContent = formatCompactRupiah(categoryData.grandTotal);
        }

        renderCategoryLegendList(document.getElementById('expenseCategoryLegend'), categoryData);
    }

    async function renderReportCharts(transactions = null, monthFilter = null, walletFilter = 'all') {
        const trendCanvas = document.getElementById('reportTrendChart');
        const donutCanvas = document.getElementById('reportCategoryDonutChart');
        if (!trendCanvas && !donutCanvas) return;

        const txList = transactions || (window.SmartDB
            ? await window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false)
            : []);

        const monthInput = document.getElementById('reportMonthFilter');
        const walletInput = document.getElementById('reportWalletFilter');

        const activeMonth = monthFilter || (monthInput && monthInput.value) || new Date().toISOString().slice(0, 7);
        const activeWallet = walletFilter || (walletInput && walletInput.value) || 'all';

        const sixMonthData = aggregateSixMonthCashflow(txList, activeWallet);
        const categoryData = aggregateExpenseCategories(txList, activeMonth, activeWallet);

        reportTrendInstance = createBarChart(
            trendCanvas,
            sixMonthData.labels,
            sixMonthData.incomes,
            sixMonthData.expenses,
            reportTrendInstance
        );

        reportDonutInstance = createDonutChart(
            donutCanvas,
            categoryData,
            reportDonutInstance
        );

        renderCategoryLegendList(document.getElementById('reportCategoryLegend'), categoryData);
    }

    async function renderAllCharts() {
        if (!window.SmartDB) return;
        await window.SmartDB.init();
        const txList = await window.SmartDB.getAll(window.SmartDB.STORES.TRANSACTIONS, false);
        await renderDashboardCharts(txList);
        await renderReportCharts(txList);
    }

    document.addEventListener('DOMContentLoaded', renderAllCharts);
    window.addEventListener('smartfinance:data-changed', renderAllCharts);

    window.SmartCharts = {
        renderDashboardCharts,
        renderReportCharts,
        renderAll: renderAllCharts
    };
})(window);
