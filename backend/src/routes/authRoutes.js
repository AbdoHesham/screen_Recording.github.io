const express = require('express');
const router = express.Router();
const authService = require('../auth/authService');
const { authenticateToken } = require('../middleware/authMiddleware');

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    const result = await authService.register(email, password, fullName || '');

    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('Registration error:', error);

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: error.message
      });
    }

    res.status(500).json({
      error: 'Registration failed. Please try again.'
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const result = await authService.login(email, password);

    res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token
    });
  } catch (error) {
    console.error('Login error:', error);

    if (error.message.includes('Invalid email or password')) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    res.status(500).json({
      error: 'Login failed. Please try again.'
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.userId);

    res.json({
      user
    });
  } catch (error) {
    console.error('Get user error:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch user information'
    });
  }
});

/**
 * GET /api/auth/credits
 * Get user's credit balance and transaction history
 */
router.get('/credits', authenticateToken, async (req, res) => {
  try {
    const { query } = require('../db/connection');

    // Get current balance
    const user = await authService.getUserById(req.user.userId);

    // Get transaction history
    const transactions = await query(
      `SELECT id, amount, transaction_type, description, created_at
       FROM credit_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.userId]
    );

    res.json({
      balance: user.creditsBalance,
      transactions: transactions.rows.map(t => ({
        id: t.id,
        amount: t.amount,
        type: t.transaction_type,
        description: t.description,
        createdAt: t.created_at
      }))
    });
  } catch (error) {
    console.error('Get credits error:', error);
    res.status(500).json({
      error: 'Failed to fetch credit information'
    });
  }
});

/**
 * GET /api/auth/features
 * Get features available to the authenticated user based on their plan
 */
router.get('/features', authenticateToken, async (req, res) => {
  try {
    const featuresService = require('../services/featuresService');
    const features = await featuresService.getUserFeatures(req.user.userId);

    res.json({
      features
    });
  } catch (error) {
    console.error('Get user features error:', error);
    res.status(500).json({
      error: 'Failed to fetch user features'
    });
  }
});

module.exports = router;
