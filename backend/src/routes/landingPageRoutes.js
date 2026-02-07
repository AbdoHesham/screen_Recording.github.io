const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');
const { query } = require('../db/connection');

/**
 * GET /api/landing-page/content
 * Get all landing page content (public)
 */
router.get('/content', async (req, res) => {
  try {
    const result = await query(
      `SELECT section_key, content_type, content_value, is_active, sort_order
       FROM landing_page_content
       WHERE is_active = true
       ORDER BY sort_order ASC, section_key ASC`
    );

    // Transform into key-value object
    const content = {};
    result.rows.forEach(row => {
      content[row.section_key] = {
        type: row.content_type,
        value: row.content_value
      };
    });

    res.json({ content });
  } catch (error) {
    console.error('Error fetching landing page content:', error);
    res.status(500).json({
      error: 'Failed to fetch landing page content'
    });
  }
});

/**
 * GET /api/admin/landing-page
 * Get all landing page content for admin
 */
router.get('/admin/landing-page', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, section_key, content_type, content_value, is_active, sort_order, updated_at
       FROM landing_page_content
       ORDER BY sort_order ASC, section_key ASC`
    );

    res.json({
      content: result.rows
    });
  } catch (error) {
    console.error('Error fetching landing page content:', error);
    res.status(500).json({
      error: 'Failed to fetch landing page content'
    });
  }
});

/**
 * POST /api/admin/landing-page
 * Create new landing page content
 */
router.post('/admin/landing-page', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { section_key, content_type, content_value, is_active } = req.body;

    if (!section_key || !content_type || !content_value) {
      return res.status(400).json({
        error: 'section_key, content_type, and content_value are required'
      });
    }

    // Get the max sort_order and increment
    const maxOrderResult = await query(
      'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM landing_page_content'
    );
    const nextOrder = maxOrderResult.rows[0].max_order + 10;

    const result = await query(
      `INSERT INTO landing_page_content (section_key, content_type, content_value, is_active, sort_order, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, section_key, content_type, content_value, is_active, sort_order, updated_at`,
      [section_key, content_type, content_value, is_active !== false, nextOrder, req.user.userId]
    );

    res.status(201).json({
      message: 'Content created successfully',
      content: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating landing page content:', error);
    if (error.code === '23505') {
      return res.status(400).json({
        error: 'Content with this section key already exists'
      });
    }
    res.status(500).json({
      error: 'Failed to create content'
    });
  }
});

/**
 * PUT /api/admin/landing-page/:id
 * Update landing page content
 */
router.put('/admin/landing-page/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { content_value, is_active } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (content_value !== undefined) {
      updates.push(`content_value = $${paramCount++}`);
      values.push(content_value);
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
    updates.push(`updated_by = $${paramCount++}`);
    values.push(req.user.userId);
    values.push(id);

    const result = await query(
      `UPDATE landing_page_content
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, section_key, content_type, content_value, is_active, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Content not found'
      });
    }

    res.json({
      message: 'Content updated successfully',
      content: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating landing page content:', error);
    res.status(500).json({
      error: 'Failed to update content'
    });
  }
});

/**
 * DELETE /api/admin/landing-page/:id
 * Delete landing page content
 */
router.delete('/admin/landing-page/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM landing_page_content WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Content not found'
      });
    }

    res.json({
      message: 'Content deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting landing page content:', error);
    res.status(500).json({
      error: 'Failed to delete content'
    });
  }
});

/**
 * PUT /api/admin/landing-page/reorder
 * Update sort order for landing page content (batch update)
 */
router.put('/admin/landing-page/reorder', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { items } = req.body; // Array of { id, sort_order }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'items array is required'
      });
    }

    // Update all items in a transaction
    const client = await require('../db/connection').pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of items) {
        await client.query(
          'UPDATE landing_page_content SET sort_order = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [item.sort_order, item.id]
        );
      }

      await client.query('COMMIT');

      res.json({
        message: 'Sort order updated successfully'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating sort order:', error);
    res.status(500).json({
      error: 'Failed to update sort order'
    });
  }
});

module.exports = router;
