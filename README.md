# PeakDrive

Private drive untuk tim berbasis .NET 8 WebAPI + React (Vite). Akun dibuat oleh admin, tidak ada registrasi publik. File disimpan di storage server, metadata di PostgreSQL.

## Stack

- Backend: ASP.NET Core 8, Entity Framework Core, PostgreSQL (Npgsql), JWT Auth, Swagger
- Frontend: React + Vite, Tailwind CSS, Axios, React Router, FontAwesome, React Three Fiber

## Struktur

```
peakdrive/
├── ditDriveAPI
└── frontend
```

## Backend

### Konfigurasi

File utama: `ditDriveAPI/appsettings.json`

- `ConnectionStrings:Default`
- `Jwt:Key`, `Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpireMinutes`
- `Storage:RootPath`
- `Share:BaseUrl`

### Seed Master Admin (opsional)

Jika database kosong dan ingin auto-seed MasterAdmin, set env/config berikut:

- `Seed:MasterEmail`
- `Seed:MasterPassword`

Jika tidak diset, proses seed akan dilewati.

### Jalankan

```bash
cd ditDriveAPI
dotnet tool restore
dotnet ef database update
dotnet run
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Proxy dev ke backend:

- `/api`, `/s`, `/storage` → `http://localhost:5133`

## Endpoint Utama

- `POST /api/auth/login`
- `POST /api/admin/create-user`
- `POST /api/admin/create-admin`
- `GET /api/admin/list-users`
- `POST /api/folders`
- `GET /api/folders/{id}`
- `POST /api/files/upload?folderId=X`
- `GET /api/files/view/{fileId}`
- `GET /api/files/download/{fileId}`
- `POST /api/share/{fileId}`
- `GET /s/{token}`

## Build Frontend

```bash
cd frontend
npm run build
```

Output ada di `frontend/dist`.

## Deployment (ringkas)

- Backend di-host sebagai service
- Reverse proxy:
  - `/api` → backend
  - `/storage` → backend static
  - `/` → frontend build

## Lisensi

MIT (DitDev) - lihat LICENSE.
