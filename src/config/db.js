const { Pool } = require('pg');

// Load .env variables only in a non-production environment (your local machine)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// Render provides a single DATABASE_URL environment variable.
// We will use this in production. For local development, you can still use
// your .env file, but it must contain a DATABASE_URL variable.
// Example for your local .env:
// DATABASE_URL=postgres://slt_admin:mysecretpassword@localhost:5432/slt_tracker

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set in environment variables.');
}

const pool = new Pool({
  connectionString: connectionString,
  // In production on Render, SSL is required.
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = pool;