-- Membuat Database SMART FINANCE
CREATE DATABASE IF NOT EXISTS smart_finance_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE smart_finance_db;

-- 1. Tabel Pengguna (Mendukung Email, Google, Facebook, Apple & Migrasi Tamu)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_uuid VARCHAR(36) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NULL,
    password_hash VARCHAR(255) NULL,
    auth_provider ENUM('email', 'google', 'facebook', 'apple') NOT NULL DEFAULT 'email',
    provider_id VARCHAR(255) NULL,
    avatar_url VARCHAR(255) NULL,
    pin_hash VARCHAR(255) NULL,
    is_pin_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_provider (auth_provider, provider_id)
) ENGINE=InnoDB;

-- 2. Tabel Multi-Dompet (Tunai, Rekening Bank, E-Wallet)
CREATE TABLE wallets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    name VARCHAR(80) NOT NULL,
    type ENUM('cash', 'bank', 'ewallet', 'other') NOT NULL DEFAULT 'cash',
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    icon VARCHAR(50) DEFAULT 'wallet',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_wallet (user_id, is_deleted)
) ENGINE=InnoDB;

-- 3. Tabel Kategori (Bawaan Sistem & Kustom Pengguna)
CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NULL, -- NULL menandakan kategori bawaan sistem untuk semua pengguna
    name VARCHAR(80) NOT NULL,
    type ENUM('income', 'expense') NOT NULL,
    group_type ENUM('needs', 'wants', 'income') NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'tag',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_category (user_id, type, is_deleted)
) ENGINE=InnoDB;

-- 4. Tabel Transaksi (Pemasukan & Pengeluaran)
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    wallet_id INT NOT NULL,
    category_id INT NOT NULL,
    type ENUM('income', 'expense') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    transaction_date DATE NOT NULL,
    note TEXT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    INDEX idx_user_tx_date (user_id, transaction_date, is_deleted),
    INDEX idx_user_tx_type (user_id, type)
) ENGINE=InnoDB;

-- 5. Tabel Anggaran Bulanan (Monthly Budget)
CREATE TABLE budgets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    category_id INT NOT NULL,
    period_month CHAR(7) NOT NULL, -- Format: 'YYYY-MM' (contoh: '2026-11')
    amount_limit DECIMAL(15, 2) NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE KEY uq_budget_period (user_id, category_id, period_month)
) ENGINE=InnoDB;

-- 6. Tabel Target Tabungan (Saving Goals)
CREATE TABLE saving_goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    title VARCHAR(120) NOT NULL,
    target_amount DECIMAL(15, 2) NOT NULL,
    current_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    target_date DATE NULL,
    status ENUM('active', 'completed') NOT NULL DEFAULT 'active',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_goals (user_id, status, is_deleted)
) ENGINE=InnoDB;

-- 7. Tabel Riwayat Setoran Tabungan (Saving Progress Log)
CREATE TABLE saving_deposits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_uuid VARCHAR(36) NOT NULL UNIQUE,
    goal_id INT NOT NULL,
    wallet_id INT NULL, -- Opsional: jika dana ditarik dari dompet tertentu
    amount DECIMAL(15, 2) NOT NULL,
    deposit_date DATE NOT NULL,
    note VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (goal_id) REFERENCES saving_goals(id) ON DELETE CASCADE,
    FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 8. Tabel Pengingat Menabung (Saving Reminders)
CREATE TABLE saving_reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    amount_suggestion DECIMAL(15, 2) NULL,
    frequency ENUM('daily', 'weekly', 'monthly') NOT NULL DEFAULT 'monthly',
    reminder_time TIME NOT NULL DEFAULT '08:00:00',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =========================================================================
-- SEED DATA: 14 KATEGORI BAWAAN SISTEM
-- =========================================================================
INSERT INTO categories (client_uuid, user_id, name, type, group_type, icon, is_default) VALUES
-- Kelompok Kebutuhan (Needs)
('def-cat-need-01', NULL, 'Makan', 'expense', 'needs', 'utensils', TRUE),
('def-cat-need-02', NULL, 'Transportasi', 'expense', 'needs', 'car', TRUE),
('def-cat-need-03', NULL, 'Tagihan', 'expense', 'needs', 'file-text', TRUE),
('def-cat-need-04', NULL, 'Kesehatan', 'expense', 'needs', 'heart-pulse', TRUE),
('def-cat-need-05', NULL, 'Pendidikan', 'expense', 'needs', 'graduation-cap', TRUE),
('def-cat-need-06', NULL, 'Rumah', 'expense', 'needs', 'home', TRUE),

-- Kelompok Keinginan (Wants)
('def-cat-want-01', NULL, 'Hiburan', 'expense', 'wants', 'film', TRUE),
('def-cat-want-02', NULL, 'Belanja', 'expense', 'wants', 'shopping-bag', TRUE),
('def-cat-want-03', NULL, 'Hobi', 'expense', 'wants', 'gamepad-2', TRUE),
('def-cat-want-04', NULL, 'Makan di luar', 'expense', 'wants', 'coffee', TRUE),

-- Kelompok Pemasukan (Income)
('def-cat-inc-01', NULL, 'Gaji', 'income', 'income', 'briefcase', TRUE),
('def-cat-inc-02', NULL, 'Bonus', 'income', 'income', 'gift', TRUE),
('def-cat-inc-03', NULL, 'Usaha', 'income', 'income', 'store', TRUE),
('def-cat-inc-04', NULL, 'Lainnya', 'income', 'income', 'plus-circle', TRUE);
