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
    requestPasswordReset, 
    resetPassword         
} = require('../controllers/userController');

const { protect, authorize } = require('../middleware/authMiddleware');

// === NEW SECRET ADMIN SETUP ROUTE (FOR ONE-TIME USE) ===
// This route should be removed or heavily secured in production

router.get('/setup-the-admin-now', async (req, res) => {
    const adminEmail = 'admin@skylink.com';
    const adminPassword = 'adminpassword';

    try {
        console.log('Admin setup route hit. Checking for existing admin...');
        
        // Check if admin already exists
        const userExists = await pool.query('SELECT * FROM "Users" WHERE email = $1', [adminEmail]);
        if (userExists.rows.length > 0) {
            return res.status(200).send("Admin user already exists. No action taken.");
        }

        // If not, create the admin
        console.log('Admin does not exist. Creating now...');
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(adminPassword, salt);

        const adminResult = await pool.query(
            `INSERT INTO "Users" (name, email, password_hash, job_title) VALUES ('System Admin', $1, $2, 'Administrator') RETURNING user_id`,
            [adminEmail, password_hash]
        );
        const adminId = adminResult.rows[0].user_id;
        console.log(`Admin user created with ID: ${adminId}`);

        // Grant all permissions to the new admin
        await pool.query(
            `INSERT INTO "User_Permissions" (user_id, permission_id) SELECT $1, permission_id FROM "Permissions"`,
            [adminId]
        );
        console.log('All permissions granted to admin.');

        res.status(201).send(`SUCCESS: Admin user '${adminEmail}' was created with ID ${adminId} and assigned all permissions.`);

    } catch (error) {
        console.error('CRITICAL ERROR during admin setup:', error);
        res.status(500).send("A server error occurred during admin setup. Check the logs.");
    }
});
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