const express = require('express');
const router = express.Router();

// Import all necessary report controller functions
const {
    getIndividualPerformance, 
    getDepartmentWorkload, 
    getIndividualTimesheet,
    getDepartmentTimeAllocation, 
    getCompanyOverview, 
    getDepartmentKPIs,
} = require('../controllers/reportsController');

const { protect, authorize } = require('../middleware/authMiddleware');

// === PERMISSION-BASED REPORT ROUTES ===

// Owner-level report
router.get('/company-overview', protect, authorize('VIEW_COMPANY_OVERVIEW'), getCompanyOverview);

// Manager/Analyst-level reports
router.get('/department-time/:deptId', protect, authorize('VIEW_REPORTS'), getDepartmentTimeAllocation);
router.get('/department-kpi/:deptId', protect, authorize('VIEW_REPORTS'), getDepartmentKPIs);
router.get('/department/:deptId', protect, authorize('VIEW_REPORTS'), getDepartmentWorkload);
router.get('/individual/:userId', protect, authorize('VIEW_REPORTS'), getIndividualPerformance);

// Any authenticated user should be able to view their own timesheet
router.get('/timesheet/:userId', protect, getIndividualTimesheet);


module.exports = router;