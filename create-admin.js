// create-admin.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('./src/config/db'); // Correct path to your db config

const createAdmin = async () => {
    // --- CONFIGURATION ---
    const adminEmail = 'admin@skylink.com';
    const adminPassword = 'adminpassword'; // Use a strong password in a real project
    // --- END CONFIGURATION ---

    console.log('--- Starting Admin User Creation Script ---');
    
    const client = await pool.connect(); // Use a client for multiple queries

    try {
        // Check if admin already exists
        const existingAdmin = await client.query('SELECT * FROM Users WHERE email = $1', [adminEmail]);
        if (existingAdmin.rows.length > 0) {
            console.log(`Admin user with email '${adminEmail}' already exists. Script finished.`);
            return; // Exit if admin exists
        }

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(adminPassword, salt);

        // Insert the admin user with a 'job_title'
        const adminResult = await client.query(
            `INSERT INTO Users (name, email, password_hash, job_title) 
             VALUES ('System Admin', $1, $2, 'Administrator') RETURNING user_id`,
            [adminEmail, password_hash]
        );

        const adminId = adminResult.rows[0].user_id;
        console.log(`✅ Admin user created with ID: ${adminId}`);

        // Get all permission IDs from the Permissions table
        const permissionsResult = await client.query('SELECT permission_id FROM Permissions');
        const permissionIds = permissionsResult.rows.map(p => p.permission_id);

        if (permissionIds.length === 0) {
            console.error('❌ No permissions found in the Permissions table. Did you run init.sql?');
            return;
        }

        // Use a loop to assign all permissions to the admin user
        for (const permId of permissionIds) {
            await client.query(
                'INSERT INTO User_Permissions (user_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [adminId, permId]
            );
        }

        console.log(`✅ Assigned all ${permissionIds.length} permissions to the admin user.`);
        console.log('--- Admin User Creation Script Finished Successfully ---');

    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    } finally {
        await client.release(); // Release the client back to the pool
        await pool.end();     // Close all connections in the pool
        console.log('Database connection closed.');
    }
};

// Run the function
createAdmin();