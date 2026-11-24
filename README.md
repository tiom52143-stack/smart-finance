# 💰 SMART FINANCE

**SMART FINANCE** adalah aplikasi web dan *Progressive Web App* (PWA) manajemen keuangan pribadi berbasis ***Offline-First***. Aplikasi ini dirancang untuk membantu pengguna mencatat arus kas, mengelola multi-dompet, memantau anggaran bulanan, serta merencanakan target tabungan secara mandiri, cepat, dan aman langsung dari perangkat mereka tanpa ketergantungan pada server pusat.

🌐 **Live Demo:** [https://smart-finance-gamma-five.vercel.app](https://smart-finance-gamma-five.vercel.app)

---

## 🎯 Latar Belakang, Tema & Target Pengguna

### 1. Penentuan Tema & Filosofi Desain
* **Tema:** Manajemen Keuangan Pribadi Modern (*Personal Finance & Expense Tracker*) dengan pendekatan **Privasi Utama (*Privacy-First*)** dan **Kemandirian Data**.
* **Visual & Antarmuka:** Mengusung palet warna *Navy* dan *Emerald Green* yang bersih, responsif untuk layar ponsel maupun desktop, serta mendukung mode pemasangan layaknya aplikasi native (PWA).

### 2. Target Pengguna
* **Pelajar & Mahasiswa:** Untuk mengontrol uang saku harian, membatasi pengeluaran jajan/hiburan lewat fitur *Budget*, dan menyisihkan dana darurat.
* **Pekerja & Freelancer:** Untuk memisahkan alokasi dana antar-dompet (rekening bank, *e-wallet*, tunai) dan memantau rasio pemasukan terhadap pengeluaran bulanan.
* **Pengguna yang Mengutamakan Privasi:** Masyarakat yang ingin mencatat keuangan secara digital tanpa harus mengunggah data transaksi sensitif ke cloud pihak ketiga.

---

## ✨ Fungsi & Fitur Utama (Fase 1 – 10)

1. **Dashboard Interaktif:** Ringkasan total saldo seluruh dompet, arus kas bulanan (pemasukan vs pengeluaran), grafik pengeluaran per kategori, progres target tabungan, serta daftar transaksi terbaru.
2. **Pencatatan Pemasukan & Pengeluaran (*Income & Expense*):** Input cepat transaksi lengkap dengan kategori, pemilihan dompet sumber/tujuan, tanggal, dan catatan deskripsi.
3. **Multi-Dompet (*Wallet Management*):** Pengelolaan saldo terpisah (misalnya Tunai, Rekening Bank, E-Wallet) beserta fitur transfer antar-dompet.
4. **Perencanaan Anggaran (*Budgeting*):** Penetapan batas pengeluaran bulanan per kategori lengkap dengan indikator persentase pemakaian agar tidak *over-budget*.
5. **Target Tabungan (*Savings Goals*):** Pembuatan target tabungan spesifik beserta pelacakan progres dana yang terkumpul.
6. **Riwayat & Laporan Analitik (*History & Report*):** Pencarian riwayat transaksi serta visualisasi grafik analitik berbasis **Chart.js**.
7. **Keamanan & Kontrol Data (*Settings & Security*):**
   * **Kunci PIN 6-Digit:** Melindungi akses aplikasi di perangkat pribadi.
   * **Ekspor & Impor JSON:** Pencadangan (*backup*) dan pemulihan (*restore*) seluruh database lokal secara manual kapan saja.
   * **Pengingat Harian:** Notifikasi pengingat untuk mencatat transaksi harian.
8. **Dukungan Offline penuh (PWA):** Tetap dapat dibuka dan digunakan untuk mencatat transaksi meskipun tanpa koneksi internet.

---

## 🛠️ Teknologi yang Digunakan (*Tech Stack*)

* **Backend & Routing:** Python (Flask) + Gunicorn
* **Frontend:** HTML5, CSS3 (Responsive Design), Vanilla JavaScript (ES6+)
* **Database Lokal:** IndexedDB (`SmartDB`) — penyimpanan 100% di sisi klien (*client-side*)
* **Visualisasi Data:** Chart.js
* **PWA Engine:** Web App Manifest & Service Worker
* **Deployment & Hosting:** GitHub Codespaces, GitHub, & Vercel

---

## 🚀 Perjalanan Pengembangan & Tantangan Teknis

Proyek ini dibangun secara bertahap dari perancangan arsitektur hingga publikasi *online* tanpa bergantung pada instalasi lokal yang rumit:

### Tahap 1: Perancangan Blueprint & Pengembangan Bertahap (Fase 1–10)
Pengembangan dimulai dengan menyusun spesifikasi fitur secara terstruktur sebelum menulis kode. Seluruh logika aplikasi dibangun dalam 10 fase menggunakan **GitHub Codespaces**, mulai dari kerangka database lokal `IndexedDB`, logika perhitungan saldo otomatis, hingga integrasi grafik dan sistem keamanan PIN 6-digit.

### Tahap 2: Kendala & Solusi Saat Proses Pembuatan

Selama proses pengembangan hingga *deployment* ke **Vercel**, terdapat beberapa kendala teknis utama yang berhasil dipecahkan:

1. **Sinkronisasi Kode Lengkap ke Repositori Utama**
   * *Kendala:* Beberapa bagian logika pada berkas utama JavaScript (`static/js/app.js`) sempat belum terunggah sepenuhnya ke repositori sehingga fitur tidak berjalan lengkap saat diuji.
   * *Solusi:* Melakukan audit baris kode di Codespaces, melengkapi seluruh modul fungsi yang kurang, lalu mendorong pembaruan secara paksa (*force push*) ke cabang `main` agar sinkron dengan Vercel.

2. **Konfigurasi Server Python di Lingkungan Serverless Vercel**
   * *Kendala:* Aplikasi Flask membutuhkan konfigurasi titik masuk (*entrypoint*) dan dependensi yang tepat agar dapat berjalan di arsitektur *serverless* Vercel.
   * *Solusi:* Menambahkan `gunicorn` pada `requirements.txt` serta menyusun berkas `vercel.json` untuk mengarahkan permintaan ke `app.py`.

3. **Tampilan Berantakan (CSS Tidak Terbaca) Saat Dibuka di HP**
   * *Kendala:* Setelah berhasil *deploy*, tampilan aplikasi terlihat rapi di PC (karena terbantu *cache* lokal), tetapi tampil polos tanpa gaya (*unstyled HTML*) saat dibuka melalui browser HP. Hal ini terjadi karena aturan routing di `vercel.json` meneruskan seluruh permintaan—termasuk folder `/static/`—ke fungsi Python sehingga file CSS gagal dimuat.
   * *Solusi:* Memisahkan rute aset statis di `vercel.json` dengan menambahkan `@vercel/static` untuk `static/**` dan memetakan `/static/(.*)` langsung ke `/static/$1` sebelum diteruskan ke `app.py`.

4. **Cache Service Worker PWA Menampilkan Versi Lama**
   * *Kendala:* Setelah kode diperbarui di server Vercel, browser terkadang masih menampilkan antarmuka lama akibat mekanisme penyimpanan *offline* dari *Service Worker*.
   * *Solusi:* Melakukan pembersihan *Site Data / Cache Storage* dan memperbarui mekanisme *cache* agar pengguna selalu mendapatkan versi terbaru saat terhubung ke internet.

---

## 📲 Cara Menggunakan & Memasang Aplikasi (PWA)

1. Buka tautan **[smart-finance-gamma-five.vercel.app](https://smart-finance-gamma-five.vercel.app)** melalui browser (Chrome, Edge, atau Safari).
2. **Untuk Pengguna Android (Chrome):** Ketuk ikon menu **`⋮`** di pojok kanan atas $\rightarrow$ pilih **Tambahkan ke layar utama / Install app**.
3. **Untuk Pengguna iOS (Safari):** Ketuk ikon **Bagikan (*Share*)** $\rightarrow$ pilih **Tambahkan ke Layar Utama (*Add to Home Screen*)**.
4. **Untuk Pengguna PC/Laptop:** Klik ikon **Install (+)** di sisi kanan bilah alamat URL browser.

---

## 🔒 Catatan Privasi

Seluruh catatan keuangan, daftar dompet, dan pengaturan PIN disimpan secara lokal di browser perangkat masing-masing pengguna menggunakan **IndexedDB**. Pengembang maupun server hosting tidak menyimpan atau memiliki akses ke data finansial pribadi pengguna.
