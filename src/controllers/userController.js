const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// --- USER MANAGEMENT (ADMIN) ---

const registerUser = async (req, res) => {
    const { name, email, password, job_title, department_id, fcm_token } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const userExists = await client.query('SELECT * FROM Users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ message: 'User with this email already exists.' });
        }
        
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        
        const newUserResult = await client.query(
            'INSERT INTO Users (name, email, password_hash, job_title, department_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, email, password_hash, job_title || null, department_id || null]
        );

        const newUser = newUserResult.rows[0];

        if (fcm_token) {
            const deviceQuery = `
                INSERT INTO Devices (user_id, fcm_token) 
                VALUES ($1, $2) 
                ON CONFLICT (fcm_token) DO NOTHING;
            `;
            await client.query(deviceQuery, [newUser.user_id, fcm_token]);
            console.log(`DEV-MODE: Automatically registered device for new user ${newUser.user_id}`);
        }
        
        await client.query('COMMIT');

        const userResponse = {
            user_id: newUser.user_id,
            name: newUser.name,
            email: newUser.email,
            job_title: newUser.job_title
        };

        res.status(201).json(userResponse);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error during user registration:', error);
        res.status(500).json({ message: 'Server error' });
    } finally {
        client.release();
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
const setupInitialAdmin = async (req, res) => {
    const SECRET_KEY = "super-secret-key-to-create-admin-123";
    if (req.query.secret !== SECRET_KEY) {
        return res.status(403).send("Forbidden: Invalid secret key.");
    }

    const adminEmail = 'admin@skylink.com';
    const adminPassword = 'adminpassword';

    try {
        const existingAdmin = await pool.query('SELECT * FROM Users WHERE email = $1', [adminEmail]);
        if (existingAdmin.rows.length > 0) {
            return res.send(`Admin user with email '${adminEmail}' already exists.`);
        }
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(adminPassword, salt);
        const adminResult = await pool.query(
            `INSERT INTO Users (name, email, password_hash, job_title) VALUES ('System Admin', $1, $2, 'Administrator') RETURNING user_id`,
            [adminEmail, password_hash]
        );
        const adminId = adminResult.rows[0].user_id;
        const permissionsResult = await pool.query('SELECT permission_id FROM Permissions');
        const permissionIds = permissionsResult.rows.map(p => p.permission_id);
        for (const permId of permissionIds) {
            await pool.query(
                'INSERT INTO User_Permissions (user_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [adminId, permId]
            );
        }
        res.send(`SUCCESS: Admin user created with ID ${adminId} and assigned all ${permissionIds.length} permissions.`);
    } catch (error) {
        console.error('Error during admin setup:', error);
        res.status(500).send("Server error during admin setup.");
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
    setupInitialAdmin
};