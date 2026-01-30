# Quick Database Setup

## ⚡ Option 1: Neon (Recommended - 5 minutes)

### Step 1: Get Free Database
1. Open: **https://neon.tech**
2. Click "Sign up" (GitHub or email)
3. Create new project: `proscreen-db`

### Step 2: Get Connection String
After project creation, you'll see a connection string:
```
postgresql://alex:AbC123xyz@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb
```

### Step 3: Update .env File
Open `backend/.env` and update these lines:

**From Neon string:** `postgresql://USER:PASSWORD@HOST/DATABASE`

Extract the parts:
```env
DB_HOST=ep-cool-darkness-123456.us-east-2.aws.neon.tech
DB_PORT=5432
DB_NAME=neondb
DB_USER=alex
DB_PASSWORD=AbC123xyz
```

### Step 4: Run Migrations
```bash
cd backend
npm run migrate
```

### Step 5: Restart Backend
Backend should auto-restart (nodemon), or:
```bash
npm run dev
```

### Step 6: Test Registration
Visit: http://localhost:3000/register

---

## 🚀 Option 2: Supabase (Alternative)

1. Go to: **https://supabase.com**
2. Create account
3. New project → Get connection details
4. Settings → Database → Connection String
5. Update `backend/.env` similarly

---

## 🧪 Option 3: Local PostgreSQL (If you want to install)

### Windows:
1. Download: https://www.postgresql.org/download/windows/
2. Run installer (default settings)
3. Remember the password you set!
4. Update `backend/.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=proscreen_db
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD_HERE
```
5. Create database:
```bash
# Open pgAdmin or run:
psql -U postgres
CREATE DATABASE proscreen_db;
\q
```
6. Run migrations: `npm run migrate`

---

## ✅ Verify It's Working

Test database connection:
```bash
node backend/test-db.js
```

Expected output:
```
✅ Database connection successful!
   Current time from database: 2026-01-30 12:34:56
```

Then try registration:
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","fullName":"Test User"}'
```

Should return:
```json
{
  "message": "User registered successfully",
  "user": {...},
  "token": "..."
}
```

---

## 🔧 Troubleshooting

**Error: ECONNREFUSED**
→ Database not running or wrong credentials in `.env`

**Error: Password authentication failed**
→ Wrong password in `.env`

**Error: Database does not exist**
→ Run `npm run migrate` first

**Error: relation "users" does not exist**
→ Migrations didn't run. Check `npm run migrate` output

---

## 📞 Need Help?

1. Check backend logs: `backend/` terminal shows errors
2. Test DB connection: `node backend/test-db.js`
3. Verify `.env` settings match your database

---

**Recommended:** Use Neon - it's free, fast, and no installation needed!
