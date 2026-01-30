# Backend Testing Guide

## Quick Start (5 Minutes)

### Step 1: Set Up Database

**Easiest Option: Use Neon (Free Cloud PostgreSQL)**

1. Visit: https://neon.tech
2. Click "Sign Up" (free, no credit card)
3. Create a new project: `proscreen-db`
4. Copy your connection string
5. Update `backend/.env` with your credentials

Example connection string from Neon:
```
postgresql://alex:AbC123xyz@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb
```

Break it down into your `.env`:
```env
DB_HOST=ep-cool-darkness-123456.us-east-2.aws.neon.tech
DB_PORT=5432
DB_NAME=neondb
DB_USER=alex
DB_PASSWORD=AbC123xyz
```

### Step 2: Test Database Connection

```bash
node backend/test-db.js
```

Expected output:
```
✅ Database connection successful!
   Current time from database: 2026-01-30 12:34:56.789
```

### Step 3: Run Migrations

```bash
cd backend
npm run migrate
```

Expected output:
```
🔄 Starting database migrations...

▶️  Running migration: 001_initial_schema.sql
✅ Migration 001_initial_schema.sql completed successfully

🎉 All migrations completed successfully!
```

### Step 4: Start the Server

```bash
npm run dev
```

Expected output:
```
╔═══════════════════════════════════════════════╗
║   ProScreen Recorder API Server              ║
║                                               ║
║   🚀 Server running on port 3001              ║
║   🌍 Environment: development                 ║
║   🔗 Health check: http://localhost:3001/health  ║
╚═══════════════════════════════════════════════╝

✅ Connected to PostgreSQL database
```

---

## API Testing

### Method 1: Using PowerShell (Windows)

Open a new PowerShell window and run these commands:

#### 1. Health Check

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/health" -Method GET | ConvertTo-Json
```

Expected:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T...",
  "uptime": 10.5,
  "environment": "development"
}
```

#### 2. Register a User

```powershell
$body = @{
    email = "test@example.com"
    password = "password123"
    fullName = "Test User"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/auth/register" -Method POST -Body $body -ContentType "application/json" | ConvertTo-Json
```

Expected:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "fullName": "Test User",
    "role": "free",
    "creditsBalance": 100
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Save the token!** You'll need it for authenticated requests.

#### 3. Login

```powershell
$body = @{
    email = "test@example.com"
    password = "password123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -Body $body -ContentType "application/json"
$token = $response.token
Write-Host "Token saved: $token"
$response | ConvertTo-Json
```

#### 4. Get Current User (Authenticated)

```powershell
# Use the token from previous step
$headers = @{
    Authorization = "Bearer $token"
}

Invoke-RestMethod -Uri "http://localhost:3001/api/auth/me" -Method GET -Headers $headers | ConvertTo-Json
```

Expected:
```json
{
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    "fullName": "Test User",
    "role": "free",
    "creditsBalance": 100,
    "emailVerified": false,
    "createdAt": "2026-01-30T...",
    "lastLogin": "2026-01-30T..."
  }
}
```

#### 5. Get Credit Balance

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/auth/credits" -Method GET -Headers $headers | ConvertTo-Json
```

Expected:
```json
{
  "balance": 100,
  "transactions": [
    {
      "id": "uuid",
      "amount": 100,
      "type": "bonus",
      "description": "Welcome bonus credits",
      "createdAt": "2026-01-30T..."
    }
  ]
}
```

#### 6. Get Presigned Upload URL

```powershell
$body = @{
    fileName = "test-recording.webm"
    fileType = "video/webm"
    recordingType = "screen"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/recordings/presigned-url" -Method POST -Body $body -ContentType "application/json" -Headers $headers | ConvertTo-Json
```

Expected:
```json
{
  "uploadUrl": "https://s3.amazonaws.com/...",
  "key": "recordings/user-id/screen/uuid.webm",
  "fileUrl": "https://s3.amazonaws.com/..."
}
```

#### 7. Create Recording Entry

```powershell
$body = @{
    title = "Test Recording"
    type = "screen"
    rawFileUrl = "https://s3.amazonaws.com/test.webm"
    durationSeconds = 120
    fileSizeBytes = 1048576
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/recordings" -Method POST -Body $body -ContentType "application/json" -Headers $headers | ConvertTo-Json
```

#### 8. List All Recordings

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/recordings" -Method GET -Headers $headers | ConvertTo-Json
```

---

### Method 2: Using Postman

1. Download Postman: https://www.postman.com/downloads/
2. Import this collection:

**Create these requests in Postman:**

1. **Health Check**
   - Method: GET
   - URL: `http://localhost:3001/health`

2. **Register**
   - Method: POST
   - URL: `http://localhost:3001/api/auth/register`
   - Body (JSON):
     ```json
     {
       "email": "test@example.com",
       "password": "password123",
       "fullName": "Test User"
     }
     ```

3. **Login**
   - Method: POST
   - URL: `http://localhost:3001/api/auth/login`
   - Body (JSON):
     ```json
     {
       "email": "test@example.com",
       "password": "password123"
     }
     ```
   - In Tests tab, add:
     ```javascript
     pm.environment.set("token", pm.response.json().token);
     ```

4. **Get Current User**
   - Method: GET
   - URL: `http://localhost:3001/api/auth/me`
   - Headers:
     - `Authorization`: `Bearer {{token}}`

5. **Get Credits**
   - Method: GET
   - URL: `http://localhost:3001/api/auth/credits`
   - Headers:
     - `Authorization`: `Bearer {{token}}`

6. **List Recordings**
   - Method: GET
   - URL: `http://localhost:3001/api/recordings`
   - Headers:
     - `Authorization`: `Bearer {{token}}`

---

### Method 3: Using curl (Git Bash)

```bash
# Health check
curl http://localhost:3001/health

# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","fullName":"Test User"}'

# Login and save token
TOKEN=$(curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

# Get current user
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Get credits
curl http://localhost:3001/api/auth/credits \
  -H "Authorization: Bearer $TOKEN"

# List recordings
curl http://localhost:3001/api/recordings \
  -H "Authorization: Bearer $TOKEN"
```

---

## Database Verification

You can also check the database directly:

### Using psql (if you have it installed)

```bash
# Connect to Neon database
psql "postgresql://user:pass@host/db"

# Check tables
\dt

# Count users
SELECT COUNT(*) FROM users;

# View users
SELECT id, email, role, credits_balance FROM users;

# View credit transactions
SELECT * FROM credit_transactions;

# View recordings
SELECT id, title, type, status FROM recordings;
```

### Using Neon Dashboard

1. Go to https://console.neon.tech
2. Select your project
3. Go to "SQL Editor"
4. Run queries:

```sql
-- Check all tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- View users
SELECT id, email, role, credits_balance, created_at FROM users;

-- View agent personas
SELECT name, description FROM agent_personas;

-- View credit packages
SELECT name, credits, price_cents FROM credit_packages;
```

---

## Troubleshooting

### Issue: "Database connection failed"

**Solution:**
```bash
# Test connection
node backend/test-db.js

# Check your .env file
cat backend/.env

# Verify credentials match your Neon dashboard
```

---

### Issue: "Invalid token"

**Solution:**
- Make sure you're including the token in the Authorization header
- Format: `Authorization: Bearer YOUR_TOKEN_HERE`
- Token expires after 7 days

---

### Issue: "Port 3001 already in use"

**Solution:**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Or change port in .env
PORT=3002
```

---

### Issue: Migration already ran

**Solution:**
This is normal! Migrations only run once. If you see:
```
⏭️  Skipping 001_initial_schema.sql (already executed)
```
That means your database is already set up correctly.

---

## What to Test

### ✅ Phase 1 Checklist

Test each of these to verify Phase 1 is working:

- [ ] Health check returns status "healthy"
- [ ] Register a new user (returns token + 100 credits)
- [ ] Login with credentials (returns token)
- [ ] Get current user info (requires token)
- [ ] View credit balance (shows 100 credits + welcome transaction)
- [ ] Request presigned URL (for S3 upload)
- [ ] Create a recording entry
- [ ] List all recordings
- [ ] Get a specific recording by ID
- [ ] Update a recording
- [ ] Delete a recording

### Database Verification

Check these tables exist:
- [ ] users
- [ ] recordings
- [ ] transcriptions
- [ ] ai_jobs
- [ ] credit_transactions
- [ ] agent_personas (3 personas seeded)
- [ ] credit_packages (3 packages seeded)
- [ ] migrations (tracking table)

---

## Next Steps

Once all tests pass, you're ready for **Phase 2: Frontend Migration**!

Phase 2 will involve:
- Creating a Next.js 14 project
- Porting the recording UI from `index.html`
- Building login/signup forms
- Creating a dashboard to view recordings
- Integrating with this backend API

---

## Quick Reference

**Server Commands:**
```bash
npm run dev      # Start with auto-reload
npm start        # Start production mode
npm run migrate  # Run database migrations
```

**Test Connection:**
```bash
node backend/test-db.js
```

**Check Health:**
```bash
curl http://localhost:3001/health
```

**View Logs:**
Server logs appear in the terminal where you ran `npm run dev`
