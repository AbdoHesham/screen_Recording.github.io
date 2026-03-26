const { query } = require('../db/connection');

/**
 * Middleware to check if user has access to a specific feature
 * @param {string} featureKey - The feature_key to check (e.g., 'video_editing')
 * @param {Object} options - Additional options
 * @param {boolean} options.checkQuota - Whether to check usage quota
 * @param {boolean} options.incrementUsage - Whether to increment usage counter
 */
function requireFeature(featureKey, options = {}) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({
          error: 'Authentication required',
          feature: featureKey
        });
      }

      const userId = req.user.userId;

      // Get user's plan
      const userResult = await query(
        'SELECT plan_id FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const planId = userResult.rows[0].plan_id;

      if (!planId) {
        return res.status(403).json({
          error: 'No active subscription plan',
          feature: featureKey,
          upgradeRequired: true
        });
      }

      // Check if feature is included in user's plan
      const featureResult = await query(
        `SELECT pf.limit_value, f.name, f.id
         FROM plan_features pf
         JOIN features f ON pf.feature_id = f.id
         WHERE pf.plan_id = $1 AND f.feature_key = $2 AND f.is_active = true`,
        [planId, featureKey]
      );

      if (featureResult.rows.length === 0) {
        return res.status(403).json({
          error: `Feature '${featureKey}' not available in your plan`,
          feature: featureKey,
          upgradeRequired: true
        });
      }

      const feature = featureResult.rows[0];
      req.feature = {
        id: feature.id,
        name: feature.name,
        key: featureKey,
        limit: feature.limit_value
      };

      // Check quota if required
      if (options.checkQuota && feature.limit_value !== null) {
        const periodStart = new Date();
        periodStart.setDate(1); // First day of current month
        periodStart.setHours(0, 0, 0, 0);

        const usageResult = await query(
          `SELECT usage_count FROM feature_usage
           WHERE user_id = $1 AND feature_id = $2 AND period_start = $3`,
          [userId, feature.id, periodStart.toISOString().split('T')[0]]
        );

        const currentUsage = usageResult.rows.length > 0
          ? usageResult.rows[0].usage_count
          : 0;

        if (currentUsage >= feature.limit_value) {
          return res.status(429).json({
            error: 'Monthly quota exceeded for this feature',
            feature: featureKey,
            limit: feature.limit_value,
            current: currentUsage,
            upgradeRequired: true
          });
        }

        req.featureUsage = {
          current: currentUsage,
          limit: feature.limit_value,
          remaining: feature.limit_value - currentUsage
        };
      }

      next();
    } catch (error) {
      console.error('Feature access check error:', error);
      return res.status(500).json({
        error: 'Failed to verify feature access'
      });
    }
  };
}

/**
 * Increment feature usage after successful operation
 * @param {string} userId - User ID
 * @param {string} featureId - Feature ID
 * @param {Object} metadata - Optional metadata to store (e.g., duration, file size)
 */
async function trackFeatureUsage(userId, featureId, metadata = {}) {
  try {
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    periodEnd.setDate(0); // Last day of month

    await query(
      `INSERT INTO feature_usage (user_id, feature_id, usage_count, last_used_at, period_start, period_end, metadata)
       VALUES ($1, $2, 1, NOW(), $3, $4, $5)
       ON CONFLICT (user_id, feature_id, period_start)
       DO UPDATE SET
         usage_count = feature_usage.usage_count + 1,
         last_used_at = NOW(),
         metadata = EXCLUDED.metadata,
         updated_at = NOW()`,
      [
        userId,
        featureId,
        periodStart.toISOString().split('T')[0],
        periodEnd.toISOString().split('T')[0],
        JSON.stringify(metadata)
      ]
    );
  } catch (error) {
    console.error('Track feature usage error:', error);
    // Don't throw - tracking failure shouldn't break the request
  }
}

/**
 * Log audit event
 * @param {string} userId - User ID
 * @param {string} action - Action performed (e.g., 'plan_changed', 'feature_used')
 * @param {string} resourceType - Type of resource (e.g., 'plan', 'feature')
 * @param {string} resourceId - Resource ID
 * @param {Object} oldValue - Previous value (optional)
 * @param {Object} newValue - New value (optional)
 * @param {Object} req - Express request object for IP/user-agent
 */
async function logAudit(userId, action, resourceType, resourceId, oldValue, newValue, req) {
  try {
    const ipAddress = req?.ip || req?.connection?.remoteAddress || null;
    const userAgent = req?.get('user-agent') || null;

    await query(
      `INSERT INTO feature_audit_log (user_id, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        action,
        resourceType,
        resourceId,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    console.error('Audit log error:', error);
    // Don't throw - audit log failure shouldn't break the request
  }
}

module.exports = {
  requireFeature,
  trackFeatureUsage,
  logAudit
};
