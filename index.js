const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./src/config/db');

// --- INITIALIZE FIREBASE ADMIN SDK ---
try {
    // This will only work if the key file is present
    require('./src/config/firebaseConfig');
} catch (e) {
    console.warn("Firebase Admin SDK not initialized. This is expected if the key file is missing.");
}

// --- IMPORT ALL ROUTE HANDLERS ---
const userRoutes = require('./src/routes/userRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const reportsRoutes = require('./src/routes/reportsRoutes');
const timesheetRoutes = require('./src/routes/timesheetRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');

// --- INITIALIZE EXPRESS APP ---
const app = express();

// --- CONFIGURE PORT FOR RENDER ---
// Render provides the PORT as an environment variable. We should use it.
// 10000 is a common default for Render's web services.
const PORT = process.env.PORT || 10000;

// --- MIDDLEWARES ---

// 1. CORS Configuration (CRUCIAL FOR CONNECTING FRONTEND TO BACKEND)
const corsOptions = {
    // Read the allowed frontend URL from environment variables.
    // This allows you to have different URLs for development and production.
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', 
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// 2. Body Parsers
app.use(express.json()); // To parse incoming JSON bodies
app.use(express.urlencoded({ extended: false })); // To parse URL-encoded bodies

// 3. Static Folder for File Uploads
// This makes the 'uploads' folder publicly accessible to serve images/files.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// --- API ROUTES ---
// Mount the routers on their respective base paths.
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/departments', departmentRoutes); 


// --- SERVER HEALTH CHECK AND STARTUP ---

// A simple root route to easily check if the API is running.
app.get('/', (req, res) => {
  res.status(200).send('SLT-Tracker Backend API is live and running!');
});

const startServer = async () => {
  try {
    // Check database connection before starting the server
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!');

    app.listen(PORT, () => {
      console.log(`🚀 Server is listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ FATAL: Database connection failed. Server will not start.');
    console.error(error);
    process.exit(1); // Exit the process with a failure code
  }
};

startServer();