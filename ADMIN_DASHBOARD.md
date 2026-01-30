# 🔐 Admin Dashboard - Complete Guide

## ✅ What's New

You now have a **full-featured admin dashboard** with:

- 📊 **Overview Dashboard** - Total users, revenue, recordings, credits
- 👥 **User Management** - View, create, edit, delete users
- 💰 **Revenue Analytics** - Track income and transactions
- 🎁 **Credit Management** - Grant credits to any user
- 🔍 **Search & Filter** - Find users quickly
- 📈 **Statistics** - Real-time app metrics

---

## 🚀 Quick Start

### Step 1: Make Yourself an Admin

Run this command with your email:

```bash
cd backend
node make-admin.js your@email.com
```

**Example:**
```bash
node make-admin.js test@example.com
```

**Output:**
```
✅ User updated successfully!
   Email: test@example.com
   Name: Test User
   Role: admin

🔐 This user now has admin access to:
   - User management
   - Revenue analytics
   - System statistics
   - Activity logs
```

### Step 2: Access Admin Dashboard

1. Login to your account at http://localhost:3000/login
2. Go to http://localhost:3000/admin
3. See the full admin dashboard!

---

## 📊 Admin Dashboard Features

### Overview Tab

**Key Metrics:**
- 👥 **Total Users** - With new users this month
- 💵 **Total Revenue** - From credit purchases
- 🎬 **Total Recordings** - All recordings created
- 🪙 **Credits Distributed** - With usage stats

**Breakdown:**
- Users by role (free/pro/admin)
- AI jobs statistics
- Active users (30 days)
- Credits used vs distributed

---

### Users Tab

#### View All Users

**Table Columns:**
- User name & email
- Role (clickable to change)
- Credits (clickable to grant more)
- Join date
- Last login
- Actions (delete)

#### Search Users
Use the search box to find users by name or email:
```
Example: Type "john" to find all Johns
```

#### Add New User

1. Click "**Add User**" button
2. Fill in the form:
   - Email (required)
   - Full Name (required)
   - Password (required)
   - Role: Free / Pro / Admin
   - Initial Credits (default: 100)
3. Click "Create User"
4. User is created instantly!

**Form Fields:**
```
Email: newuser@example.com
Full Name: New User
Password: securepassword123
Role: free (or pro/admin)
Initial Credits: 100
```

#### Edit User

**Change Role:**
1. Click the role badge (e.g., "free")
2. Enter new role: free, pro, or admin
3. Hit Enter to save

**Grant Credits:**
1. Click the credits number
2. Enter credit amount to grant
3. Credits are added to their balance
4. Transaction is recorded

**Delete User:**
1. Click red trash icon
2. Confirm deletion
3. User and all their data is removed

---

### Revenue Tab

**Overview:**
- Total revenue ($)
- Total credits sold
- Active users (30 days)

**Breakdown:**
- Credits purchased (with revenue)
- Credits used by AI
- Average per transaction

**Revenue Calculation:**
- $0.10 per credit
- Tracked from credit_transactions table
- Updates in real-time

---

## 🎯 Common Admin Tasks

### Task 1: Create a Pro User with 500 Credits

1. Go to **Users** tab
2. Click "**Add User**"
3. Fill in:
   ```
   Email: prouser@company.com
   Full Name: Pro User
   Password: pro123pass
   Role: pro
   Initial Credits: 500
   ```
4. Click "Create User"

### Task 2: Grant Bonus Credits

1. Go to **Users** tab
2. Find the user (use search)
3. Click their credits number (e.g., "100")
4. Enter bonus amount: `50`
5. Credits updated to 150!

### Task 3: Promote User to Admin

1. Go to **Users** tab
2. Find the user
3. Click their role badge ("free")
4. Type: `admin`
5. User is now an admin!

### Task 4: View Revenue Stats

1. Go to **Revenue** tab
2. See:
   - Total revenue earned
   - Credits sold
   - Active user count
   - Revenue breakdown

---

## 🔍 API Endpoints (Admin Only)

All endpoints require `Authorization: Bearer <admin-token>` header.

### GET /api/admin/stats
Get overall app statistics.

**Response:**
```json
{
  "users": {
    "total": 42,
    "byRole": [
      { "role": "free", "count": "38" },
      { "role": "pro", "count": "3" },
      { "role": "admin", "count": "1" }
    ],
    "newThisMonth": 12,
    "active30Days": 28
  },
  "recordings": { "total": 156 },
  "credits": {
    "totalDistributed": 4200,
    "totalPurchased": 1500,
    "totalUsed": 850
  },
  "revenue": {
    "total": "150.00",
    "transactions": 15
  }
}
```

### GET /api/admin/users?limit=50&offset=0&search=&role=
Get all users with pagination.

**Query Params:**
- `limit` - Users per page (default: 50)
- `offset` - Skip first N users
- `search` - Filter by email/name
- `role` - Filter by role (free/pro/admin)

### POST /api/admin/users
Create a new user.

**Body:**
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "fullName": "New User",
  "role": "free",
  "creditsBalance": 100
}
```

### PATCH /api/admin/users/:id
Update user.

**Body:**
```json
{
  "role": "pro",
  "creditsBalance": 500,
  "emailVerified": true
}
```

### POST /api/admin/users/:id/credits
Grant credits to user.

**Body:**
```json
{
  "amount": 100,
  "description": "Bonus credits for feedback"
}
```

### DELETE /api/admin/users/:id
Delete a user (cannot delete yourself).

### GET /api/admin/revenue
Get revenue analytics.

### GET /api/admin/activity?limit=50
Get recent activity log.

---

## 🔒 Security Features

**Admin-Only Access:**
- All admin routes require `admin` role
- Non-admins get 403 Forbidden
- Auto-redirect to dashboard if unauthorized

**Self-Protection:**
- Admins cannot delete themselves
- Prevents accidental lockout

**Audit Trail:**
- All credit grants are logged
- Transaction history tracked
- User actions recorded

---

## 📈 Use Cases

### For SaaS Owner:
- Monitor user growth
- Track revenue trends
- Manage user accounts
- Grant promotional credits
- Identify active vs inactive users

### For Support Team:
- Look up user accounts
- Grant refund credits
- Verify user information
- Assist with account issues

### For Sales Team:
- Create demo accounts
- Set up trial users
- Grant bonus credits
- Track conversions

---

## 🧪 Testing the Admin Dashboard

### Test 1: View Statistics
1. Go to http://localhost:3000/admin
2. See Overview tab
3. Verify all numbers are correct

### Test 2: Search Users
1. Go to Users tab
2. Type in search box
3. See filtered results

### Test 3: Add User
1. Click "Add User"
2. Fill form
3. Submit
4. See new user in list

### Test 4: Grant Credits
1. Click any user's credits
2. Enter amount: 50
3. See credits updated

### Test 5: Change Role
1. Click user's role badge
2. Enter "pro"
3. See role changed

---

## 🐛 Troubleshooting

### Issue: "Access denied. Admin role required."

**Cause**: Your account doesn't have admin role

**Fix**:
```bash
cd backend
node make-admin.js your@email.com
```
Then logout and login again.

### Issue: Can't see admin menu

**Fix**: The admin dashboard is at `/admin`, not linked in nav yet. Manually go to:
```
http://localhost:3000/admin
```

### Issue: 403 error on admin endpoints

**Check**:
1. You're logged in
2. Your role is "admin" (check database)
3. Token is valid (try logout/login)

**Verify in database:**
```bash
cd backend
node -e "const { query } = require('./src/db/connection'); (async () => { const r = await query('SELECT email, role FROM users WHERE email = \$1', ['your@email.com']); console.log(r.rows[0]); process.exit(0); })()"
```

---

## 📊 Database Queries

### View all admins:
```sql
SELECT email, full_name, role, created_at
FROM users
WHERE role = 'admin';
```

### View revenue:
```sql
SELECT
  SUM(amount) as total_credits,
  COUNT(*) as transactions
FROM credit_transactions
WHERE transaction_type = 'purchase';
```

### View user stats:
```sql
SELECT
  role,
  COUNT(*) as count,
  SUM(credits_balance) as total_credits
FROM users
GROUP BY role;
```

---

## 🎨 Customization

### Add Link to Nav

Edit `frontend/app/dashboard/page.tsx`:

```tsx
{user?.role === 'admin' && (
  <Link href="/admin" className="btn bg-purple-100 text-purple-700">
    <FaCog /> Admin
  </Link>
)}
```

### Change Revenue Calculation

Edit `backend/src/routes/adminRoutes.js`:

```javascript
// Change from $0.10 per credit to $0.15
const revenue = totalCredits * 0.15;
```

### Add Custom User Field

1. Add column to database
2. Update admin routes
3. Update form in admin page

---

## 🚀 What's Next

**Potential Enhancements:**
- [ ] Export users to CSV
- [ ] Bulk credit grants
- [ ] Email users from admin
- [ ] Advanced analytics charts
- [ ] User activity timeline
- [ ] Credit usage breakdown
- [ ] Subscription management
- [ ] Automated reports

---

## 📝 Summary

**You Now Have:**
- ✅ Full admin dashboard at `/admin`
- ✅ User management (CRUD operations)
- ✅ Credit management (grant/track)
- ✅ Revenue analytics
- ✅ System statistics
- ✅ Search and filtering
- ✅ Role-based access control
- ✅ Admin API endpoints

**To Get Started:**
```bash
# 1. Make yourself admin
cd backend
node make-admin.js your@email.com

# 2. Access dashboard
# Go to: http://localhost:3000/admin

# 3. Start managing your app!
```

**Access it now:** http://localhost:3000/admin 🎉
