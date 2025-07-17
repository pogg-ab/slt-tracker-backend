const pool = require('../config/db');
const { sendEmail } = require('../config/emailConfig');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// --- USER MANAGEMENT (ADMIN) ---


// src/controllers/userController.js

const registerUser = async (req, res) => {
    const { name, email, job_title, department_id } = req.body;
    if (!name || !email) { 
        return res.status(400).json({ message: 'Name and email are required.' }); 
    }

    try {
        const userExists = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) { 
            return res.status(409).json({ message: 'User with this email already exists.' }); 
        }
        
        // 1. Generate a random, temporary password
        const temporaryPassword = Math.random().toString(36).slice(-8);
        console.log(`Generated temporary password for ${email}: ${temporaryPassword}`);

        // 2. Hash the temporary password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(temporaryPassword, salt);
        
        // 3. Insert the new user into the database
        const newUserResult = await pool.query(
            'INSERT INTO Users (name, email, password_hash, job_title, department_id) VALUES ($1, $2, $3, $4, $5) RETURNING user_id, name, email, job_title',
            [name, email, password_hash, job_title || null, department_id || null]
        );
        const newUser = newUserResult.rows[0];

        // 4. Send the welcome email with the temporary password
        const emailSubject = 'Welcome to SLT-Tracker!';
        
        // Use the environment variable for the URL, with a fallback for local testing
        const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173'; // Vite's default port is 5173

        const emailHtml = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Welcome to SLT-Tracker, ${name}!</h2>
                <p>An account has been created for you on the Sky Link Technologies internal tracker.</p>
                <p>Please use the following credentials to log in for the first time:</p>
                <ul style="list-style-type: none; padding: 0;">
                    <li style="margin-bottom: 10px;"><strong>Email:</strong> ${email}</li>
                    <li style="margin-bottom: 10px;"><strong>Temporary Password:</strong> <strong style="font-size: 1.2em;">${temporaryPassword}</strong></li>
                </ul>
                <p>For your security, you will be required to change this password immediately after logging in.</p>
                <a href="${loginUrl}" style="display: inline-block; background-color: #0D8BFF; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login Now</a>
                <p style="font-size: 0.9em; color: #888;">If you were not expecting this email, you can safely ignore it.</p>
            </div>
        `;

        await sendEmail({
            to: email,
            subject: emailSubject,
            html: emailHtml,
            text: `Welcome to SLT-Tracker! Your login email is ${email} and your one-time temporary password is ${temporaryPassword}. Please log in at ${loginUrl} to change it.`
        });

        res.status(201).json(newUser);

    } catch (error) {
        console.error('Error during user registration:', error);
        res.status(500).json({ message: 'Server error during user registration.' });
    }
};

const getAllUsers = async (req, res) => {
    try {
        const users = await pool.query('SELECT user_id, name, email, job_title, department_id FROM Users ORDER BY name');
        res.json(users.rows);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const getUserPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `SELECT p.permission_id FROM Permissions p JOIN User_Permissions up ON p.permission_id = up.permission_id WHERE up.user_id = $1`;
        const result = await pool.query(query, [id]);
        res.json(result.rows.map(p => p.permission_id));
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

const updateUserPermissions = async (req, res) => {
    const { id } = req.params;
    const { permissionIds } = req.body;
    if (!Array.isArray(permissionIds)) { return res.status(400).json({ message: 'permissionIds must be an array.' });}
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM User_Permissions WHERE user_id = $1', [id]);
        if (permissionIds.length > 0) {
            const values = permissionIds.map((_, index) => `($1, $${index + 2})`).join(',');
            const query = `INSERT INTO User_Permissions (user_id, permission_id) VALUES ${values}`;
            await client.query(query, [id, ...permissionIds]);
        }
        await client.query('COMMIT');
        res.json({ message: 'Permissions updated successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Server error while updating permissions' });
    } finally {
        client.release();
    }
};


// --- AUTHENTICATION & PROFILE ---

// THIS IS THE CORRECTED AND COMPLETE FUNCTION
const loginUser = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) { return res.status(400).json({ message: 'Please provide both email and password.' });}
    try {
        const userResult = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) { return res.status(401).json({ message: 'Invalid credentials.' }); }
        
        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) { return res.status(401).json({ message: 'Invalid credentials.' });}
        
        // Fetch user's permissions
        const permissionsResult = await pool.query('SELECT p.name FROM Permissions p JOIN User_Permissions up ON up.permission_id = p.permission_id WHERE up.user_id = $1', [user.user_id]);
        const permissions = permissionsResult.rows.map(row => row.name);

        // Create the payload with all necessary information
        const payload = { 
            user_id: user.user_id, // CRITICAL: This is needed by the 'protect' middleware
            name: user.name, 
            job_title: user.job_title,
            department_id: user.department_id,
            permissions: permissions // This is needed by the 'authorize' middleware
        };
        
        // Sign the token
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
        
        // Send the token back to the client
        res.json({ message: 'Login successful!', token: token });
    } catch (error) {
        console.error('Error during user login:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getUserWithPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const [userResult, permsResult] = await Promise.all([
            pool.query('SELECT user_id, name, email, job_title, department_id FROM Users WHERE user_id = $1', [id]),
            pool.query('SELECT name FROM Permissions p JOIN User_Permissions up ON p.permission_id = up.permission_id WHERE up.user_id = $1', [id])
        ]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const user = userResult.rows[0];
        user.permissions = permsResult.rows.map(p => p.name);
        res.json(user);
    } catch (error) {
        console.error('Error fetching user with permissions:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const getMyProfile = async (req, res) => {
    // The 'protect' middleware already found the user and attached it to req.user
    // We just need to send it back.
    res.json(req.user);
};

const updateUserProfile = async (req, res) => {
    const { user_id } = req.user;
    const { name, email } = req.body;
    try {
        if (email) {
            const existingUser = await pool.query('SELECT user_id FROM Users WHERE email = $1 AND user_id != $2', [email, user_id]);
            if (existingUser.rows.length > 0) { return res.status(409).json({ message: 'Email already in use.' });}
        }
        const currentUser = await pool.query('SELECT name, email FROM Users WHERE user_id = $1', [user_id]);
        const newName = name || currentUser.rows[0].name;
        const newEmail = email || currentUser.rows[0].email;
        const updatedUser = await pool.query(
            'UPDATE Users SET name = $1, email = $2 WHERE user_id = $3 RETURNING user_id, name, email, job_title',
            [newName, newEmail, user_id]
        );
        res.json(updatedUser.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

const changePassword = async (req, res) => {
    const { user_id } = req.user;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) { return res.status(400).json({ message: 'Old and new passwords are required.' });}
    try {
        const userResult = await pool.query('SELECT password_hash FROM Users WHERE user_id = $1', [user_id]);
        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) { return res.status(401).json({ message: 'Incorrect old password.' });}
        const salt = await bcrypt.genSalt(10);
        const new_password_hash = await bcrypt.hash(newPassword, salt);
        await pool.query('UPDATE Users SET password_hash = $1 WHERE user_id = $2', [new_password_hash, user_id]);
        res.json({ message: 'Password changed successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// --- OTHER FUNCTIONS ---

const getDepartmentUsers = async (req, res) => {
    try {
        const users = await pool.query(
            'SELECT user_id, name, job_title FROM Users ORDER BY name'
        );
        res.json(users.rows);
    } catch (error) {
        console.error('Error fetching users for assignment:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const registerDevice = async (req, res) => {
    const { fcm_token } = req.body;
    const { user_id } = req.user;
    if (!fcm_token) { return res.status(400).json({ message: 'Device token is required.' });}
    try {
        const query = `INSERT INTO Devices (user_id, fcm_token) VALUES ($1, $2) ON CONFLICT (fcm_token) DO NOTHING;`;
        await pool.query(query, [user_id, fcm_token]);
        res.status(200).json({ message: 'Device registered successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error.' });
    }
};

const getAllPermissions = async (req, res) => {
    try {
        const permissions = await pool.query('SELECT * FROM Permissions ORDER BY description');
        res.json(permissions.rows);
    } catch (error) {
        console.error('Error fetching all permissions:', error);
        res.status(500).json({ message: "Server error" });
    }
};

const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, job_title, department_id } = req.body;

    try {
        const fields = [];
        const values = [];
        let query = 'UPDATE Users SET ';

        if (name) { values.push(name); fields.push(`name = $${values.length}`); }
        if (job_title) { values.push(job_title); fields.push(`job_title = $${values.length}`); }
        if (department_id) { values.push(department_id); fields.push(`department_id = $${values.length}`); }

        if (fields.length === 0) {
            return res.status(400).json({ message: 'No fields to update provided.' });
        }
        
        query += fields.join(', ');
        values.push(id);
        query += ` WHERE user_id = $${values.length} RETURNING user_id, name, email, job_title, department_id`;
        
        const updatedUser = await pool.query(query, values);

        if (updatedUser.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.json(updatedUser.rows[0]);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Server error while updating user.' });
    }
};

const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const deleteResult = await pool.query('DELETE FROM Users WHERE user_id = $1', [id]);

        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        res.json({ message: 'User deleted successfully.' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Server error while deleting user.' });
    }
};

const getRelatedTasksForUser = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                t.*,
                assigner.name as assigner_name,
                assignee.name as assignee_name
            FROM Tasks t
            LEFT JOIN Users assigner ON t.assigner_id = assigner.user_id
            LEFT JOIN Users assignee ON t.assignee_id = assignee.user_id
            WHERE t.assignee_id = $1 OR t.assigner_id = $1
            ORDER BY t.created_at DESC;
        `;
        const tasks = await pool.query(query, [id]);
        res.json(tasks.rows);
    } catch (error) {
        console.error('Error fetching related tasks:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- THIS IS THE TEMPORARY SECRET FUNCTION TO CREATE THE ADMIN ---
// --- THIS IS THE NEW "NUKE AND RECREATE" VERSION ---
const setupInitialAdmin = async (req, res) => {
    const SECRET_KEY = "super-secret-key-to-create-admin-123";
    if (req.query.secret !== SECRET_KEY) {
        return res.status(403).send("Forbidden: Invalid secret key.");
    }

    const adminEmail = 'admin@skylink.com';
    const adminPassword = 'adminpassword';

    try {
        // STEP 1: Force-delete the old admin user, if they exist.
        await pool.query('DELETE FROM Users WHERE email = $1', [adminEmail]);
        console.log(`Attempted to delete existing user '${adminEmail}'.`);

        // STEP 2: Create a fresh user with a new, correct hash.
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(adminPassword, salt);

        const adminResult = await pool.query(
            `INSERT INTO Users (name, email, password_hash, job_title) VALUES ('System Admin', $1, $2, 'Administrator') RETURNING user_id`,
            [adminEmail, password_hash]
        );
        const adminId = adminResult.rows[0].user_id;

        // STEP 3: Assign all permissions.
        const permissionsResult = await pool.query('SELECT permission_id FROM Permissions');
        const permissionIds = permissionsResult.rows.map(p => p.permission_id);

        for (const permId of permissionIds) {
            await pool.query(
                'INSERT INTO User_Permissions (user_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [adminId, permId]
            );
        }

        res.send(`SUCCESS: Admin user was force-recreated with ID ${adminId} and assigned all ${permissionIds.length} permissions.`);

    } catch (error) {
        console.error('Error during admin setup:', error);
        res.status(500).send("Server error during admin setup.");
    }
};

const requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    if (!email) { return res.status(400).json({ message: 'Email address is required.' }); }

    try {
        const userResult = await pool.query('SELECT * FROM Users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            // IMPORTANT: For security, we don't reveal if the user exists or not.
            // We send a success message either way.
            return res.json({ message: 'If a user with that email exists, a password reset link has been sent.' });
        }
        const user = userResult.rows[0];

        // 1. Generate a secure, random token
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // 2. Hash the token before saving it to the database for security
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // 3. Set an expiration time (e.g., 10 minutes from now)
        const resetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // 4. Save the hashed token and expiration date to the user's record
        await pool.query(
            'UPDATE Users SET password_reset_token = $1, password_reset_expires = $2 WHERE user_id = $3',
            [hashedToken, resetExpires, user.user_id]
        );

        // 5. Create the reset URL with the *un-hashed* token
        const loginUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${loginUrl}/reset-password/${resetToken}`;

        // 6. Send the email
        const emailSubject = 'SLT-Tracker Password Reset Request';
        const emailHtml = `
            <p>You requested a password reset for your SLT-Tracker account.</p>
            <p>Please click the following link to set a new password. This link will expire in 10 minutes:</p>
            <a href="${resetUrl}">Reset Your Password</a>
        `;
        await sendEmail({ to: user.email, subject: emailSubject, html: emailHtml });
        
        res.json({ message: 'If a user with that email exists, a password reset link has been sent.' });

    } catch (error) {
        console.error('Error in password reset request:', error);
        // Send a generic success message even on error to prevent user enumeration
        res.json({ message: 'If a user with that email exists, a password reset link has been sent.' });
    }
};

// Add this function to src/controllers/userController.js

const resetPassword = async (req, res) => {
    // 1. Get the un-hashed token from the request body
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ message: 'Token and new password are required.' });
    }

    try {
        // 2. Hash the token from the request so we can find it in the database
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // 3. Find the user by the hashed token AND check if the token has not expired
        const userResult = await pool.query(
            'SELECT * FROM Users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
            [hashedToken]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }
        const user = userResult.rows[0];

        // 4. Hash the new password
        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(password, salt);

        // 5. Update the user's password and clear the reset token fields
        await pool.query(
            'UPDATE Users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL WHERE user_id = $2',
            [newPasswordHash, user.user_id]
        );

        res.json({ message: 'Password has been reset successfully. You can now log in.' });

    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ message: 'Server error while resetting password.' });
    }
};

// --- EXPORTS ---
module.exports = {
    registerUser,
    loginUser,
    getAllUsers,
    getUserPermissions,
    updateUserPermissions,
    updateUserProfile,
    changePassword,
    getDepartmentUsers,
    registerDevice,
    getUserWithPermissions,
    getMyProfile,
    getAllPermissions,
    updateUser,
    deleteUser,
    getRelatedTasksForUser,
    setupInitialAdmin,
    requestPasswordReset, 
    resetPassword         
};