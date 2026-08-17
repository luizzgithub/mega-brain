const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { generateDailyBriefing } = require('../agent');

/**
 * GET /api/briefing
 * Returns the daily briefing for the authenticated user.
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const briefing = await generateDailyBriefing(userId);
    res.json({ success: true, data: briefing });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
