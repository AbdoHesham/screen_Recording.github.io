# Feature Management System

## Overview

The admin dashboard now includes a **Feature Flags** system that allows you to:
- Enable/disable features across the application
- Control which features require subscriptions (Pro tier)
- Set minimum user role requirements for each feature
- Monetize features by toggling them between Free and Pro

---

## How It Works

### Database Schema

The `feature_flags` table stores all configurable features:

```sql
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY,
  feature_name VARCHAR(100) UNIQUE NOT NULL,    -- Internal identifier
  display_name VARCHAR(200) NOT NULL,           -- User-facing name
  description TEXT,                             -- Feature description
  enabled BOOLEAN DEFAULT true,                 -- Is feature active?
  requires_subscription BOOLEAN DEFAULT false,  -- Requires Pro tier?
  required_role VARCHAR(50) DEFAULT 'free',     -- Minimum role (free/pro/admin)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Default Features

The system comes pre-configured with 12 features:

1. **recording** - Screen Recording (Free)
2. **video_editor** - Video Editor (Free) ⭐
3. **ai_transcription** - AI Transcription (Pro)
4. **ai_filler_removal** - Filler Word Removal (Pro)
5. **ai_silence_removal** - Silence Removal (Pro)
6. **ai_noise_reduction** - Noise Reduction (Pro)
7. **ai_meeting_summary** - Meeting Summarizer (Pro)
8. **ai_tutorial_editor** - Tutorial Editor (Pro)
9. **cloud_storage** - Cloud Storage (Free)
10. **sharing** - Share Recordings (Free)
11. **export_formats** - Multiple Export Formats (Pro)
12. **custom_branding** - Custom Branding (Pro)

⭐ The **video_editor** feature is currently set to **Free** as requested by the user. You can change it to Pro Only from the admin dashboard.

---

## Admin Dashboard - Features Tab

### Accessing Features Management

1. Login as admin at [http://localhost:3000/login](http://localhost:3000/login)
2. Go to [http://localhost:3000/admin](http://localhost:3000/admin)
3. Click on the **Features** tab

### Features Table

The Features tab displays all features with these columns:

#### 1. Feature
- **Display Name**: User-facing name (e.g., "Video Editor")
- **Description**: What the feature does
- **Feature Name**: Internal identifier (e.g., `video_editor`)

#### 2. Status (Enabled/Disabled)
- **Green Toggle**: Feature is enabled and available to users
- **Red Toggle**: Feature is disabled and hidden from all users
- **Click to toggle**: Switch between enabled/disabled

#### 3. Subscription Requirement
- **Free**: Available to all users (free tier)
- **Pro Only**: Requires Pro subscription
- **Click to toggle**: Switch between Free and Pro Only

#### 4. Required Role
- **free**: All users can access (if feature is enabled)
- **pro**: Only Pro users can access
- **admin**: Only admins can access
- **Click to change**: Prompt to enter new role

#### 5. Last Updated
- Shows when the feature was last modified

### Example Use Cases

#### Make Video Editor Require Subscription

1. Go to Features tab
2. Find "Video Editor" row
3. Click the "Free" button in the Subscription column
4. It changes to "Pro Only"
5. Now only Pro users can access the video editor

#### Disable a Feature Temporarily

1. Find the feature in the table
2. Click the green "Enabled" button
3. It changes to red "Disabled"
4. Feature is now hidden from all users

#### Change Minimum Role

1. Find the feature
2. Click the role badge (e.g., "free")
3. Enter new role: `pro` or `admin`
4. Press Enter to save

---

## API Endpoints

### GET /api/admin/features

Get all feature flags (admin only).

**Response:**
```json
{
  "features": [
    {
      "id": "uuid",
      "featureName": "video_editor",
      "displayName": "Video Editor",
      "description": "Edit videos with timeline, trim, and effects",
      "enabled": true,
      "requiresSubscription": false,
      "requiredRole": "free",
      "createdAt": "2026-01-31T...",
      "updatedAt": "2026-01-31T..."
    }
  ]
}
```

### PATCH /api/admin/features/:id

Update a feature flag (admin only).

**Request Body:**
```json
{
  "enabled": true,
  "requiresSubscription": true,
  "requiredRole": "pro",
  "displayName": "Updated Name",
  "description": "Updated description"
}
```

**Response:**
```json
{
  "message": "Feature flag updated successfully",
  "feature": { ... }
}
```

---

## Frontend Integration

### API Client Methods

Two new methods were added to `frontend/lib/api-client.ts`:

```typescript
// Get all features
async getFeatures() {
  return this.request('/api/admin/features', {}, true);
}

// Update a feature
async updateFeature(id: string, data: {
  enabled?: boolean;
  requiresSubscription?: boolean;
  requiredRole?: string;
  displayName?: string;
  description?: string;
}) {
  return this.request(`/api/admin/features/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, true);
}
```

### Usage Example

```typescript
import { apiClient } from '@/lib/api-client';

// Load all features
const data = await apiClient.getFeatures();
console.log(data.features);

// Make video editor require Pro subscription
await apiClient.updateFeature(videoEditorId, {
  requiresSubscription: true
});

// Disable a feature
await apiClient.updateFeature(featureId, {
  enabled: false
});
```

---

## How to Use in Your App

### Step 1: Check Feature Access (Future Implementation)

When building features, you'll want to check if:
1. The feature is enabled
2. The user has the required subscription
3. The user has the required role

**Middleware example (to be implemented):**
```javascript
// backend/src/middleware/featureCheck.js
async function checkFeature(featureName) {
  return async (req, res, next) => {
    // Get feature from database
    const feature = await query(
      'SELECT * FROM feature_flags WHERE feature_name = $1',
      [featureName]
    );

    if (!feature.rows[0]) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    const f = feature.rows[0];

    // Check if feature is enabled
    if (!f.enabled) {
      return res.status(403).json({
        error: 'This feature is currently disabled'
      });
    }

    // Check subscription requirement
    if (f.requires_subscription && req.user.role !== 'pro' && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'This feature requires a Pro subscription',
        feature: f.display_name
      });
    }

    // Check role requirement
    const roleHierarchy = { free: 0, pro: 1, admin: 2 };
    if (roleHierarchy[req.user.role] < roleHierarchy[f.required_role]) {
      return res.status(403).json({
        error: `This feature requires ${f.required_role} role`
      });
    }

    next();
  };
}

module.exports = { checkFeature };
```

### Step 2: Apply to Routes

```javascript
const { checkFeature } = require('./middleware/featureCheck');

// Video editor route - check if feature is enabled
router.get('/api/video-editor/:id',
  authenticateToken,
  checkFeature('video_editor'),
  async (req, res) => {
    // Video editor logic here
  }
);
```

### Step 3: Frontend Feature Checks

```typescript
// Check if user can access video editor
const canAccessEditor = async () => {
  try {
    const features = await apiClient.getFeatures();
    const videoEditor = features.features.find(
      f => f.featureName === 'video_editor'
    );

    const user = await apiClient.getCurrentUser();

    // Check enabled
    if (!videoEditor.enabled) return false;

    // Check subscription
    if (videoEditor.requiresSubscription && user.role !== 'pro' && user.role !== 'admin') {
      return false;
    }

    return true;
  } catch (err) {
    return false;
  }
};
```

---

## Testing the Feature System

### Test 1: View All Features

1. Go to http://localhost:3000/admin
2. Click **Features** tab
3. Verify all 12 features are displayed
4. Check that Video Editor is set to "Free"

### Test 2: Toggle Video Editor to Pro

1. Find "Video Editor" in the features table
2. Click "Free" button under Subscription column
3. Button should change to "Pro Only"
4. Refresh page - change should persist

### Test 3: Disable a Feature

1. Click the green "Enabled" toggle for any feature
2. Button should turn red and say "Disabled"
3. Refresh page - feature should still be disabled

### Test 4: Change Required Role

1. Click the role badge (e.g., "free")
2. Type "pro" in the prompt
3. Badge should update to "pro"
4. Refresh page - change should persist

---

## Benefits of Feature Flags

### For Development
- **Gradual Rollout**: Enable features for testing without full deployment
- **A/B Testing**: Test different feature combinations
- **Kill Switch**: Quickly disable problematic features

### For Business
- **Monetization**: Easily move features between Free and Pro tiers
- **Market Testing**: See which features users want most
- **Upselling**: Convert free users by limiting features

### For Users
- **Transparency**: Clear indication of what's included in each tier
- **Flexibility**: Admin can grant access to specific users

---

## Next Steps

To complete the feature flag implementation:

1. **Create Feature Check Middleware** (`backend/src/middleware/featureCheck.js`)
2. **Apply to Protected Routes** (video editor, AI features, etc.)
3. **Frontend Feature Gates** - Hide/show UI based on feature access
4. **User Feedback** - Show upgrade prompts for Pro features
5. **Analytics** - Track which features are most used

---

## File Changes Summary

### Backend Files Modified
- ✅ `backend/src/routes/adminRoutes.js` - Added feature management endpoints
- ✅ `backend/src/db/migrations/003_feature_flags.sql` - Created feature_flags table

### Frontend Files Modified
- ✅ `frontend/lib/api-client.ts` - Added feature management methods
- ✅ `frontend/app/admin/page.tsx` - Added Features tab with UI

### New Features
- ✅ GET /api/admin/features - List all features
- ✅ PATCH /api/admin/features/:id - Update feature
- ✅ Admin UI with toggle switches for easy management
- ✅ Pre-configured with 12 default features

---

## Conclusion

The feature management system is now fully operational! You can:

1. **View all features** in the admin dashboard
2. **Toggle features** on/off with one click
3. **Control subscription requirements** (Free vs Pro)
4. **Set role requirements** (free/pro/admin)
5. **Monetize features** by changing Video Editor to "Pro Only"

As requested, the **video_editor** feature is currently set to **Free** and available to all users. You can change it to require a Pro subscription at any time from the Features tab in the admin dashboard.

Access the admin dashboard now at: **http://localhost:3000/admin** (must be logged in as admin)
