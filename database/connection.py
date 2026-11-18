import mysql.connector
from mysql.connector import Error
from config import Config


def get_db_connection():
    """Membuat dan mengembalikan objek koneksi ke database MySQL."""
    try:
        connection = mysql.connector.connect(
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            database=Config.DB_NAME,
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci',
            autocommit=False
        )
        if connection.is_connected():
            return connection
    except Error as err:
        print(f"[Database Error] Gagal terhubung ke MySQL: {err}")
        return None
    return None
