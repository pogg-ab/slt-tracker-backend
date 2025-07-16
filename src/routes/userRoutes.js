const express = require('express');
const router = express.Router();

// Import all necessary controller functions, including the new ones
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
    updateUser,
    deleteUser,
    getRelatedTasksForUser,
    setupInitialAdmin,
    requestPasswordReset, // <-- ADD THIS
    resetPassword         // <-- ADD THIS
} = require('../controllers/userController');

const { protect, authorize } = require('../middleware/authMiddleware');

// === NEW SECRET ADMIN SETUP ROUTE (FOR ONE-TIME USE) ===
// This route should be removed or heavily secured in production
router.get('/setup-admin', setupInitialAdmin);

// === PUBLIC ROUTES ===
router.post('/login', loginUser);
router.post('/request-password-reset', requestPasswordReset); // <-- NEW ROUTE
router.post('/reset-password', resetPassword);               // <-- NEW ROUTE

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
router.route('/:id')
    .get(protect, authorize('MANAGE_USERS'), getUserWithPermissions)
    .put(protect, authorize('MANAGE_USERS'), updateUser)
    .delete(protect, authorize('MANAGE_USERS'), deleteUser);

router.route('/:id/permissions')
    .get(protect, authorize('MANAGE_USERS'), getUserPermissions)
    .put(protect, authorize('MANAGE_USERS'), updateUserPermissions);

router.get('/:id/related-tasks', protect, authorize('VIEW_COMPANY_OVERVIEW'), getRelatedTasksForUser);

module.exports = router;