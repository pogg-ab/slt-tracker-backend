const express = require('express');
const path = require('path'); // Import the path module
const pool = require('./src/config/db');
const cors = require('cors');

// Import routes
const userRoutes = require('./src/routes/userRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const reportsRoutes = require('./src/routes/reportsRoutes');
const timesheetRoutes = require('./src/routes/timesheetRoutes');
const departmentRoutes = require('./src/routes/departmentRoutes');


const app = express();
const PORT = process.env.PORT || 3000; // Use Render's port, or 3000 for local dev

// --- Middlewares ---
app.use(cors()); 
app.use(express.json()); // To parse JSON bodies
app.use(express.urlencoded({ extended: false })); // To parse URL-encoded bodies

// Make the 'uploads' folder publicly accessible
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// --- API Routes ---
app.use('/api/users', userRoutes);
// In index.js
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

app.get('/', (req, res) => {
  res.send('Hello from SLT-Tracker Backend!');
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  checkDbConnection();
});