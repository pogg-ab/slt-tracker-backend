// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();

// Import all necessary controller functions
const { 
    registerUser, 
    loginUser, 
    getAllUsers,
    getUserPermissions, 
    updateUserPermissions,
    updateUserProfile, 
    changePassword, 
    getDepartmentUsers,
    registerDevice,
    getMyProfile,
    getUserWithPermissions,
    getAllPermissions,
    updateUser, // <-- New import
    deleteUser,
    getRelatedTasksForUser  // <-- New import
} = require('../controllers/userController');

const { protect, authorize } = require('../middleware/authMiddleware');

// === PUBLIC ROUTE ===
router.post('/login', loginUser);

// === ADMIN-ONLY ROUTES ===
router.get('/', protect, authorize('MANAGE_USERS'), getAllUsers);
router.post('/register', protect, authorize('MANAGE_USERS'), registerUser);
router.get('/permissions-list', protect, authorize('MANAGE_USERS'), getAllPermissions);

// === GENERAL PROTECTED ROUTES ===
router.get('/department', protect, authorize('VIEW_ALL_USERS_FOR_ASSIGNMENT'), getDepartmentUsers);
router.post('/register-device', protect, registerDevice);
router.put('/change-password', protect, changePassword);

router.route('/profile')
    .get(protect, getMyProfile)
    .put(protect, updateUserProfile);

// === DYNAMIC ROUTES FOR A SPECIFIC USER ID (MUST come last) ===

// This block now correctly handles GET, PUT, and DELETE for /api/users/:id
router.route('/:id')
    .get(protect, authorize('MANAGE_USERS'), getUserWithPermissions)
    .put(protect, authorize('MANAGE_USERS'), updateUser)   // Handles editing a user
    .delete(protect, authorize('MANAGE_USERS'), deleteUser); // Handles deleting a user

// This block handles the permissions for a specific user
router.route('/:id/permissions')
    .get(protect, authorize('MANAGE_USERS'), getUserPermissions)
    .put(protect, authorize('MANAGE_USERS'), updateUserPermissions);

router.get('/:id/related-tasks', protect, authorize('VIEW_COMPANY_OVERVIEW'), getRelatedTasksForUser);

module.exports = router;