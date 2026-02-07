const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');
const { query } = require('../db/connection');

/**
 * GET /api/admin/features
 * Get all features
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, description, feature_key, is_active, created_at, updated_at
       FROM features
       ORDER BY name ASC`
    );

    res.json({
      features: result.rows
    });
  } catch (error) {
    console.error('Error fetching features:', error);
    res.status(500).json({
      error: 'Failed to fetch features'
    });
  }
});

/**
 * POST /api/admin/features
 * Create a new feature
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, feature_key, is_active } = req.body;

    if (!name || !feature_key) {
      return res.status(400).json({
        error: 'Name and feature_key are required'
      });
    }

    const result = await query(
      `INSERT INTO features (name, description, feature_key, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, feature_key, is_active, created_at`,
      [name, description || null, feature_key, is_active !== false]
    );

    res.status(201).json({
      message: 'Feature created successfully',
      feature: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating feature:', error);
    if (error.code === '23505') {
      return res.status(400).json({
        error: 'Feature with this key already exists'
      });
    }
    res.status(500).json({
      error: 'Failed to create feature'
    });
  }
});

/**
 * PUT /api/admin/features/:id
 * Update a feature
 */
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

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

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No fields to update'
      });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE features
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, name, description, feature_key, is_active, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Feature not found'
      });
    }

    res.json({
      message: 'Feature updated successfully',
      feature: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating feature:', error);
    res.status(500).json({
      error: 'Failed to update feature'
    });
  }
});

/**
 * DELETE /api/admin/features/:id
 * Delete a feature
 */
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM features WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Feature not found'
      });
    }

    res.json({
      message: 'Feature deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting feature:', error);
    res.status(500).json({
      error: 'Failed to delete feature'
    });
  }
});

module.exports = router;
