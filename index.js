const express = require('express');
const path = require('path');
const cors = require('cors'); // We will use this in its simplest form
const pool = require('./src/config/db');

// Import all your route files
const userRoutes = require('./src/routes/userRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const reportsRoutes = require('./src/routes/reportsRoutes');
const timesheetRoutes = require('./src/routes/timesheetRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');
const setupRoutes = require('./src/routes/setupRoutes'); // Keep this just in case

// Initialize Firebase (if you have this file)
// require('./src/config/firebaseConfig'); 

const app = express();

// --- THE SIMPLIFIED CORS FIX ---
// Let the .htaccess file handle the specific origin.
// Using app.use(cors()) here will handle the OPTIONS preflight request.
app.use(cors()); 
// --- END OF FIX ---


// --- Other Middlewares ---
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// --- API Routes ---
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/setup', setupRoutes);


// --- Server Setup ---
const checkDbConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
};

app.get('/', (req, res) => {
  res.send('SLT-Tracker Backend is running!');
});

checkDbConnection();

// app.listen() is not needed for cPanel's Node.js environment