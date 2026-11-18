/* =========================================================================
   SMART FINANCE - Offline/Online Synchronization Engine
   ========================================================================= */
(function (window) {
    'use strict';

    let isSyncing = false;
    let debounceTimer = null;

    function formatSyncTime(isoString) {
        if (!isoString) return 'Belum disinkronkan ke server';
        try {
            const date = new Date(isoString);
            return date.toLocaleString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return isoString;
        }
    }

    function updateNetworkBadge(state = null) {
        const pill = document.getElementById('networkStatusPill');
        const textEl = document.getElementById('networkStatusText');
        if (!pill || !textEl) return;

        pill.classList.remove('status-online', 'status-offline', 'status-warning');

        if (state === 'syncing') {
            pill.classList.add('status-warning');
            textEl.textContent = 'Menyinkronkan...';
            return;
        }

        if (navigator.onLine) {
            pill.classList.add('status-online');
            textEl.textContent = state === 'guest' ? 'Online (Lokal)' : 'Online';
        } else {
            pill.classList.add('status-offline');
            textEl.textContent = 'Offline';
        }
    }

    async function refreshProfileSyncLabel() {
        const statusEl = document.getElementById('profileSyncStatusText');
        if (!statusEl || !window.SmartDB) return;

        const lastSync = await window.SmartDB.getSetting('last_sync_at', null);
        const queue = await window.SmartDB.getSyncQueue();
        const pendingInfo = queue.length > 0 ? ` (${queue.length} perubahan menunggu sinkronisasi)` : '';

        statusEl.textContent = `Sinkronisasi terakhir: ${formatSyncTime(lastSync)}${pendingInfo}`;
    }

    async function markQueueItemsAsSynced(queueItems) {
        if (!window.SmartDB || !Array.isArray(queueItems)) return;

        const validStores = [
            window.SmartDB.STORES.WALLETS,
            window.SmartDB.STORES.TRANSACTIONS,
            window.SmartDB.STORES.BUDGETS,
            window.SmartDB.STORES.GOALS
        ];

        for (const item of queueItems) {
            if (!validStores.includes(item.entity) || !item.uuid) continue;
            const localRecord = await window.SmartDB.getById(item.entity, item.uuid);
            if (localRecord && localRecord.sync_status === 'pending') {
                localRecord.sync_status = 'synced';
                await window.SmartDB.rawPut(item.entity, localRecord);
            }
        }
    }

    async function syncNow(isManual = false) {
        if (!window.SmartDB) return { status: 'db_unavailable' };

        if (!navigator.onLine) {
            updateNetworkBadge('offline');
            if (isManual) {
                alert('Perangkat sedang offline. Perubahan tetap tersimpan aman di perangkat dan akan disinkronkan saat online.');
            }
            return { status: 'offline' };
        }

        if (isSyncing) {
            return { status: 'busy' };
        }

        isSyncing = true;
        updateNetworkBadge('syncing');

        const manualBtn = document.getElementById('manualSyncBtn');
        const settingsSyncBtn = document.getElementById('settingsSyncNowBtn');
        if (manualBtn) manualBtn.disabled = true;
        if (settingsSyncBtn) settingsSyncBtn.disabled = true;

        try {
            await window.SmartDB.init();
            const queueItems = await window.SmartDB.getSyncQueue();
            const lastSyncAt = await window.SmartDB.getSetting('last_sync_at', null);

            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    last_sync_at: lastSyncAt,
                    changes: queueItems
                })
            });

            // Mode Tamu / Belum Login: Pertahankan antrean lokal agar siap saat akun dihubungkan
            if (response.status === 401 || response.status === 403) {
                updateNetworkBadge('guest');
                await refreshProfileSyncLabel();
                if (isManual) {
                    alert('Anda sedang dalam Mode Tamu. Hubungkan akun di menu Profil agar data dapat dicadangkan ke server.');
                }
                return { status: 'guest_local' };
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            // Tandai item yang berhasil dikirim & bersihkan antrean
            const processedIds = queueItems.map((item) => item.id).filter((id) => id !== undefined);
            await markQueueItemsAsSynced(queueItems);
            await window.SmartDB.clearSyncQueueItems(processedIds);

            // Terapkan pembaruan data terbaru dari server MySQL ke IndexedDB
            const snapshot = result.snapshot || result.data || null;
            if (snapshot) {
                await window.SmartDB.applyServerSnapshot(snapshot);
            } else {
                await window.SmartDB.setSetting('last_sync_at', new Date().toISOString());
            }

            updateNetworkBadge('online');
            await refreshProfileSyncLabel();

            if (isManual) {
                alert('Sinkronisasi data berhasil!');
            }

            return { status: 'synced', result };
        } catch (err) {
            console.warn('[SmartSync] Sinkronisasi tertunda:', err.message);
            updateNetworkBadge(navigator.onLine ? 'online' : 'offline');
            await refreshProfileSyncLabel();
            if (isManual) {
                alert('Sinkronisasi tertunda karena gangguan koneksi server. Data lokal Anda tetap aman.');
            }
            return { status: 'error', error: err.message };
        } finally {
            isSyncing = false;
            if (manualBtn) manualBtn.disabled = false;
            if (settingsSyncBtn) settingsSyncBtn.disabled = false;
        }
    }

    // Kirim seluruh data lokal tamu saat pengguna menghubungkan/mendaftarkan akun
    async function pushFullLocalSnapshot() {
        if (!window.SmartDB || !navigator.onLine) return false;

        try {
            const backup = await window.SmartDB.exportFullBackup();
            const response = await fetch('/api/sync/merge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin',
                body: JSON.stringify(backup.data)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.snapshot) {
                    await window.SmartDB.applyServerSnapshot(result.snapshot);
                }
                return true;
            }
        } catch (err) {
            console.warn('[SmartSync] Gagal menggabungkan data tamu:', err.message);
        }
        return false;
    }

    function scheduleAutoSync() {
        if (!navigator.onLine) {
            updateNetworkBadge('offline');
            refreshProfileSyncLabel();
            return;
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            syncNow(false);
        }, 1500);
    }

    function initSyncEngine() {
        updateNetworkBadge();
        refreshProfileSyncLabel();

        window.addEventListener('online', () => {
            updateNetworkBadge('online');
            syncNow(false);
        });

        window.addEventListener('offline', () => {
            updateNetworkBadge('offline');
            refreshProfileSyncLabel();
        });

        // Dengarkan perubahan data lokal (abaikan jika berasal dari hasil sync server)
        window.addEventListener('smartfinance:data-changed', (event) => {
            const action = event && event.detail ? event.detail.action : '';
            refreshProfileSyncLabel();
            if (action === 'sync') return;
            scheduleAutoSync();
        });

        // Tombol sinkronisasi manual di Dashboard & Pengaturan
        const manualSyncBtn = document.getElementById('manualSyncBtn');
        if (manualSyncBtn) {
            manualSyncBtn.addEventListener('click', () => syncNow(true));
        }

        const settingsSyncBtn = document.getElementById('settingsSyncNowBtn');
        if (settingsSyncBtn) {
            settingsSyncBtn.addEventListener('click', () => syncNow(true));
        }

        // Jalankan sinkronisasi awal saat halaman dimuat jika online
        if (navigator.onLine) {
            setTimeout(() => {
                syncNow(false);
            }, 800);
        }
    }

    document.addEventListener('DOMContentLoaded', initSyncEngine);

    window.SmartSync = {
        init: initSyncEngine,
        syncNow,
        pushFullLocalSnapshot,
        updateNetworkBadge,
        refreshProfileSyncLabel
    };
})(window);
