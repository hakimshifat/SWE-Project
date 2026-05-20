# Secure Information Hiding System Using Steganography

This repository contains the course project for **CSE 3206 - Software Engineering Lab**.
The application lets users hide secret text or files inside lossless image media using
steganography, optionally protect the hidden payload with a password, and later extract it.

## Features
- Public landing page with dark/light mode.
- User registration, login, logout, and cookie-based sessions.
- PNG/BMP cover image upload for steganography.
- Secret text or secret file embedding.
- Optional password protection for hidden payloads.
- Generated stego PNG download.
- Stego image upload and extraction.
- Wrong-password extraction rejection.
- Administrator user access management.
- Operation logs for registration, login, embed, extract, and admin updates.

## Tech Stack
- **Frontend**: React, Vite, React Router, TypeScript.
- **Backend**: Node.js, Express, TypeScript.
- **Database**: PostgreSQL with Prisma.
- **Auth**: `express-session` stored in PostgreSQL, Argon2id password hashing.
- **File handling**: Multer memory uploads and local generated-file storage.
- **Steganography**: LSB image encoding for PNG/BMP input with PNG output.
- **Encryption**: Node `crypto` AES-256-GCM with PBKDF2-SHA256 derived keys.
- **Tests**: Vitest and Supertest.

## Project Structure
```text
client/       React + Vite frontend
server/       Express API, auth, database, files, steganography
shared/       Shared TypeScript types
prisma/       PostgreSQL schema and migrations
tests/        Unit and API integration tests
Documentation/ Original SRS, DFD, SDLC, and database docs
```

## PostgreSQL Setup
This project expects a local PostgreSQL database:

```env
DATABASE_URL="postgresql://swe_user:swe_password@localhost:5432/swe_steganography"
SESSION_SECRET="change-this-session-secret"
DATA_DIR="./data"
PORT="3000"
MAX_UPLOAD_BYTES="26214400"
```

An `.env.example` file is included. A local `.env` can use the values above for development.

If you need to create the local database manually:

```bash
psql -U postgres -d postgres -c "CREATE ROLE swe_user LOGIN PASSWORD 'swe_password' CREATEDB;"
createdb -U postgres -O swe_user swe_steganography
```

## Quick Start
```bash
npm install
npm run db:migrate
npm run seed:admin -- --username admin --email admin@example.com --password AdminPass123!
npm run dev
```

Open the frontend at:

```text
http://127.0.0.1:5173
```

The backend API runs at:

```text
http://127.0.0.1:3000
```

## Useful Commands
```bash
npm run dev          # start Express API and Vite frontend
npm run dev:server   # start only backend
npm run dev:client   # start only frontend
npm run build        # type-check and build frontend
npm test             # run unit and integration tests
npm run test:unit    # run steganography unit tests only
npm run db:migrate   # apply Prisma migrations
npm run seed:admin   # create/update admin account
```

## Usage Notes
- Supported v1 cover images are PNG and BMP.
- Generated stego files are saved as PNG under `data/stego/`.
- Raw secret payloads are not stored separately in the database.
- Existing SQLite data from the previous Python version is not migrated.
- PostgreSQL is now the only runtime database.

## Documentation References
- SRS: `Documentation/srs.pdf`
- Level 0 DFD: `Documentation/Level 0.pdf`
- Level 1 DFD: `Documentation/Level 1.pdf`
- Level 2 and database schema: `Documentation/Level 2 and DB.pdf`
