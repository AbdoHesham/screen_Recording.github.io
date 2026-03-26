const { query } = require('../db/connection');

/**
 * Features Service
 * Centralized service for feature access checking and management
 */
class FeaturesService {
  /**
   * Get all features available to a user based on their plan
   * @param {string} userId - User ID
   * @returns {Array} Array of feature objects with usage information
   */
  async getUserFeatures(userId) {
    try {
      const result = await query(
        `SELECT
          f.id,
          f.name,
          f.feature_key,
          f.description,
          pf.limit_value,
          COALESCE(fu.usage_count, 0) as current_usage
         FROM users u
         LEFT JOIN plans p ON u.plan_id = p.id
         LEFT JOIN plan_features pf ON p.id = pf.plan_id
         LEFT JOIN features f ON pf.feature_id = f.id
         LEFT JOIN LATERAL (
           SELECT usage_count
           FROM feature_usage
           WHERE user_id = u.id
             AND feature_id = f.id
             AND period_start = DATE_TRUNC('month', CURRENT_DATE)::date
         ) fu ON true
         WHERE u.id = $1 AND f.is_active = true
         ORDER BY f.name`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        key: row.feature_key,
        description: row.description,
        limit: row.limit_value,
        usage: row.current_usage,
        available: row.limit_value === null || row.current_usage < row.limit_value
      }));
    } catch (error) {
      console.error('Get user features error:', error);
      throw error;
    }
  }

  /**
   * Check if user has access to a specific feature
   * @param {string} userId - User ID
   * @param {string} featureKey - Feature key to check
   * @returns {Object} Object with hasAccess boolean and additional info
   */
  async hasFeatureAccess(userId, featureKey) {
    try {
      const result = await query(
        `SELECT
          f.id,
          f.name,
          pf.limit_value,
          COALESCE(fu.usage_count, 0) as current_usage
         FROM users u
         JOIN plans p ON u.plan_id = p.id
         JOIN plan_features pf ON p.id = pf.plan_id
         JOIN features f ON pf.feature_id = f.id
         LEFT JOIN LATERAL (
           SELECT usage_count
           FROM feature_usage
           WHERE user_id = u.id
             AND feature_id = f.id
             AND period_start = DATE_TRUNC('month', CURRENT_DATE)::date
         ) fu ON true
         WHERE u.id = $1 AND f.feature_key = $2 AND f.is_active = true`,
        [userId, featureKey]
      );

      if (result.rows.length === 0) {
        return {
          hasAccess: false,
          reason: 'not_in_plan',
          message: 'Feature not available in your plan'
        };
      }

      const feature = result.rows[0];

      if (feature.limit_value !== null && feature.current_usage >= feature.limit_value) {
        return {
          hasAccess: false,
          reason: 'quota_exceeded',
          message: 'Monthly quota exceeded for this feature',
          limit: feature.limit_value,
          usage: feature.current_usage
        };
      }

      return {
        hasAccess: true,
        featureId: feature.id,
        featureName: feature.name,
        limit: feature.limit_value,
        usage: feature.current_usage,
        remaining: feature.limit_value !== null
          ? feature.limit_value - feature.current_usage
          : null
      };
    } catch (error) {
      console.error('Has feature access error:', error);
      throw error;
    }
  }

  /**
   * Get all available features in the system
   * @returns {Array} Array of all feature objects
   */
  async getAllFeatures() {
    try {
      const result = await query(
        `SELECT
          id,
          name,
          feature_key,
          description,
          is_active,
          created_at,
          updated_at
         FROM features
         ORDER BY name`
      );

      return result.rows;
    } catch (error) {
      console.error('Get all features error:', error);
      throw error;
    }
  }

  /**
   * Get feature usage summary for a user
   * @param {string} userId - User ID
   * @param {string} featureKey - Optional specific feature key
   * @returns {Object} Usage summary
   */
  async getUserFeatureUsage(userId, featureKey = null) {
    try {
      let queryText = `
        SELECT
          f.name as feature_name,
          f.feature_key,
          fu.usage_count,
          fu.last_used_at,
          fu.period_start,
          fu.period_end,
          pf.limit_value
        FROM feature_usage fu
        JOIN features f ON fu.feature_id = f.id
        LEFT JOIN users u ON fu.user_id = u.id
        LEFT JOIN plan_features pf ON pf.feature_id = f.id AND pf.plan_id = u.plan_id
        WHERE fu.user_id = $1
          AND fu.period_start = DATE_TRUNC('month', CURRENT_DATE)::date
      `;

      const params = [userId];

      if (featureKey) {
        queryText += ' AND f.feature_key = $2';
        params.push(featureKey);
      }

      queryText += ' ORDER BY fu.last_used_at DESC';

      const result = await query(queryText, params);

      return result.rows.map(row => ({
        featureName: row.feature_name,
        featureKey: row.feature_key,
        usageCount: row.usage_count,
        lastUsedAt: row.last_used_at,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        limit: row.limit_value,
        remaining: row.limit_value !== null
          ? Math.max(0, row.limit_value - row.usage_count)
          : null
      }));
    } catch (error) {
      console.error('Get user feature usage error:', error);
      throw error;
    }
  }

  /**
   * Get features included in a specific plan
   * @param {string} planId - Plan ID
   * @returns {Array} Array of features with limits
   */
  async getPlanFeatures(planId) {
    try {
      const result = await query(
        `SELECT
          f.id,
          f.name,
          f.feature_key,
          f.description,
          pf.limit_value
         FROM plan_features pf
         JOIN features f ON pf.feature_id = f.id
         WHERE pf.plan_id = $1 AND f.is_active = true
         ORDER BY f.name`,
        [planId]
      );

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        key: row.feature_key,
        description: row.description,
        limit: row.limit_value,
        unlimited: row.limit_value === null
      }));
    } catch (error) {
      console.error('Get plan features error:', error);
      throw error;
    }
  }
}

module.exports = new FeaturesService();
