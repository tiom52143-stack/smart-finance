import os
from datetime import timedelta
from dotenv import load_dotenv

# Memuat variabel lingkungan dari berkas .env
load_dotenv()


class Config:
    """Konfigurasi utama aplikasi SMART FINANCE."""

    # Keamanan Aplikasi & Pengaturan Sesi Pengguna
    SECRET_KEY = os.getenv('SECRET_KEY', 'smart-finance-dev-secret-key-2026')
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # Konfigurasi Koneksi Database MySQL
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = int(os.getenv('DB_PORT', 3306))
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_NAME = os.getenv('DB_NAME', 'smart_finance_db')

    # Konfigurasi Autentikasi OAuth 2.0 / OpenID Connect
    GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
    GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')

    FACEBOOK_CLIENT_ID = os.getenv('FACEBOOK_CLIENT_ID', '')
    FACEBOOK_CLIENT_SECRET = os.getenv('FACEBOOK_CLIENT_SECRET', '')

    APPLE_CLIENT_ID = os.getenv('APPLE_CLIENT_ID', '')
    APPLE_CLIENT_SECRET = os.getenv('APPLE_CLIENT_SECRET', '')
