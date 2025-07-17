const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./src/config/db');
const bcrypt = require('bcrypt'); // Required for the setup route

// --- INITIALIZE FIREBASE ADMIN SDK ---
try {
    require('./src/config/firebaseConfig');
} catch (e) {
    console.warn("Firebase Admin SDK not initialized. This is normal if the key file is missing.");
}

// --- IMPORT ALL ROUTE HANDLERS ---
const userRoutes = require('./src/routes/userRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const reportsRoutes = require('./src/routes/reportsRoutes');
const timesheetRoutes = require('./src/routes/timesheetRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');

// --- INITIALIZE EXPRESS APP ---
const app = express();
const PORT = process.env.PORT || 10000; // Use Render's default port

// --- MIDDLEWARES ---
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// === NEW, PUBLIC, ONE-TIME ADMIN SETUP ROUTE ===
// This route is defined before the main '/api' routes and is not protected.
// Visit this URL once in your browser to create the first admin user.
app.get('/setup-initial-admin', async (req, res) => {
    const adminEmail = 'admin@skylink.com';
    const adminPassword = 'adminpassword';

    try {
        const userExists = await pool.query('SELECT * FROM "Users" WHERE email = $1', [adminEmail]);
        if (userExists.rows.length > 0) {
            return res.status(200).send("Admin user already exists. Setup was not needed.");
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(adminPassword, salt);

        const adminResult = await pool.query(
            `INSERT INTO "Users" (name, email, password_hash, job_title) VALUES ('System Admin', $1, $2, 'Administrator') RETURNING user_id`,
            [adminEmail, password_hash]
        );
        const adminId = adminResult.rows[0].user_id;

        await pool.query(
            `INSERT INTO "User_Permissions" (user_id, permission_id) SELECT $1, permission_id FROM "Permissions"`,
            [adminId]
        );

        res.status(201).send(`SUCCESS: Admin user '${adminEmail}' was created with ID ${adminId} and assigned all permissions.`);
    } catch (error) {
        console.error('CRITICAL ERROR during admin setup:', error);
        res.status(500).send("A server error occurred during the admin setup process. Check the backend logs.");
    }
});


// --- MAIN API ROUTES ---
// All of these routes will be prefixed with /api
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/departments', departmentRoutes);


// --- SERVER HEALTH CHECK AND STARTUP ---
app.get('/', (req, res) => {
  res.status(200).send('SLT-Tracker Backend API is live!');
});

const startServer = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
    app.listen(PORT, () => {
      console.log(`🚀 Server is listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ FATAL: Database connection failed. Server will not start.', error);
    process.exit(1);
  }
};

startServer();