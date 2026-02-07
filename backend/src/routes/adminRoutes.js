const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const { query } = require('../db/connection');
const bcrypt = require('bcrypt');

/**
 * Admin Dashboard Routes
 * All routes require admin role
 */

/**
 * GET /api/admin/stats
 * Get overall app statistics
 */
router.get('/stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Total users
    const usersResult = await query('SELECT COUNT(*) as total FROM users');
    const totalUsers = parseInt(usersResult.rows[0].total);

    // Users by role
    const roleResult = await query(
      'SELECT role, COUNT(*) as count FROM users GROUP BY role'
    );

    // Total recordings
    const recordingsResult = await query('SELECT COUNT(*) as total FROM recordings');
    const totalRecordings = parseInt(recordingsResult.rows[0].total);

    // Total credits distributed
    const creditsResult = await query(
      'SELECT SUM(credits_balance) as total FROM users'
    );
    const totalCredits = parseInt(creditsResult.rows[0].total || 0);

    // Revenue (from credit purchases)
    const revenueResult = await query(`
      SELECT
        SUM(amount) as total_credits_purchased,
        COUNT(*) as total_transactions
      FROM credit_transactions
      WHERE transaction_type = 'purchase'
    `);

    // Calculate approximate revenue (assuming $0.10 per credit)
    const creditsPurchased = parseInt(revenueResult.rows[0].total_credits_purchased || 0);
    const totalRevenue = creditsPurchased * 0.10;

    // New users this month
    const newUsersResult = await query(`
      SELECT COUNT(*) as count
      FROM users
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `);

    // Active users (logged in last 30 days)
    const activeUsersResult = await query(`
      SELECT COUNT(*) as count
      FROM users
      WHERE last_login >= CURRENT_DATE - INTERVAL '30 days'
    `);

    // AI jobs statistics
    const aiJobsResult = await query(`
      SELECT
        COUNT(*) as total_jobs,
        SUM(credits_used) as credits_used,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_jobs
      FROM ai_jobs
    `);

    res.json({
      users: {
        total: totalUsers,
        byRole: roleResult.rows,
        newThisMonth: parseInt(newUsersResult.rows[0].count),
        active30Days: parseInt(activeUsersResult.rows[0].count)
      },
      recordings: {
        total: totalRecordings
      },
      credits: {
        totalDistributed: totalCredits,
        totalPurchased: creditsPurchased,
        totalUsed: parseInt(aiJobsResult.rows[0].credits_used || 0)
      },
      revenue: {
        total: totalRevenue.toFixed(2),
        transactions: parseInt(revenueResult.rows[0].total_transactions || 0)
      },
      aiJobs: {
        total: parseInt(aiJobsResult.rows[0].total_jobs || 0),
        completed: parseInt(aiJobsResult.rows[0].completed_jobs || 0),
        failed: parseInt(aiJobsResult.rows[0].failed_jobs || 0),
        creditsUsed: parseInt(aiJobsResult.rows[0].credits_used || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/admin/users
 * Get all users with pagination
 */
router.get('/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { limit = 50, offset = 0, search = '', role = '' } = req.query;

    let queryText = `
      SELECT
        id, email, full_name, role, credits_balance,
        email_verified, created_at, last_login
      FROM users
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (search) {
      queryText += ` AND (email ILIKE $${paramCount} OR full_name ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (role) {
      queryText += ` AND role = $${paramCount}`;
      params.push(role);
      paramCount++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(queryText, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const countParams = [];
    let countParamNum = 1;

    if (search) {
      countQuery += ` AND (email ILIKE $${countParamNum} OR full_name ILIKE $${countParamNum})`;
      countParams.push(`%${search}%`);
      countParamNum++;
    }

    if (role) {
      countQuery += ` AND role = $${countParamNum}`;
      countParams.push(role);
    }

    const countResult = await query(countQuery, countParams);

    res.json({
      users: result.rows.map(u => ({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        role: u.role,
        creditsBalance: u.credits_balance,
        emailVerified: u.email_verified,
        createdAt: u.created_at,
        lastLogin: u.last_login
      })),
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * POST /api/admin/users
 * Create a new user (admin only)
 */
router.post('/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { email, password, fullName, role = 'free', creditsBalance = 100 } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        error: 'email, password, and fullName are required'
      });
    }

    // Check if user exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, role, credits_balance)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, role, credits_balance, created_at`,
      [email, passwordHash, fullName, role, creditsBalance]
    );

    const user = result.rows[0];

    // Record initial credits
    if (creditsBalance > 0) {
      await query(
        `INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
         VALUES ($1, $2, $3, $4)`,
        [user.id, creditsBalance, 'admin_grant', 'Initial credits granted by admin']
      );
    }

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        creditsBalance: user.credits_balance,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Update user (admin only)
 */
router.patch('/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, creditsBalance, emailVerified } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }

    if (creditsBalance !== undefined) {
      updates.push(`credits_balance = $${paramCount++}`);
      values.push(creditsBalance);
    }

    if (emailVerified !== undefined) {
      updates.push(`email_verified = $${paramCount++}`);
      values.push(emailVerified);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const result = await query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING id, email, full_name, role, credits_balance, email_verified`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * POST /api/admin/users/:id/credits
 * Grant credits to user
 */
router.post('/users/:id/credits', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description = 'Credits granted by admin' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Update user credits
    const userResult = await query(
      `UPDATE users
       SET credits_balance = credits_balance + $1
       WHERE id = $2
       RETURNING id, email, credits_balance`,
      [amount, id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Record transaction
    await query(
      `INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
       VALUES ($1, $2, $3, $4)`,
      [id, amount, 'admin_grant', description]
    );

    res.json({
      message: 'Credits granted successfully',
      user: {
        id: userResult.rows[0].id,
        email: userResult.rows[0].email,
        creditsBalance: userResult.rows[0].credits_balance
      }
    });
  } catch (error) {
    console.error('Error granting credits:', error);
    res.status(500).json({ error: 'Failed to grant credits' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete user (admin only)
 */
router.delete('/users/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (id === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const result = await query(
      'DELETE FROM users WHERE id = $1 RETURNING email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User deleted successfully',
      email: result.rows[0].email
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * GET /api/admin/revenue
 * Get revenue analytics
 */
router.get('/revenue', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // Revenue by month (last 12 months)
    const monthlyRevenue = await query(`
      SELECT
        DATE_TRUNC('month', created_at) as month,
        SUM(amount) as credits_sold,
        COUNT(*) as transactions
      FROM credit_transactions
      WHERE transaction_type = 'purchase'
        AND created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month DESC
    `);

    // Total revenue
    const totalRevenue = await query(`
      SELECT SUM(amount) as total_credits
      FROM credit_transactions
      WHERE transaction_type = 'purchase'
    `);

    const totalCredits = parseInt(totalRevenue.rows[0].total_credits || 0);
    const revenue = totalCredits * 0.10; // $0.10 per credit

    // Revenue this month
    const monthRevenue = await query(`
      SELECT SUM(amount) as credits
      FROM credit_transactions
      WHERE transaction_type = 'purchase'
        AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `);

    const monthCredits = parseInt(monthRevenue.rows[0].credits || 0);

    res.json({
      totalRevenue: revenue.toFixed(2),
      totalCredits,
      monthlyRevenue: monthlyRevenue.rows.map(r => ({
        month: r.month,
        creditsSold: parseInt(r.credits_sold),
        revenue: (parseInt(r.credits_sold) * 0.10).toFixed(2),
        transactions: parseInt(r.transactions)
      })),
      thisMonth: {
        credits: monthCredits,
        revenue: (monthCredits * 0.10).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error fetching revenue:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

/**
 * GET /api/admin/activity
 * Get recent activity log
 */
router.get('/activity', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    // Get recent user registrations
    const registrations = await query(
      `SELECT id, email, full_name, role, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.floor(limit / 3)]
    );

    // Get recent recordings
    const recordings = await query(
      `SELECT r.id, r.title, r.type, r.created_at, u.email
       FROM recordings r
       JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC
       LIMIT $1`,
      [Math.floor(limit / 3)]
    );

    // Get recent credit transactions
    const transactions = await query(
      `SELECT ct.id, ct.amount, ct.transaction_type, ct.created_at, u.email
       FROM credit_transactions ct
       JOIN users u ON ct.user_id = u.id
       ORDER BY ct.created_at DESC
       LIMIT $1`,
      [Math.floor(limit / 3)]
    );

    // Combine and sort by date
    const activity = [
      ...registrations.rows.map(r => ({
        type: 'registration',
        timestamp: r.created_at,
        data: { email: r.email, fullName: r.full_name, role: r.role }
      })),
      ...recordings.rows.map(r => ({
        type: 'recording',
        timestamp: r.created_at,
        data: { title: r.title, type: r.type, email: r.email }
      })),
      ...transactions.rows.map(t => ({
        type: 'transaction',
        timestamp: t.created_at,
        data: { amount: t.amount, transactionType: t.transaction_type, email: t.email }
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));

    res.json({ activity });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

/**
 * GET /api/admin/features
 * Get all feature flags
 */
router.get('/features', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT
        id, feature_name, display_name, description,
        enabled, requires_subscription, required_role,
        created_at, updated_at
       FROM feature_flags
       ORDER BY feature_name`
    );

    res.json({
      features: result.rows.map(f => ({
        id: f.id,
        featureName: f.feature_name,
        displayName: f.display_name,
        description: f.description,
        enabled: f.enabled,
        requiresSubscription: f.requires_subscription,
        requiredRole: f.required_role,
        createdAt: f.created_at,
        updatedAt: f.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching features:', error);
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

/**
 * PATCH /api/admin/features/:id
 * Update feature flag
 */
router.patch('/features/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, requiresSubscription, requiredRole, displayName, description } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (enabled !== undefined) {
      updates.push(`enabled = $${paramCount++}`);
      values.push(enabled);
    }

    if (requiresSubscription !== undefined) {
      updates.push(`requires_subscription = $${paramCount++}`);
      values.push(requiresSubscription);
    }

    if (requiredRole !== undefined) {
      updates.push(`required_role = $${paramCount++}`);
      values.push(requiredRole);
    }

    if (displayName !== undefined) {
      updates.push(`display_name = $${paramCount++}`);
      values.push(displayName);
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const result = await query(
      `UPDATE feature_flags
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount}
       RETURNING id, feature_name, display_name, description,
                 enabled, requires_subscription, required_role,
                 updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    const feature = result.rows[0];

    res.json({
      message: 'Feature flag updated successfully',
      feature: {
        id: feature.id,
        featureName: feature.feature_name,
        displayName: feature.display_name,
        description: feature.description,
        enabled: feature.enabled,
        requiresSubscription: feature.requires_subscription,
        requiredRole: feature.required_role,
        updatedAt: feature.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating feature flag:', error);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
});

module.exports = router;
