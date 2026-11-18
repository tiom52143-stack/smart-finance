/* =========================================================================
   SMART FINANCE - Local Database Engine (IndexedDB Offline-First)
   ========================================================================= */
(function (window) {
    'use strict';

    const DB_NAME = 'SmartFinanceDB';
    const DB_VERSION = 1;

    const STORES = {
        WALLETS: 'wallets',
        TRANSACTIONS: 'transactions',
        BUDGETS: 'budgets',
        GOALS: 'savings_goals',
        SETTINGS: 'settings',
        SYNC_QUEUE: 'sync_queue'
    };

    const DEFAULT_WALLETS = [
        {
            uuid: 'default-cash',
            name: 'Tunai',
            type: 'cash',
            balance: 0,
            updated_at: new Date().toISOString(),
            sync_status: 'synced',
            is_deleted: false
        },
        {
            uuid: 'default-bank',
            name: 'Bank BCA',
            type: 'bank',
            balance: 0,
            updated_at: new Date().toISOString(),
            sync_status: 'synced',
            is_deleted: false
        },
        {
            uuid: 'default-ewallet',
            name: 'E-Wallet',
            type: 'ewallet',
            balance: 0,
            updated_at: new Date().toISOString(),
            sync_status: 'synced',
            is_deleted: false
        }
    ];

    let dbInstance = null;

    function generateUUID() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'sf-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
    }

    function openDB() {
        if (dbInstance) {
            return Promise.resolve(dbInstance);
        }

        return new Promise((resolve, reject) => {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = function (event) {
                const db = event.target.result;

                if (!db.objectStoreNames.contains(STORES.WALLETS)) {
                    const walletStore = db.createObjectStore(STORES.WALLETS, { keyPath: 'uuid' });
                    walletStore.createIndex('sync_status', 'sync_status', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
                    const txStore = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'uuid' });
                    txStore.createIndex('transaction_date', 'transaction_date', { unique: false });
                    txStore.createIndex('type', 'type', { unique: false });
                    txStore.createIndex('category', 'category', { unique: false });
                    txStore.createIndex('wallet_uuid', 'wallet_uuid', { unique: false });
                    txStore.createIndex('sync_status', 'sync_status', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.BUDGETS)) {
                    const budgetStore = db.createObjectStore(STORES.BUDGETS, { keyPath: 'uuid' });
                    budgetStore.createIndex('month_year', 'month_year', { unique: false });
                    budgetStore.createIndex('sync_status', 'sync_status', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.GOALS)) {
                    const goalStore = db.createObjectStore(STORES.GOALS, { keyPath: 'uuid' });
                    goalStore.createIndex('sync_status', 'sync_status', { unique: false });
                }

                if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                    db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
                    const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    queueStore.createIndex('entity', 'entity', { unique: false });
                }
            };

            request.onsuccess = async function (event) {
                dbInstance = event.target.result;
                try {
                    await seedDefaultWallets();
                    resolve(dbInstance);
                } catch (err) {
                    resolve(dbInstance);
                }
            };

            request.onerror = function (event) {
                console.error('[SmartDB] Gagal membuka IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async function seedDefaultWallets() {
        const existing = await getAll(STORES.WALLETS, true);
        if (existing.length === 0) {
            for (const wallet of DEFAULT_WALLETS) {
                await rawPut(STORES.WALLETS, { ...wallet, updated_at: new Date().toISOString() });
            }
        }
    }

    function rawPut(storeName, item) {
        return openDB().then((db) => {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const req = store.put(item);
                req.onsuccess = () => resolve(item);
                req.onerror = () => reject(req.error);
            });
        });
    }

    function getById(storeName, key) {
        return openDB().then((db) => {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        });
    }

    function getAll(storeName, includeDeleted = false) {
        return openDB().then((db) => {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const req = store.getAll();
                req.onsuccess = () => {
                    const list = req.result || [];
                    if (includeDeleted) {
                        resolve(list);
                    } else {
                        resolve(list.filter((item) => !item.is_deleted));
                    }
                };
                req.onerror = () => reject(req.error);
            });
        });
    }

    async function enqueueSync(entity, action, uuid, payload) {
        await rawPut(STORES.SYNC_QUEUE, {
            entity,
            action,
            uuid,
            payload,
            created_at: new Date().toISOString()
        });
        window.dispatchEvent(new CustomEvent('smartfinance:data-changed', { detail: { entity, action } }));
    }

    // =========================================================================
    // PENGATURAN (SETTINGS)
    // =========================================================================
    async function getSetting(key, defaultValue = null) {
        const record = await getById(STORES.SETTINGS, key);
        return record ? record.value : defaultValue;
    }

    async function setSetting(key, value) {
        await rawPut(STORES.SETTINGS, { key, value, updated_at: new Date().toISOString() });
        window.dispatchEvent(new CustomEvent('smartfinance:settings-changed', { detail: { key, value } }));
        return value;
    }

    // =========================================================================
    // DOMPET (WALLETS)
    // =========================================================================
    async function saveWallet(walletData) {
        const now = new Date().toISOString();
        const existing = walletData.uuid ? await getById(STORES.WALLETS, walletData.uuid) : null;

        const record = {
            uuid: existing ? existing.uuid : generateUUID(),
            name: String(walletData.name || 'Dompet Baru').trim(),
            type: walletData.type || 'cash',
            balance: Number(walletData.balance || 0),
            updated_at: now,
            sync_status: 'pending',
            is_deleted: false
        };

        await rawPut(STORES.WALLETS, record);
        await enqueueSync(STORES.WALLETS, 'upsert', record.uuid, record);
        return record;
    }

    async function adjustWalletBalance(walletUuid, delta) {
        const wallet = await getById(STORES.WALLETS, walletUuid);
        if (!wallet) return null;

        wallet.balance = Number(wallet.balance || 0) + Number(delta || 0);
        wallet.updated_at = new Date().toISOString();
        wallet.sync_status = 'pending';

        await rawPut(STORES.WALLETS, wallet);
        await enqueueSync(STORES.WALLETS, 'upsert', wallet.uuid, wallet);
        return wallet;
    }

    async function transferBetweenWallets(fromUuid, toUuid, amount, note = '') {
        const nominal = Number(amount);
        if (!fromUuid || !toUuid || fromUuid === toUuid || nominal <= 0) {
            throw new Error('Dompet asal, tujuan, atau nominal transfer tidak valid.');
        }

        const fromWallet = await getById(STORES.WALLETS, fromUuid);
        const toWallet = await getById(STORES.WALLETS, toUuid);
        if (!fromWallet || !toWallet) {
            throw new Error('Dompet tidak ditemukan.');
        }

        await adjustWalletBalance(fromUuid, -nominal);
        await adjustWalletBalance(toUuid, nominal);

        const today = new Date().toISOString().split('T')[0];
        const desc = note ? `Transfer: ${note}` : `Transfer ke ${toWallet.name}`;

        // Catat sebagai histori mutasi tanpa menggandakan pengurangan saldo
        const now = new Date().toISOString();
        const txOut = {
            uuid: generateUUID(),
            type: 'expense',
            amount: nominal,
            category: 'Lainnya',
            wallet_uuid: fromUuid,
            transaction_date: today,
            note: desc,
            is_transfer: true,
            updated_at: now,
            sync_status: 'pending',
            is_deleted: false
        };
        const txIn = {
            uuid: generateUUID(),
            type: 'income',
            amount: nominal,
            category: 'Lainnya',
            wallet_uuid: toUuid,
            transaction_date: today,
            note: note ? `Transfer: ${note}` : `Transfer dari ${fromWallet.name}`,
            is_transfer: true,
            updated_at: now,
            sync_status: 'pending',
            is_deleted: false
        };

        await rawPut(STORES.TRANSACTIONS, txOut);
        await enqueueSync(STORES.TRANSACTIONS, 'upsert', txOut.uuid, txOut);

        await rawPut(STORES.TRANSACTIONS, txIn);
        await enqueueSync(STORES.TRANSACTIONS, 'upsert', txIn.uuid, txIn);

        return { fromWallet, toWallet };
    }

    // =========================================================================
    // TRANSAKSI (TRANSACTIONS)
    // =========================================================================
    async function saveTransaction(txData) {
        const now = new Date().toISOString();
        const existing = txData.uuid ? await getById(STORES.TRANSACTIONS, txData.uuid) : null;

        // Jika mengedit transaksi lama, kembalikan dulu efek saldo sebelumnya
        if (existing && !existing.is_deleted && !existing.is_transfer) {
            const oldDelta = existing.type === 'income' ? -Number(existing.amount) : Number(existing.amount);
            await adjustWalletBalance(existing.wallet_uuid, oldDelta);
        }

        const record = {
            uuid: existing ? existing.uuid : generateUUID(),
            type: txData.type === 'income' ? 'income' : 'expense',
            amount: Number(txData.amount || 0),
            category: txData.category || 'Lainnya',
            wallet_uuid: txData.wallet_uuid || 'default-cash',
            transaction_date: txData.transaction_date || now.split('T')[0],
            note: String(txData.note || '').trim(),
            is_transfer: existing ? Boolean(existing.is_transfer) : false,
            updated_at: now,
            sync_status: 'pending',
            is_deleted: false
        };

        await rawPut(STORES.TRANSACTIONS, record);
        await enqueueSync(STORES.TRANSACTIONS, 'upsert', record.uuid, record);

        // Terapkan perubahan saldo ke dompet terpilih
        if (!record.is_transfer) {
            const newDelta = record.type === 'income' ? record.amount : -record.amount;
            await adjustWalletBalance(record.wallet_uuid, newDelta);
        }

        return record;
    }

    async function deleteTransaction(uuid) {
        const existing = await getById(STORES.TRANSACTIONS, uuid);
        if (!existing || existing.is_deleted) return false;

        if (!existing.is_transfer) {
            const revertDelta = existing.type === 'income' ? -Number(existing.amount) : Number(existing.amount);
            await adjustWalletBalance(existing.wallet_uuid, revertDelta);
        }

        existing.is_deleted = true;
        existing.updated_at = new Date().toISOString();
        existing.sync_status = 'pending';

        await rawPut(STORES.TRANSACTIONS, existing);
        await enqueueSync(STORES.TRANSACTIONS, 'delete', existing.uuid, existing);
        return true;
    }

    // =========================================================================
    // ANGGARAN (BUDGETS)
    // =========================================================================
    async function saveBudget(budgetData) {
        const now = new Date().toISOString();
        const allBudgets = await getAll(STORES.BUDGETS, false);
        const duplicate = allBudgets.find(
            (b) => b.category === budgetData.category && b.month_year === budgetData.month_year
        );

        const targetUuid = budgetData.uuid || (duplicate ? duplicate.uuid : generateUUID());

        const record = {
            uuid: targetUuid,
            category: budgetData.category,
            limit_amount: Number(budgetData.limit_amount || 0),
            month_year: budgetData.month_year,
            updated_at: now,
            sync_status: 'pending',
            is_deleted: false
        };

        await rawPut(STORES.BUDGETS, record);
        await enqueueSync(STORES.BUDGETS, 'upsert', record.uuid, record);
        return record;
    }

    async function deleteBudget(uuid) {
        const existing = await getById(STORES.BUDGETS, uuid);
        if (!existing) return false;

        existing.is_deleted = true;
        existing.updated_at = new Date().toISOString();
        existing.sync_status = 'pending';

        await rawPut(STORES.BUDGETS, existing);
        await enqueueSync(STORES.BUDGETS, 'delete', existing.uuid, existing);
        return true;
    }

    // =========================================================================
    // TARGET TABUNGAN (SAVINGS GOALS)
    // =========================================================================
    async function saveGoal(goalData) {
        const now = new Date().toISOString();
        const existing = goalData.uuid ? await getById(STORES.GOALS, goalData.uuid) : null;

        const record = {
            uuid: existing ? existing.uuid : generateUUID(),
            title: String(goalData.title || 'Target Tabungan').trim(),
            target_amount: Number(goalData.target_amount || 0),
            current_amount: Number(goalData.current_amount || 0),
            deadline: goalData.deadline || '',
            updated_at: now,
            sync_status: 'pending',
            is_deleted: false
        };

        await rawPut(STORES.GOALS, record);
        await enqueueSync(STORES.GOALS, 'upsert', record.uuid, record);
        return record;
    }

    async function depositToGoal(goalUuid, amount, walletUuid) {
        const nominal = Number(amount);
        const goal = await getById(STORES.GOALS, goalUuid);
        if (!goal || nominal <= 0) {
            throw new Error('Target tabungan atau nominal setoran tidak valid.');
        }

        goal.current_amount = Number(goal.current_amount || 0) + nominal;
        goal.updated_at = new Date().toISOString();
        goal.sync_status = 'pending';

        await rawPut(STORES.GOALS, goal);
        await enqueueSync(STORES.GOALS, 'upsert', goal.uuid, goal);

        // Potong saldo dari dompet sumber & catat sebagai transaksi tabungan
        if (walletUuid) {
            await saveTransaction({
                type: 'expense',
                amount: nominal,
                category: 'Lainnya',
                wallet_uuid: walletUuid,
                transaction_date: new Date().toISOString().split('T')[0],
                note: `Setoran Tabungan: ${goal.title}`
            });
        }

        return goal;
    }

    async function deleteGoal(uuid) {
        const existing = await getById(STORES.GOALS, uuid);
        if (!existing) return false;

        existing.is_deleted = true;
        existing.updated_at = new Date().toISOString();
        existing.sync_status = 'pending';

        await rawPut(STORES.GOALS, existing);
        await enqueueSync(STORES.GOALS, 'delete', existing.uuid, existing);
        return true;
    }

    // =========================================================================
    // SINKRONISASI, CADANGAN JSON, & RESET DATA
    // =========================================================================
    async function getSyncQueue() {
        return openDB().then((db) => {
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORES.SYNC_QUEUE, 'readonly');
                const store = tx.objectStore(STORES.SYNC_QUEUE);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
        });
    }

    async function clearSyncQueueItems(ids) {
        if (!ids || ids.length === 0) return;
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
            const store = tx.objectStore(STORES.SYNC_QUEUE);
            ids.forEach((id) => store.delete(id));
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function applyServerSnapshot(snapshot) {
        if (!snapshot) return;
        const map = [
            { key: 'wallets', store: STORES.WALLETS },
            { key: 'transactions', store: STORES.TRANSACTIONS },
            { key: 'budgets', store: STORES.BUDGETS },
            { key: 'savings_goals', store: STORES.GOALS }
        ];

        for (const entry of map) {
            const items = snapshot[entry.key] || [];
            for (const remoteItem of items) {
                const localItem = await getById(entry.store, remoteItem.uuid);
                if (!localItem || new Date(remoteItem.updated_at) >= new Date(localItem.updated_at)) {
                    await rawPut(entry.store, {
                        ...remoteItem,
                        sync_status: 'synced',
                        is_deleted: Boolean(remoteItem.is_deleted)
                    });
                }
            }
        }
        await setSetting('last_sync_at', new Date().toISOString());
        window.dispatchEvent(new CustomEvent('smartfinance:data-changed', { detail: { entity: 'all', action: 'sync' } }));
    }

    async function exportFullBackup() {
        const [wallets, transactions, budgets, goals, settings] = await Promise.all([
            getAll(STORES.WALLETS, false),
            getAll(STORES.TRANSACTIONS, false),
            getAll(STORES.BUDGETS, false),
            getAll(STORES.GOALS, false),
            getAll(STORES.SETTINGS, true)
        ]);

        return {
            app: 'SMART FINANCE',
            version: DB_VERSION,
            exported_at: new Date().toISOString(),
            data: {
                wallets,
                transactions,
                budgets,
                savings_goals: goals,
                settings
            }
        };
    }

    async function importFullBackup(backupObj) {
        if (!backupObj || !backupObj.data) {
            throw new Error('Format berkas cadangan JSON tidak valid.');
        }

        const { wallets = [], transactions = [], budgets = [], savings_goals = [] } = backupObj.data;

        for (const w of wallets) {
            await rawPut(STORES.WALLETS, { ...w, sync_status: 'pending', is_deleted: false });
        }
        for (const t of transactions) {
            await rawPut(STORES.TRANSACTIONS, { ...t, sync_status: 'pending', is_deleted: false });
        }
        for (const b of budgets) {
            await rawPut(STORES.BUDGETS, { ...b, sync_status: 'pending', is_deleted: false });
        }
        for (const g of savings_goals) {
            await rawPut(STORES.GOALS, { ...g, sync_status: 'pending', is_deleted: false });
        }

        window.dispatchEvent(new CustomEvent('smartfinance:data-changed', { detail: { entity: 'all', action: 'restore' } }));
        return true;
    }

    async function clearAllLocalData() {
        const db = await openDB();
        const storeList = Object.values(STORES);

        await new Promise((resolve, reject) => {
            const tx = db.transaction(storeList, 'readwrite');
            storeList.forEach((name) => tx.objectStore(name).clear());
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });

        await seedDefaultWallets();
        window.dispatchEvent(new CustomEvent('smartfinance:data-changed', { detail: { entity: 'all', action: 'reset' } }));
        return true;
    }

    window.SmartDB = {
        STORES,
        init: openDB,
        generateUUID,
        getAll,
        getById,
        rawPut,
        getSetting,
        setSetting,
        saveWallet,
        adjustWalletBalance,
        transferBetweenWallets,
        saveTransaction,
        deleteTransaction,
        saveBudget,
        deleteBudget,
        saveGoal,
        depositToGoal,
        deleteGoal,
        getSyncQueue,
        clearSyncQueueItems,
        applyServerSnapshot,
        exportFullBackup,
        importFullBackup,
        clearAllLocalData
    };
})(window);
