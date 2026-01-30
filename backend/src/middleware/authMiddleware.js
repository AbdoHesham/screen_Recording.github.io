const authService = require('../auth/authService');

/**
 * Middleware to verify JWT token and attach user to request
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = await authService.verifyToken(token);

    // Attach user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    return res.status(403).json({
      error: error.message || 'Invalid or expired token'
    });
  }
}

/**
 * Middleware to check if user has required role
 * @param {string[]} allowedRoles - Array of allowed roles
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions. Required role: ' + allowedRoles.join(' or ')
      });
    }

    next();
  };
}

/**
 * Middleware to check if user has sufficient credits
 * @param {number} requiredCredits - Number of credits required
 */
function requireCredits(requiredCredits) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }

      const hasCredits = await authService.hasCredits(req.user.userId, requiredCredits);

      if (!hasCredits) {
        return res.status(402).json({
          error: 'Insufficient credits',
          required: requiredCredits
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        error: 'Error checking credits: ' + error.message
      });
    }
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  requireCredits
};
