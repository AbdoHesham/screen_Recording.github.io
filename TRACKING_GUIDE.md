# Dashboard & Database Update Tracking Guide

## Overview

Three methods to track updates in your ProScreen app:

1. **Polling** (Simple) - Refresh data every 30 seconds
2. **Visibility API** (Smart) - Refresh when user returns to tab
3. **WebSocket** (Real-time) - Instant updates via live connection

---

## Method 1: Auto-Refresh with Polling (Easiest)

### How It Works
- Automatically refreshes data every X seconds
- Works without backend changes
- Good for low-traffic apps

### Implementation

```tsx
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

function Dashboard() {
  const [data, setData] = useState([]);

  const loadData = async () => {
    const result = await apiClient.getRecordings();
    setData(result.recordings);
  };

  // Auto-refresh every 30 seconds
  useAutoRefresh(loadData, 30000);

  // Refresh when user returns to tab
  useVisibilityRefresh(loadData);

  return <div>{/* Your UI */}</div>;
}
```

**Pros:**
- ✅ Simple to implement
- ✅ No backend changes needed
- ✅ Works everywhere

**Cons:**
- ❌ Uses bandwidth even when no changes
- ❌ 30-second delay for updates
- ❌ Not truly real-time

---

## Method 2: Database Change Tracking (Backend)

### How It Works
- PostgreSQL triggers log all changes
- Track who changed what and when
- Query audit log to see recent changes

### Setup

1. **Run migration:**
```bash
cd backend
npm run migrate  # Runs 002_change_tracking.sql
```

2. **Query recent changes:**
```sql
SELECT * FROM audit_log
WHERE user_id = 'your-user-id'
ORDER BY changed_at DESC
LIMIT 10;
```

3. **Add API endpoint:**
```javascript
// backend/src/routes/auditRoutes.js
router.get('/audit', authenticateToken, async (req, res) => {
  const changes = await query(
    'SELECT * FROM audit_log WHERE user_id = $1 ORDER BY changed_at DESC LIMIT 50',
    [req.user.userId]
  );
  res.json({ changes: changes.rows });
});
```

**Pros:**
- ✅ Complete audit trail
- ✅ Know exactly what changed
- ✅ Useful for compliance

**Cons:**
- ❌ Requires database query
- ❌ Still needs polling or WebSocket to notify frontend
- ❌ Extra storage for audit log

---

## Method 3: Real-Time with WebSocket (Best for Production)

### How It Works
- Backend notifies frontend instantly when data changes
- Two-way communication channel
- Push updates instead of polling

### Setup

#### Backend Setup

1. **Update server.js:**
```javascript
// backend/src/server.js
const http = require('http');
const WebSocketServer = require('./websocket/wsServer');

const server = http.createServer(app);
const wsServer = new WebSocketServer(server);

// Make wsServer available globally
global.wsServer = wsServer;

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

2. **Notify on changes:**
```javascript
// backend/src/routes/recordingRoutes.js
router.post('/', authenticateToken, async (req, res) => {
  // Create recording...
  const recording = await createRecording(data);

  // Notify user via WebSocket
  if (global.wsServer) {
    global.wsServer.notifyNewRecording(req.user.userId, recording);
  }

  res.json({ recording });
});
```

#### Frontend Setup

```tsx
import { useWebSocket } from '@/hooks/useWebSocket';

function Dashboard() {
  const [recordings, setRecordings] = useState([]);

  const { isConnected, lastMessage } = useWebSocket({
    enabled: true,
    onMessage: (message) => {
      if (message.type === 'new_recording') {
        // Add to list instantly
        setRecordings(prev => [message.data, ...prev]);
      }
      if (message.type === 'credits_updated') {
        setCredits(message.balance);
      }
    }
  });

  return (
    <div>
      <p>Status: {isConnected ? '🟢 Live' : '🔴 Offline'}</p>
      {/* Your UI */}
    </div>
  );
}
```

**Pros:**
- ✅ Instant updates (< 100ms)
- ✅ No polling overhead
- ✅ Scalable for many users
- ✅ Two-way communication

**Cons:**
- ❌ More complex setup
- ❌ Requires WebSocket support
- ❌ Need fallback for old browsers

---

## Which Method to Use?

### For MVP/Testing:
→ **Method 1: Auto-Refresh Polling**
- Quick to implement
- Good enough for < 100 users
- No backend changes

### For Production:
→ **Method 3: WebSocket**
- Best user experience
- Scalable
- Industry standard

### For Compliance/Auditing:
→ **Method 2: Database Tracking**
- Use alongside polling or WebSocket
- Full audit trail
- Meet regulatory requirements

---

## Testing Your Setup

### Test Auto-Refresh

1. Open dashboard: http://localhost:3000/dashboard
2. Open another browser tab
3. Register a new account and create a recording
4. Go back to first tab
5. Wait 30 seconds
6. Recording should appear automatically

### Test WebSocket

1. **Check connection:**
```javascript
// In browser console
const ws = new WebSocket(`ws://localhost:3001/ws?token=${localStorage.getItem('token')}`);
ws.onmessage = (e) => console.log('Received:', JSON.parse(e.data));
```

2. **Trigger an update:**
```bash
# Create a recording via API
curl -X POST http://localhost:3001/api/recordings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","type":"screen","rawFileUrl":"https://example.com/test.webm"}'
```

3. **Check browser console** - should see WebSocket message instantly

---

## Files Created

**Backend:**
- `backend/src/db/migrations/002_change_tracking.sql` - Audit log
- `backend/src/websocket/wsServer.js` - WebSocket server

**Frontend:**
- `frontend/hooks/useAutoRefresh.ts` - Auto-refresh hook
- `frontend/hooks/useWebSocket.ts` - WebSocket hook
- `frontend/app/dashboard/page-with-updates.tsx` - Dashboard with all methods

---

## Next Steps

1. **For testing now:** Use the simple auto-refresh (already in dashboard)

2. **For production:**
   - Enable WebSocket server in backend
   - Use `page-with-updates.tsx` as your dashboard
   - Test with multiple users

3. **For compliance:**
   - Run migration 002
   - Create audit log viewer page
   - Set up log retention policy

---

## Quick Commands

```bash
# Run new migration (database tracking)
cd backend && npm run migrate

# Test WebSocket connection
node -e "const WebSocket = require('ws'); const ws = new WebSocket('ws://localhost:3001/ws?token=YOUR_TOKEN'); ws.onopen = () => console.log('Connected'); ws.onmessage = (e) => console.log('Message:', e.data);"

# Check audit log
psql $DATABASE_URL -c "SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT 10;"
```

---

## Common Issues

**Q: Dashboard not updating?**
A: Check browser console for errors. Verify token is valid. Try manual refresh.

**Q: WebSocket not connecting?**
A: Make sure backend WebSocket server is initialized. Check token is passed correctly.

**Q: Too many database connections?**
A: Auto-refresh creates queries every 30s. Increase interval or use WebSocket.

---

## Performance Tips

1. **Increase polling interval** for less frequent updates:
   ```tsx
   useAutoRefresh(loadData, 60000); // 1 minute
   ```

2. **Disable auto-refresh** when not focused:
   ```tsx
   const [enabled, setEnabled] = useState(true);
   useEffect(() => {
     const handleVisibility = () => {
       setEnabled(document.visibilityState === 'visible');
     };
     document.addEventListener('visibilitychange', handleVisibility);
     return () => document.removeEventListener('visibilitychange', handleVisibility);
   }, []);
   ```

3. **Use WebSocket for high-frequency updates**
   - Recordings completing
   - AI jobs finishing
   - Credit balance changes

---

**Need help?** Check STATUS.md for current implementation status.
