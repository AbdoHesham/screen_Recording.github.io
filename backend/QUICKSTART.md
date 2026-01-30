# 🚀 Quick Start Guide (5 Minutes)

## Prerequisites
- Node.js installed ✅ (you have v25.2.1)
- Internet connection for cloud database

---

## Step 1: Get Free Database (2 minutes)

Go to: **https://neon.tech**

1. Sign up (free, no credit card)
2. Create project: `proscreen-db`
3. Copy your connection string

Example:
```
postgresql://user:pass@ep-xxx-123.us-east-2.aws.neon.tech/neondb
```

---

## Step 2: Configure Database (1 minute)

Edit `backend/.env`:

```env
DB_HOST=ep-xxx-123.us-east-2.aws.neon.tech
DB_PORT=5432
DB_NAME=neondb
DB_USER=your_user
DB_PASSWORD=your_password
```

Test connection:
```bash
node backend/test-db.js
```

---

## Step 3: Setup Database (1 minute)

```bash
cd backend
npm run migrate
```

Expected output:
```
✅ Migration 001_initial_schema.sql completed successfully
🎉 All migrations completed successfully!
```

---

## Step 4: Start Server (1 second)

```bash
npm run dev
```

You should see:
```
🚀 Server running on port 3001
✅ Connected to PostgreSQL database
```

---

## Step 5: Test Everything (1 minute)

Open a **NEW terminal** and run:

```bash
node backend/test-api.js
```

This will automatically test all endpoints.

Expected result:
```
✅ Passed: 11
❌ Failed: 0
🎉 All tests passed!
```

---

## That's It! 🎉

Your backend is now running and tested.

### What You Have Now:

✅ PostgreSQL database with 8 tables
✅ Authentication system (JWT)
✅ Recording management API
✅ Credit system (100 welcome credits)
✅ 3 AI agent personas pre-configured
✅ 3 credit packages pre-configured

### Available Endpoints:

**Auth:**
- `POST /api/auth/register` - Sign up
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Get user info
- `GET /api/auth/credits` - View credits

**Recordings:**
- `POST /api/recordings/presigned-url` - Get S3 upload URL
- `POST /api/recordings` - Save recording
- `GET /api/recordings` - List all
- `GET /api/recordings/:id` - Get one
- `PATCH /api/recordings/:id` - Update
- `DELETE /api/recordings/:id` - Delete

---

## Manual Testing (Optional)

Visit in browser: http://localhost:3001/health

Or use PowerShell:
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/health"
```

---

## Troubleshooting

**❌ Database connection failed?**
→ Check your Neon credentials in `backend/.env`
→ Run: `node backend/test-db.js`

**❌ Port 3001 in use?**
→ Change `PORT=3002` in `backend/.env`

**❌ Server won't start?**
→ Delete `node_modules` and run `npm install`

**❌ Migration errors?**
→ Check database is accessible
→ Migrations only run once (skip message is normal)

---

## Next Steps

### Phase 2: Frontend
- Create Next.js 14 app
- Port recording UI
- Build login/signup pages
- Connect to this API

### Phase 3: Payments
- Stripe integration
- Credit purchases
- Pricing page

### Phase 4: AI Features
- Audio cleanup
- Transcription enhancement
- AI agents

---

## Useful Commands

```bash
# Development
npm run dev          # Start with auto-reload
npm start            # Production mode
npm run migrate      # Run migrations

# Testing
node backend/test-db.js    # Test database connection
node backend/test-api.js   # Test all endpoints

# Database
psql "postgresql://..."    # Connect to database directly
```

---

## Resources

- Full API Docs: [backend/TESTING.md](./TESTING.md)
- Backend README: [backend/README.md](./README.md)
- Implementation Plan: View the plan file in `.claude/plans/`

---

## Support

If something isn't working:
1. Check `backend/TESTING.md` for detailed troubleshooting
2. Verify database connection: `node backend/test-db.js`
3. Check server logs in the terminal

---

**Ready for Phase 2?** Let me know and I'll start building the Next.js frontend! 🚀
