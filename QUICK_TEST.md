# Quick Test Guide - ProScreen Recorder

## ✅ Backend is Ready!

Your backend is now fully operational with:
- ✅ Connected to Neon PostgreSQL database
- ✅ All 11 tables created and seeded
- ✅ Authentication working
- ✅ Credit system active

## 🚀 Test the Frontend Now

### Step 1: Make Sure Both Servers Are Running

**Backend** (should already be running):
```bash
cd backend
npm run dev
# Should show: Server running on port 3001
```

**Frontend** (start if not running):
```bash
# Open a new terminal
cd frontend
npm run dev
# Should show: Ready on http://localhost:3000
```

### Step 2: Test User Registration

1. **Open your browser**: http://localhost:3000

2. **Click "Start Recording Now"** button (should redirect to register page)

3. **Fill in the registration form**:
   ```
   Full Name: Your Name
   Email: your@email.com
   Password: password123
   Confirm Password: password123
   ```

4. **Click "Create Account"**

5. **Expected Result**:
   - You should be redirected to http://localhost:3000/dashboard
   - See your name in the header
   - See "100 Credits" displayed
   - See "No recordings yet" message

### Step 3: Test Logout & Login

1. **Click "Logout"** button in the top right
   - Should redirect to homepage (/)

2. **Click "Get Started"** or visit http://localhost:3000/login

3. **Login with your credentials**:
   ```
   Email: your@email.com
   Password: password123
   ```

4. **Expected Result**:
   - Redirected back to dashboard
   - Still shows 100 credits
   - Your name appears in header

### Step 4: Check Browser Console (Important!)

Open browser DevTools (F12) and check:

**Console Tab**: Should show API calls
```
✅ Login successful
✅ Loaded user data
✅ Loaded credits
```

**Network Tab**: Should show successful API requests
```
✅ POST /api/auth/login → 200 OK
✅ GET /api/auth/me → 200 OK
✅ GET /api/auth/credits → 200 OK
```

**Application Tab → Local Storage**: Should contain
```
token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
user: {"id":"...","email":"...","fullName":"..."}
```

## 🧪 Test with Multiple Users

Try registering a second user:

1. **Logout** from current account
2. **Register** with different email: user2@test.com
3. **Verify** they also get 100 credits
4. **Switch** between users to test isolation

## ✅ What Should Work

- ✅ User registration with welcome credits
- ✅ Login with email and password
- ✅ Dashboard shows user name and credits
- ✅ Logout redirects to homepage
- ✅ Protected routes redirect to login if not authenticated
- ✅ Credits balance persists across logins

## ❌ What Won't Work Yet (Expected)

- ❌ **Recording functionality** - Not yet ported from script.js (Phase 2 remaining)
- ❌ **Video uploads** - AWS S3 not configured
- ❌ **Payment system** - Stripe not integrated yet (Phase 3)
- ❌ **AI features** - Anthropic integration pending (Phase 4)

## 🐛 Troubleshooting

### Issue: Can't register on frontend

**Check**:
1. Backend running? `curl http://localhost:3001/health`
2. Browser console shows errors?
3. Try direct API test:
   ```bash
   curl -X POST http://localhost:3001/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test2@test.com","password":"test1234","fullName":"Test User 2"}'
   ```

### Issue: "Network Error" on registration

**Fix**:
1. Verify backend is on port 3001
2. Check frontend API client URL: `frontend/lib/api-client.ts`
3. Should be: `const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';`

### Issue: Redirects to login immediately after registration

**Check**:
1. Open browser DevTools → Application → Local Storage
2. Verify `token` exists
3. If missing, check Network tab for registration response
4. Token should be in response and saved to localStorage

### Issue: Dashboard shows old data

**Fix**:
1. Clear localStorage: DevTools → Application → Local Storage → Clear All
2. Refresh page
3. Login again

### Issue: CORS errors in console

**Check**:
1. Backend has CORS enabled for localhost:3000
2. Verify in `backend/src/server.js`:
   ```javascript
   app.use(cors({
     origin: 'http://localhost:3000',
     credentials: true
   }));
   ```

## 📊 Verify Backend Directly (Without Frontend)

If frontend has issues, test backend directly:

```bash
# 1. Register a user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"direct@test.com","password":"test1234","fullName":"Direct Test"}'

# Save the token from response

# 2. Get user profile
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 3. Get credits
curl -X GET http://localhost:3001/api/auth/credits \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🎯 Next Steps After Testing

Once registration and login work on the frontend:

### Immediate Next Task (Phase 2 Continued):
Port recording functionality from the original `script.js` to React:

1. **Create recording hook**: `frontend/src/hooks/useRecording.ts`
2. **Create recording page**: `frontend/src/app/record/page.tsx`
3. **Port MediaRecorder logic** from `script.js` lines 183-272
4. **Add S3 upload integration**

**Original recording code location**: `script.js`
- Screen recording: lines 183-218
- Voice recording: lines 219-272
- Media stream management: lines 79-182

## 📝 Test Checklist

Mark these off as you test:

- [ ] Homepage loads at http://localhost:3000
- [ ] "Start Recording Now" button works
- [ ] Register page loads and form appears
- [ ] Can register with valid credentials
- [ ] Redirects to dashboard after registration
- [ ] Dashboard shows correct username
- [ ] Dashboard shows 100 credits
- [ ] Can logout successfully
- [ ] Can login with registered credentials
- [ ] Credits persist after logout/login
- [ ] Browser console shows no errors
- [ ] Network tab shows successful API calls

## 🎉 Success Criteria

**Your app is working if**:
1. ✅ You can register a new user
2. ✅ Registration gives you 100 credits
3. ✅ You can login
4. ✅ Dashboard displays your information
5. ✅ You can logout and login again
6. ✅ No errors in browser console

**Once these work, Phase 1 & 2 (Auth/UI) are complete!** 🚀

Next milestone: Adding recording functionality (Phase 2 continuation).
