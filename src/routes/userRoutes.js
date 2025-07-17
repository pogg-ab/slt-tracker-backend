// src/routes/userRoutes.js

const express = require('express');
const router = express.Router();

// We need these two modules for our setup route
const bcrypt = require('bcrypt');
const pool = require('../config/db');

// Import all the controller functions we need for other routes
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
    requestPasswordReset, 
    resetPassword
} = require('../controllers/userController');

const { protect, authorize } = require('../middleware/authMiddleware');


// === NEW, SIMPLE, ONE-TIME ADMIN SETUP ROUTE ===
// Visit this URL once in your browser to create the first admin user.
// e.g., https://your-backend-url.onrender.com/api/users/setup-initial-admin
router.get('/setup-initial-admin', async (req, res) => {
    const adminEmail = 'admin@skylink.com';
    const adminPassword = 'adminpassword'; // Use a strong password in reality

    try {
        console.log('Admin setup route initiated...');
        
        const userExists = await pool.query('SELECT * FROM "Users" WHERE email = $1', [adminEmail]);
        if (userExists.rows.length > 0) {
            return res.status(200).send("Admin user already exists. Setup was not needed.");
        }

        console.log('Creating new admin user...');
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(adminPassword, salt);

        const adminResult = await pool.query(
            `INSERT INTO "Users" (name, email, password_hash, job_title) VALUES ('System Admin', $1, $2, 'Administrator') RETURNING user_id`,
            [adminEmail, password_hash]
        );
        const adminId = adminResult.rows[0].user_id;
        console.log(`Admin user created with ID: ${adminId}`);

        await pool.query(
            `INSERT INTO "User_Permissions" (user_id, permission_id) SELECT $1, permission_id FROM "Permissions"`,
            [adminId]
        );
        console.log('All permissions have been granted to the admin user.');

        res.status(201).send(`SUCCESS: Admin user '${adminEmail}' was created with ID ${adminId} and assigned all available permissions.`);

    } catch (error) {
        console.error('CRITICAL ERROR during admin setup:', error);
        res.status(500).send("A server error occurred during the admin setup process. Check the backend logs for details.");
    }
});


// === PUBLIC ROUTES ===
router.post('/login', loginUser);
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

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