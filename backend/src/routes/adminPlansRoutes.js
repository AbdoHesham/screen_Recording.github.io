const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');
const { query } = require('../db/connection');

/**
 * GET /api/admin/plans
 * Get all plans with their features
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const plansResult = await query(
      `SELECT id, name, description, price_monthly, price_yearly,
              credits_included, is_active, is_default, sort_order, created_at
       FROM plans
       ORDER BY sort_order ASC, name ASC`
    );

    // Get features for each plan
    const plans = await Promise.all(plansResult.rows.map(async (plan) => {
      const featuresResult = await query(
        `SELECT f.id, f.name, f.feature_key, pf.limit_value
         FROM plan_features pf
         JOIN features f ON pf.feature_id = f.id
         WHERE pf.plan_id = $1`,
        [plan.id]
      );

      return {
        ...plan,
        features: featuresResult.rows
      };
    }));

    res.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({
      error: 'Failed to fetch plans'
    });
  }
});

/**
 * POST /api/admin/plans
 * Create a new plan
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      price_monthly,
      price_yearly,
      credits_included,
      is_active,
      is_default,
      sort_order
    } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Plan name is required'
      });
    }

    const result = await query(
      `INSERT INTO plans (name, description, price_monthly, price_yearly,
                         credits_included, is_active, is_default, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, description, price_monthly, price_yearly,
                credits_included, is_active, is_default, sort_order`,
      [
        name,
        description || null,
        price_monthly || 0,
        price_yearly || 0,
        credits_included || 0,
        is_active !== false,
        is_default || false,
        sort_order || 0
      ]
    );

    res.status(201).json({
      message: 'Plan created successfully',
      plan: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    if (error.code === '23505') {
      return res.status(400).json({
        error: 'Plan with this name already exists'
      });
    }
    res.status(500).json({
      error: 'Failed to create plan'
    });
  }
});

/**
 * PUT /api/admin/plans/:id
 * Update a plan
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price_monthly,
      price_yearly,
      credits_included,
      is_active,
      is_default,
      sort_order
    } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (price_monthly !== undefined) {
      updates.push(`price_monthly = $${paramCount++}`);
      values.push(price_monthly);
    }

    if (price_yearly !== undefined) {
      updates.push(`price_yearly = $${paramCount++}`);
      values.push(price_yearly);
    }

    if (credits_included !== undefined) {
      updates.push(`credits_included = $${paramCount++}`);
      values.push(credits_included);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (is_default !== undefined) {
      updates.push(`is_default = $${paramCount++}`);
      values.push(is_default);
    }

    if (sort_order !== undefined) {
      updates.push(`sort_order = $${paramCount++}`);
      values.push(sort_order);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No fields to update'
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE plans
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, name, description, price_monthly, price_yearly,
                credits_included, is_active, is_default, sort_order`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Plan not found'
      });
    }

    res.json({
      message: 'Plan updated successfully',
      plan: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({
      error: 'Failed to update plan'
    });
  }
});

/**
 * DELETE /api/admin/plans/:id
 * Delete a plan
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any users are on this plan
    const usersResult = await query(
      'SELECT COUNT(*) FROM users WHERE plan_id = $1',
      [id]
    );

    if (parseInt(usersResult.rows[0].count) > 0) {
      return res.status(400).json({
        error: 'Cannot delete plan with active users'
      });
    }

    const result = await query(
      'DELETE FROM plans WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Plan not found'
      });
    }

    res.json({
      message: 'Plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({
      error: 'Failed to delete plan'
    });
  }
});

/**
 * PUT /api/admin/plans/:id/features
 * Update features for a plan
 */
router.put('/:id/features', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { features } = req.body; // Array of { feature_id, limit_value }

    if (!Array.isArray(features)) {
      return res.status(400).json({
        error: 'Features must be an array'
      });
    }

    // Delete existing plan features
    await query('DELETE FROM plan_features WHERE plan_id = $1', [id]);

    // Insert new plan features
    if (features.length > 0) {
      const values = features.map((f, i) =>
        `($1, $${i * 2 + 2}, $${i * 2 + 3})`
      ).join(', ');

      const params = [id];
      features.forEach(f => {
        params.push(f.feature_id, f.limit_value || null);
      });

      await query(
        `INSERT INTO plan_features (plan_id, feature_id, limit_value)
         VALUES ${values}`,
        params
      );
    }

    res.json({
      message: 'Plan features updated successfully'
    });
  } catch (error) {
    console.error('Error updating plan features:', error);
    res.status(500).json({
      error: 'Failed to update plan features'
    });
  }
});

/**
 * PUT /api/admin/users/:userId/plan
 * Update user's plan
 */
router.put('/users/:userId/plan', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { plan_id } = req.body;

    if (!plan_id) {
      return res.status(400).json({
        error: 'plan_id is required'
      });
    }

    // Verify plan exists
    const planResult = await query(
      'SELECT id FROM plans WHERE id = $1',
      [plan_id]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Plan not found'
      });
    }

    // Update user's plan
    const result = await query(
      `UPDATE users
       SET plan_id = $1
       WHERE id = $2
       RETURNING id, email, plan_id`,
      [plan_id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      message: 'User plan updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user plan:', error);
    res.status(500).json({
      error: 'Failed to update user plan'
    });
  }
});

module.exports = router;
