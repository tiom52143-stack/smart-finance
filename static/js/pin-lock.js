/* =========================================================================
   SMART FINANCE - 6-Digit Security PIN Lock Module
   ========================================================================= */
(function (window) {
    'use strict';

    const SETTING_PIN_ENABLED = 'security_pin_enabled';
    const SETTING_PIN_HASH = 'security_pin_hash';
    const SESSION_UNLOCKED_KEY = 'sf_pin_unlocked';

    let currentInput = '';
    let savedPinHash = null;

    // Hashing PIN dengan SHA-256 (Web Crypto API) + fallback jika HTTP non-localhost
    async function hashPin(pin) {
        const salted = 'SMART_FINANCE_SALT_' + String(pin);
        if (window.crypto && window.crypto.subtle) {
            const encoder = new TextEncoder();
            const data = encoder.encode(salted);
            const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        }
        // Fallback hash sederhana jika Web Crypto tidak tersedia
        let hash = 0;
        for (let i = 0; i < salted.length; i++) {
            const char = salted.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return 'fb_' + Math.abs(hash).toString(16);
    }

    function updatePinDots() {
        const dotsContainer = document.getElementById('pinDots');
        if (!dotsContainer) return;
        const dots = dotsContainer.querySelectorAll('span');
        dots.forEach((dot, idx) => {
            if (idx < currentInput.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
        });
    }

    function showPinOverlay() {
        const overlay = document.getElementById('pinLockOverlay');
        if (!overlay) return;
        currentInput = '';
        updatePinDots();
        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function hidePinOverlay() {
        const overlay = document.getElementById('pinLockOverlay');
        if (!overlay) return;
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    async function verifyEnteredPin() {
        const errorMsg = document.getElementById('pinErrorMsg');
        const enteredHash = await hashPin(currentInput);

        if (enteredHash === savedPinHash) {
            if (errorMsg) errorMsg.classList.add('hidden');
            window.sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
            currentInput = '';
            updatePinDots();
            hidePinOverlay();
        } else {
            if (errorMsg) errorMsg.classList.remove('hidden');
            setTimeout(() => {
                currentInput = '';
                updatePinDots();
            }, 250);
        }
    }

    function handleDigitInput(digit) {
        if (currentInput.length >= 6) return;
        const errorMsg = document.getElementById('pinErrorMsg');
        if (errorMsg) errorMsg.classList.add('hidden');

        currentInput += String(digit);
        updatePinDots();

        if (currentInput.length === 6) {
            verifyEnteredPin();
        }
    }

    function handleBackspace() {
        if (currentInput.length === 0) return;
        currentInput = currentInput.slice(0, -1);
        updatePinDots();
    }

    function handleClear() {
        currentInput = '';
        updatePinDots();
    }

    function bindLockOverlayEvents() {
        const overlay = document.getElementById('pinLockOverlay');
        if (!overlay) return;

        const numButtons = overlay.querySelectorAll('.pin-keypad button[data-num]');
        numButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                handleDigitInput(btn.getAttribute('data-num'));
            });
        });

        const clearBtn = document.getElementById('pinClear');
        if (clearBtn) {
            clearBtn.addEventListener('click', handleClear);
        }

        const backBtn = document.getElementById('pinBackspace');
        if (backBtn) {
            backBtn.addEventListener('click', handleBackspace);
        }

        // Dukungan input keyboard fisik (angka 0-9, Backspace, Escape) saat layar terkunci
        document.addEventListener('keydown', (event) => {
            if (overlay.classList.contains('hidden')) return;
            if (/^[0-9]$/.test(event.key)) {
                event.preventDefault();
                handleDigitInput(event.key);
            } else if (event.key === 'Backspace') {
                event.preventDefault();
                handleBackspace();
            } else if (event.key === 'Escape' || event.key === 'Delete') {
                event.preventDefault();
                handleClear();
            }
        });
    }

    // Pengaturan PIN pada halaman settings.html
    async function initSettingsPinControls() {
        const toggle = document.getElementById('pinLockToggle');
        const setupBox = document.getElementById('pinSetupBox');
        const saveForm = document.getElementById('savePinForm');
        if (!toggle || !setupBox || !saveForm || !window.SmartDB) return;

        const isEnabled = await window.SmartDB.getSetting(SETTING_PIN_ENABLED, false);
        const existingHash = await window.SmartDB.getSetting(SETTING_PIN_HASH, null);

        toggle.checked = Boolean(isEnabled && existingHash);
        if (toggle.checked) {
            setupBox.classList.remove('hidden');
        }

        toggle.addEventListener('change', async () => {
            const currentHash = await window.SmartDB.getSetting(SETTING_PIN_HASH, null);
            if (toggle.checked) {
                setupBox.classList.remove('hidden');
                if (currentHash) {
                    await window.SmartDB.setSetting(SETTING_PIN_ENABLED, true);
                }
            } else {
                setupBox.classList.add('hidden');
                await window.SmartDB.setSetting(SETTING_PIN_ENABLED, false);
                window.sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
                alert('Kunci keamanan PIN telah dinonaktifkan.');
            }
        });

        saveForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const newPinInput = document.getElementById('newPinInput');
            const confirmPinInput = document.getElementById('confirmPinInput');
            const newPin = (newPinInput ? newPinInput.value : '').trim();
            const confirmPin = (confirmPinInput ? confirmPinInput.value : '').trim();

            if (!/^\d{6}$/.test(newPin)) {
                alert('PIN harus terdiri dari tepat 6 digit angka.');
                return;
            }

            if (newPin !== confirmPin) {
                alert('Konfirmasi PIN tidak cocok. Silakan periksa kembali.');
                return;
            }

            const hashed = await hashPin(newPin);
            await window.SmartDB.setSetting(SETTING_PIN_HASH, hashed);
            await window.SmartDB.setSetting(SETTING_PIN_ENABLED, true);

            savedPinHash = hashed;
            toggle.checked = true;
            window.sessionStorage.setItem(SESSION_UNLOCKED_KEY, 'true');
            saveForm.reset();

            alert('PIN keamanan 6 digit berhasil disimpan dan diaktifkan!');
        });
    }

    async function initPinLock() {
        if (!window.SmartDB) return;

        try {
            await window.SmartDB.init();
            bindLockOverlayEvents();
            await initSettingsPinControls();

            const isEnabled = await window.SmartDB.getSetting(SETTING_PIN_ENABLED, false);
            savedPinHash = await window.SmartDB.getSetting(SETTING_PIN_HASH, null);
            const alreadyUnlocked = window.sessionStorage.getItem(SESSION_UNLOCKED_KEY) === 'true';

            if (isEnabled && savedPinHash && !alreadyUnlocked) {
                showPinOverlay();
            }
        } catch (err) {
            console.error('[SmartPinLock] Gagal menginisialisasi modul PIN:', err);
        }
    }

    document.addEventListener('DOMContentLoaded', initPinLock);

    window.SmartPinLock = {
        init: initPinLock,
        lockNow: function () {
            if (savedPinHash) {
                window.sessionStorage.removeItem(SESSION_UNLOCKED_KEY);
                showPinOverlay();
            }
        }
    };
})(window);
