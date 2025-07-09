// src/routes/departmentRoutes.js

const express = require('express');
const router = express.Router();

// 1. Import the new controller function
const { 
    createDepartment, 
    getAllDepartments,
    getDepartmentUsersWithStats, // <-- New import
} = require('../controllers/departmentController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Route to get all departments OR create a new one
router.route('/')
    .get(protect, authorize('MANAGE_USERS', 'VIEW_COMPANY_OVERVIEW'), getAllDepartments) // Admins and CEO can see all depts
    .post(protect, authorize('MANAGE_DEPARTMENTS'), createDepartment);

// 2. Add the new route for the CEO to get users with stats for a specific department
router.get(
    '/:deptId/users', 
    protect, 
    authorize('VIEW_COMPANY_OVERVIEW'), 
    getDepartmentUsersWithStats
);

module.exports = router;