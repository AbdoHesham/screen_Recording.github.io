const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class AuthService {
  /**
   * Register a new user
   * @param {string} email - User email
   * @param {string} password - Plain text password
   * @param {string} fullName - User's full name
   * @returns {Promise<{user, token}>}
   */
  async register(email, password, fullName) {
    try {
      // Check if user already exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const result = await query(
        `INSERT INTO users (email, password_hash, full_name, role, credits_balance)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, full_name, role, credits_balance, created_at`,
        [email, passwordHash, fullName, 'free', 100] // 100 welcome credits
      );

      const user = result.rows[0];

      // Create welcome bonus transaction
      await query(
        `INSERT INTO credit_transactions (user_id, amount, transaction_type, description)
         VALUES ($1, $2, $3, $4)`,
        [user.id, 100, 'bonus', 'Welcome bonus credits']
      );

      // Generate JWT token
      const token = this.generateToken(user);

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          creditsBalance: user.credits_balance
        },
        token
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - Plain text password
   * @returns {Promise<{user, token}>}
   */
  async login(email, password) {
    try {
      // Find user by email
      const result = await query(
        `SELECT id, email, password_hash, full_name, role, credits_balance
         FROM users WHERE email = $1`,
        [email]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = result.rows[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);

      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Update last login
      await query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );

      // Generate JWT token
      const token = this.generateToken(user);

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          creditsBalance: user.credits_balance
        },
        token
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Generate JWT token for user
   * @param {Object} user - User object
   * @returns {string} JWT token
   */
  generateToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Promise<Object>} Decoded token payload
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} User object
   */
  async getUserById(userId) {
    try {
      const result = await query(
        `SELECT id, email, full_name, role, credits_balance, email_verified, created_at, last_login
         FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = result.rows[0];

      return {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        creditsBalance: user.credits_balance,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        lastLogin: user.last_login
      };
    } catch (error) {
      console.error('Get user error:', error);
      throw error;
    }
  }

  /**
   * Update user's credit balance
   * @param {string} userId - User UUID
   * @param {number} amount - Amount to add (positive) or subtract (negative)
   * @param {string} transactionType - Type of transaction
   * @param {string} description - Description of transaction
   * @param {string} relatedJobId - Optional related job ID
   * @returns {Promise<number>} New credit balance
   */
  async updateCredits(userId, amount, transactionType, description, relatedJobId = null) {
    try {
      // Start transaction
      const client = await require('../db/connection').getClient();

      try {
        await client.query('BEGIN');

        // Update user's credit balance
        const updateResult = await client.query(
          `UPDATE users
           SET credits_balance = credits_balance + $1
           WHERE id = $2
           RETURNING credits_balance`,
          [amount, userId]
        );

        if (updateResult.rows.length === 0) {
          throw new Error('User not found');
        }

        const newBalance = updateResult.rows[0].credits_balance;

        // Record transaction
        await client.query(
          `INSERT INTO credit_transactions (user_id, amount, transaction_type, description, related_job_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, amount, transactionType, description, relatedJobId]
        );

        await client.query('COMMIT');

        return newBalance;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Update credits error:', error);
      throw error;
    }
  }

  /**
   * Check if user has sufficient credits
   * @param {string} userId - User UUID
   * @param {number} requiredCredits - Number of credits required
   * @returns {Promise<boolean>}
   */
  async hasCredits(userId, requiredCredits) {
    try {
      const result = await query(
        'SELECT credits_balance FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0].credits_balance >= requiredCredits;
    } catch (error) {
      console.error('Check credits error:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();
