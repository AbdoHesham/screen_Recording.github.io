const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/featureAccessMiddleware');
const featuresService = require('../services/featuresService');

/**
 * GET /api/video-editor/access
 * Check if user has access to video editing feature
 * Returns feature info including usage and limits
 */
router.get('/access', authenticateToken, async (req, res) => {
  try {
    const accessInfo = await featuresService.hasFeatureAccess(
      req.user.userId,
      'video_editing'
    );

    if (!accessInfo.hasAccess) {
      return res.status(403).json({
        hasAccess: false,
        reason: accessInfo.reason,
        message: accessInfo.message
      });
    }

    res.json({
      hasAccess: true,
      feature: {
        id: accessInfo.featureId,
        name: accessInfo.featureName,
        limit: accessInfo.limit,
        usage: accessInfo.usage,
        remaining: accessInfo.remaining
      }
    });
  } catch (error) {
    console.error('Video editor access check error:', error);
    res.status(500).json({
      error: 'Failed to check video editor access'
    });
  }
});

/**
 * GET /api/video-editor/templates
 * Get available transitions and effects templates
 * Public endpoint - no auth required
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = {
      transitions: [
        {
          id: 'fade',
          name: 'Fade',
          description: 'Smooth cross-fade between clips',
          defaultDuration: 1.0,
          minDuration: 0.5,
          maxDuration: 3.0
        },
        {
          id: 'dissolve',
          name: 'Dissolve',
          description: 'Gradual dissolve transition',
          defaultDuration: 1.5,
          minDuration: 0.5,
          maxDuration: 3.0
        },
        {
          id: 'wipeleft',
          name: 'Wipe Left',
          description: 'Wipe from right to left',
          defaultDuration: 1.0,
          minDuration: 0.5,
          maxDuration: 2.0
        },
        {
          id: 'wiperight',
          name: 'Wipe Right',
          description: 'Wipe from left to right',
          defaultDuration: 1.0,
          minDuration: 0.5,
          maxDuration: 2.0
        },
        {
          id: 'slideup',
          name: 'Slide Up',
          description: 'Slide from bottom to top',
          defaultDuration: 1.0,
          minDuration: 0.5,
          maxDuration: 2.0
        },
        {
          id: 'slidedown',
          name: 'Slide Down',
          description: 'Slide from top to bottom',
          defaultDuration: 1.0,
          minDuration: 0.5,
          maxDuration: 2.0
        }
      ],
      effects: [
        {
          id: 'brightness',
          name: 'Brightness',
          description: 'Adjust brightness',
          type: 'slider',
          min: -1.0,
          max: 1.0,
          default: 0.0
        },
        {
          id: 'contrast',
          name: 'Contrast',
          description: 'Adjust contrast',
          type: 'slider',
          min: -1.0,
          max: 1.0,
          default: 0.0
        },
        {
          id: 'saturation',
          name: 'Saturation',
          description: 'Adjust color saturation',
          type: 'slider',
          min: 0.0,
          max: 2.0,
          default: 1.0
        },
        {
          id: 'blur',
          name: 'Blur',
          description: 'Apply blur effect',
          type: 'slider',
          min: 0,
          max: 20,
          default: 0
        },
        {
          id: 'grayscale',
          name: 'Grayscale',
          description: 'Convert to black and white',
          type: 'toggle',
          default: false
        },
        {
          id: 'sepia',
          name: 'Sepia',
          description: 'Apply sepia tone effect',
          type: 'toggle',
          default: false
        }
      ]
    };

    res.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({
      error: 'Failed to fetch templates'
    });
  }
});

module.exports = router;
