// src/routes/departmentRoutes.js (CORRECTED)

const express = require('express');
const router = express.Router();

// Make sure all four functions are imported
const { 
    createDepartment, 
    getAllDepartments,
    updateDepartment,
    deleteDepartment 
} = require('../controllers/departmentController');

const { protect, authorize } = require('../middleware/authMiddleware');

// This route handles GET all departments and POST a new one
router.route('/')
    .post(protect, authorize('MANAGE_DEPARTMENTS'), createDepartment)
    .get(protect, authorize('MANAGE_USERS', 'VIEW_COMPANY_OVERVIEW'), getAllDepartments);

// === THIS IS THE MISSING PART ===
// This route handles requests for a specific department by its ID
router.route('/:id')
    .put(protect, authorize('MANAGE_DEPARTMENTS'), updateDepartment)
    .delete(protect, authorize('MANAGE_DEPARTMENTS'), deleteDepartment);

module.exports = router;