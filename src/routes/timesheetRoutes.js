const express = require('express');
const router = express.Router();
const { getPendingEntries, reviewTimeEntry } = require('../controllers/timesheetController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes in this file require the 'APPROVE_TIME' permission.
// We can apply the middleware to all routes in this file at once.
router.use(protect, authorize('APPROVE_TIME'));

// GET /api/timesheets/pending
router.get('/pending', getPendingEntries);

// PUT /api/timesheets/entry/:entryId
router.put('/entry/:entryId', reviewTimeEntry);

module.exports = router;