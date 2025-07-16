// src/config/db.js  (FINAL CORRECTED VERSION)

require('dotenv').config(); 
const { Pool } = require('pg');

// This configuration object reads the individual variables from your .env file
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
  // In production on Render, SSL is required.
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create a new Pool instance with our database connection details
const pool = new Pool(dbConfig);

// Export the pool object so we can use it in other files
module.exports = pool;