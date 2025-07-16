const express = require('express');
const path = require('path');
const cors = require('cors');
const pool = require('./src/config/db');

// --- 1. INITIALIZE FIREBASE ADMIN SDK ---
// This line must run early, so the 'admin' object is available to other parts of the app.
try {
    require('./src/config/firebaseConfig');
} catch (e) {
    console.warn("Firebase Admin SDK not initialized. This is normal if the key file is missing. Push notifications will be disabled.");
}
// ------------------------------------

// Import routes
const userRoutes = require('./src/routes/userRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const reportsRoutes = require('./src/routes/reportsRoutes');
const timesheetRoutes = require('./src/routes/timesheetRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');


const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares ---
// Configure CORS for your live frontend URL
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Fallback to local Vite dev server
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: false })); // To parse URL-encoded bodies

// Make the 'uploads' folder publicly accessible
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// --- API Routes ---
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/departments', departmentRoutes); 


// --- Server Setup ---
const checkDbConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful!');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
};

// Simple root route to confirm the API is running
app.get('/', (req, res) => {
  res.send('SLT-Tracker Backend API is live!');
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  checkDbConnection();
});