# 📘 ExamLent — Simulasi Ujian Online

![Next.js](https://img.shields.io/badge/Next.js-15-black) 
![Prisma](https://img.shields.io/badge/Prisma-6-blue) 
![Supabase](https://img.shields.io/badge/Supabase-Storage%20%26%20Auth-green) 
![License](https://img.shields.io/badge/license-MIT-brightgreen)

## 🚀 Deskripsi
**ExamLent** adalah platform simulasi ujian berbasis web yang dirancang untuk membantu siswa berlatih menghadapi ujian dan mempermudah admin dalam mengelola soal serta memantau hasil.  
Dibangun menggunakan **Next.js 15, Prisma, NeonDB, Supabase, dan NextAuth** dengan desain modern berbasis **TailwindCSS + Shadcn UI**.

---

## ✨ Fitur Utama
- 🔑 **Autentikasi & Role**
  - Login/Register dengan **NextAuth**
  - Role `ADMIN` & `USER` dengan middleware proteksi

- 📝 **Manajemen Paket Ujian**
  - Admin bisa membuat, mengedit, menghapus paket ujian
  - Dukungan tipe soal: Single Choice, Multi Select, True/False, Short Text, Essay, Number, Range  

- 📂 **Bank Soal & Gambar**
  - Upload gambar soal via **Supabase Bucket**
  - Opsi jawaban dengan penanda jawaban benar

- 🕒 **Sesi Ujian**
  - User masuk dengan **token akses**
  - Timer otomatis sesuai batas waktu
  - Navigasi soal interaktif

- 📊 **Hasil & Penilaian**
  - Skoring otomatis untuk soal objektif
  - Rekap hasil per attempt
  - Dashboard admin untuk memantau peserta

---

## 🛠️ Tech Stack
- **Framework:** Next.js 15 (App Router, Turbopack, TypeScript)  
- **Database:** NeonDB (PostgreSQL serverless)  
- **ORM:** Prisma 6  
- **Auth:** NextAuth.js (JWT + Middleware proteksi role)  
- **Storage:** Supabase Bucket (gambar soal)  
- **Styling:** TailwindCSS + Shadcn UI  
- **Validation:** Zod  

---

## 📂 Struktur Folder
```bash
src/
 ├── app/
 │   ├── admin/        # Halaman admin (paket ujian, hasil)
 │   ├── api/          # Endpoint Next.js API
 │   ├── exam/         # Halaman ujian untuk user
 │   └── login/        # Autentikasi
 ├── lib/              # Config (authOptions, prisma, supabase)
 ├── components/       # UI Components
 └── prisma/           # Schema & migrations
