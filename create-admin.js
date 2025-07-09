const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./src/config/db');

// Import all your route files
const userRoutes = require('./src/routes/userRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const reportsRoutes = require('./src/routes/reportsRoutes');
const timesheetRoutes = require('./src/routes/timesheetRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');

const app = express();

// --- THE NEW, MORE POWERFUL CORS FIX ---

// 1. Manually handle the OPTIONS preflight request for all routes
app.options('*', cors()); // This enables pre-flight requests across the board

// 2. Use a more open CORS policy for debugging
// The '*' allows requests from ANY origin. We do this to see if the server
// is blocking a specific origin or ALL cross-origin requests.
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// --- END OF FIX ---

// Other Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.g
app.use('/api/reports', reportsRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/departments', departmentRoutes);

// Root route for checking server status
app.get('/', (req, res) => {
  res.send('SLT-Tracker Backend is running!');
});

// Database connection check
const checkDbConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
};
checkDbConnection();

// Note: We don't need app.listen() for cPanel deployment