# ProScreen Recorder Backend API

## Overview

This is the backend API server for ProScreen Recorder SaaS platform. It provides authentication, file storage, AI processing, and payment management.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Storage**: AWS S3
- **AI**: Anthropic Claude API
- **Payment**: Stripe
- **Queue**: Bull + Redis (for AI processing)

---

## Setup Instructions

### Prerequisites

Before running the backend, ensure you have:

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- AWS Account with S3 access
- Anthropic API key
- Stripe account (for payments)
- Redis (optional, for Phase 4+)

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

### Step 2: Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=proscreen_db
DB_USER=postgres
DB_PASSWORD=your_password_here

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_min_32_characters_long
JWT_EXPIRES_IN=7d

# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET_NAME=proscreen-recordings

# Stripe Configuration (get from https://dashboard.stripe.com)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Anthropic API Configuration (get from https://console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-...

# Redis Configuration (for Phase 4+)
REDIS_URL=redis://localhost:6379

# CORS Configuration
FRONTEND_URL=http://localhost:3000
```

### Step 3: Set Up PostgreSQL Database

#### Option A: Local PostgreSQL

1. Install PostgreSQL:
   - **Windows**: Download from https://www.postgresql.org/download/windows/
   - **Mac**: `brew install postgresql@14`
   - **Linux**: `sudo apt-get install postgresql-14`

2. Create database:

```bash
# Access PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE proscreen_db;

# Exit psql
\q
```

#### Option B: Cloud PostgreSQL (Recommended for Production)

Use a managed PostgreSQL service:
- **Supabase**: https://supabase.com (Free tier available)
- **Neon**: https://neon.tech (Free tier available)
- **AWS RDS**: https://aws.amazon.com/rds/
- **Railway**: https://railway.app

Update `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD` in `.env` with your cloud database credentials.

### Step 4: Run Database Migrations

```bash
npm run migrate
```

You should see output like:

```
🔄 Starting database migrations...

▶️  Running migration: 001_initial_schema.sql
✅ Migration 001_initial_schema.sql completed successfully

🎉 All migrations completed successfully!
```

### Step 5: Set Up AWS S3 Bucket

1. Log in to AWS Console: https://console.aws.amazon.com/s3/
2. Create a new bucket:
   - Name: `proscreen-recordings` (or your preferred name)
   - Region: `us-east-1` (or your preferred region)
   - **Important**: Block all public access (we'll use presigned URLs)
3. Configure CORS (for direct browser uploads):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

4. Create IAM user with S3 access:
   - Go to IAM → Users → Add User
   - Enable "Programmatic access"
   - Attach policy: `AmazonS3FullAccess` (or create a custom policy)
   - Save Access Key ID and Secret Access Key to `.env`

### Step 6: Get Anthropic API Key

1. Go to: https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys
4. Create a new key
5. Copy to `.env` as `ANTHROPIC_API_KEY`

**Note**: This is for Phase 4+. You can skip this for Phase 1.

### Step 7: Set Up Stripe (Optional for Phase 1)

1. Go to: https://dashboard.stripe.com/
2. Sign up for account
3. Get test keys from Developers → API keys
4. Copy Secret key to `.env` as `STRIPE_SECRET_KEY`
5. For webhooks (Phase 3):
   - Install Stripe CLI: https://stripe.com/docs/stripe-cli
   - Run: `stripe listen --forward-to localhost:3001/api/payment/webhook`

---

## Running the Server

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

You should see:

```
╔═══════════════════════════════════════════════╗
║   ProScreen Recorder API Server              ║
║                                               ║
║   🚀 Server running on port 3001              ║
║   🌍 Environment: development                 ║
║   🔗 Health check: http://localhost:3001/health ║
║                                               ║
║   Available endpoints:                        ║
║   Auth:                                       ║
║   - POST /api/auth/register                   ║
║   - POST /api/auth/login                      ║
║   - GET  /api/auth/me                         ║
║   - GET  /api/auth/credits                    ║
║   Recordings:                                 ║
║   - POST /api/recordings/presigned-url        ║
║   - GET  /api/recordings                      ║
║   - POST /api/recordings                      ║
║   - GET  /api/recordings/:id                  ║
║                                               ║
╚═══════════════════════════════════════════════╝
```

### Health Check

Visit: http://localhost:3001/health

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-30T...",
  "uptime": 123.456,
  "environment": "development"
}
```

---

## API Documentation

### Authentication Endpoints

#### 1. Register New User

**POST** `/api/auth/register`

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "fullName": "John Doe"
}
```

**Response (201):**

```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "free",
    "creditsBalance": 100
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### 2. Login

**POST** `/api/auth/login`

**Request:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**

```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "free",
    "creditsBalance": 100
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### 3. Get Current User

**GET** `/api/auth/me`

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "fullName": "John Doe",
    "role": "free",
    "creditsBalance": 95,
    "emailVerified": false,
    "createdAt": "2026-01-30T...",
    "lastLogin": "2026-01-30T..."
  }
}
```

---

#### 4. Get Credits Balance

**GET** `/api/auth/credits`

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "balance": 95,
  "transactions": [
    {
      "id": "uuid",
      "amount": -5,
      "type": "usage",
      "description": "AI transcription enhancement",
      "createdAt": "2026-01-30T..."
    },
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

---

### Recording Endpoints

#### 1. Get Presigned Upload URL

**POST** `/api/recordings/presigned-url`

**Headers:**

```
Authorization: Bearer <token>
```

**Request:**

```json
{
  "fileName": "my-recording.webm",
  "fileType": "video/webm",
  "recordingType": "screen"
}
```

**Response (200):**

```json
{
  "uploadUrl": "https://proscreen-recordings.s3.amazonaws.com/recordings/...",
  "key": "recordings/user-uuid/screen/unique-id.webm",
  "fileUrl": "https://proscreen-recordings.s3.amazonaws.com/recordings/..."
}
```

**Usage:**

```javascript
// 1. Get presigned URL
const { uploadUrl, fileUrl } = await fetch('/api/recordings/presigned-url', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fileName: file.name,
    fileType: file.type,
    recordingType: 'screen'
  })
}).then(r => r.json());

// 2. Upload file directly to S3
await fetch(uploadUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type }
});

// 3. Create recording entry
await fetch('/api/recordings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'My Recording',
    type: 'screen',
    rawFileUrl: fileUrl,
    durationSeconds: 120,
    fileSizeBytes: file.size
  })
});
```

---

#### 2. Create Recording Entry

**POST** `/api/recordings`

**Headers:**

```
Authorization: Bearer <token>
```

**Request:**

```json
{
  "title": "Team Meeting - Jan 30",
  "description": "Weekly standup discussion",
  "type": "screen",
  "rawFileUrl": "https://s3.amazonaws.com/...",
  "durationSeconds": 3600,
  "fileSizeBytes": 104857600,
  "metadata": {
    "resolution": "1920x1080",
    "codec": "vp9"
  }
}
```

**Response (201):**

```json
{
  "message": "Recording created successfully",
  "recording": {
    "id": "uuid",
    "title": "Team Meeting - Jan 30",
    "type": "screen",
    "status": "ready",
    "createdAt": "2026-01-30T..."
  }
}
```

---

#### 3. List All Recordings

**GET** `/api/recordings?limit=20&offset=0&status=ready`

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "recordings": [
    {
      "id": "uuid",
      "title": "Team Meeting - Jan 30",
      "description": "Weekly standup",
      "type": "screen",
      "status": "ready",
      "rawFileUrl": "https://...",
      "processedFileUrl": null,
      "thumbnailUrl": null,
      "durationSeconds": 3600,
      "fileSizeBytes": 104857600,
      "metadata": { "resolution": "1920x1080" },
      "createdAt": "2026-01-30T...",
      "updatedAt": "2026-01-30T..."
    }
  ],
  "total": 15,
  "limit": 20,
  "offset": 0
}
```

---

#### 4. Get Recording by ID

**GET** `/api/recordings/:id`

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "recording": {
    "id": "uuid",
    "title": "Team Meeting - Jan 30",
    "description": "Weekly standup",
    "type": "screen",
    "status": "ready",
    "rawFileUrl": "https://...",
    "processedFileUrl": null,
    "thumbnailUrl": null,
    "durationSeconds": 3600,
    "fileSizeBytes": 104857600,
    "metadata": { "resolution": "1920x1080" },
    "createdAt": "2026-01-30T...",
    "updatedAt": "2026-01-30T...",
    "transcription": {
      "rawText": "Hello everyone, let's start...",
      "enhancedText": "Hello everyone, let's start...",
      "language": "en-US"
    }
  }
}
```

---

#### 5. Delete Recording

**DELETE** `/api/recordings/:id`

**Headers:**

```
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "message": "Recording deleted successfully"
}
```

---

## Database Schema

See [src/db/migrations/001_initial_schema.sql](src/db/migrations/001_initial_schema.sql) for the complete schema.

**Key Tables:**

- `users` - User accounts with authentication
- `recordings` - Recording metadata
- `transcriptions` - Transcription data
- `ai_jobs` - AI processing job queue
- `credit_transactions` - Credit usage audit log
- `agent_personas` - AI agent configurations
- `credit_packages` - Available credit packages

---

## Project Structure

```
backend/
├── src/
│   ├── server.js              # Express app entry point
│   ├── auth/
│   │   └── authService.js     # JWT authentication logic
│   ├── db/
│   │   ├── connection.js      # PostgreSQL connection pool
│   │   ├── migrate.js         # Migration runner
│   │   └── migrations/
│   │       └── 001_initial_schema.sql
│   ├── middleware/
│   │   └── authMiddleware.js  # JWT verification middleware
│   ├── routes/
│   │   ├── authRoutes.js      # Auth endpoints
│   │   └── recordingRoutes.js # Recording endpoints
│   ├── utils/
│   │   └── s3Service.js       # AWS S3 helper functions
│   ├── payment/               # Stripe integration (Phase 3)
│   ├── ai/                    # Anthropic AI services (Phase 4)
│   ├── video/                 # FFmpeg video processing (Phase 5)
│   └── queue/                 # Bull job queue (Phase 4)
├── .env.example               # Environment variable template
├── package.json
└── README.md
```

---

## Troubleshooting

### Database Connection Failed

**Error**: `Connection to database failed`

**Solutions**:

1. Check PostgreSQL is running:
   ```bash
   # Mac/Linux
   sudo systemctl status postgresql

   # Windows
   # Check Services app for "postgresql-x64-14"
   ```

2. Verify credentials in `.env`:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`

3. Test connection:
   ```bash
   psql -h localhost -U postgres -d proscreen_db
   ```

---

### Migration Failed

**Error**: `Migration 001_initial_schema.sql failed`

**Solutions**:

1. Check if tables already exist:
   ```sql
   SELECT tablename FROM pg_tables WHERE schemaname = 'public';
   ```

2. Drop all tables and re-run:
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```

3. Then run migrations again:
   ```bash
   npm run migrate
   ```

---

### S3 Upload Failed

**Error**: `Failed to generate upload URL`

**Solutions**:

1. Verify AWS credentials in `.env`
2. Check IAM user has S3 permissions
3. Verify bucket name and region match

---

### JWT Token Errors

**Error**: `Invalid or expired token`

**Solutions**:

1. Check `JWT_SECRET` is at least 32 characters
2. Verify token format: `Bearer <token>`
3. Token expires after 7 days by default

---

## Next Steps

After completing Phase 1 (Backend Foundation), proceed to:

**Phase 2**: Frontend Migration
- Initialize Next.js 14 project
- Port recording UI from `index.html`
- Integrate with backend API
- Build authentication UI

**Phase 3**: Payment & Credits
- Stripe integration
- Credit purchase flow
- Pricing page

**Phase 4**: AI Processing
- Anthropic Claude integration
- Audio cleanup features
- Transcription enhancement

---

## Support

For issues or questions:

1. Check the [Plan File](../C:\Users\Abdo Hesham\.claude\plans\synchronous-marinating-badger.md)
2. Review API documentation above
3. Check PostgreSQL and S3 configuration

---

## License

ISC
