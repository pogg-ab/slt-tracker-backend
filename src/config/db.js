// This line loads the environment variables from the .env file
require('dotenv').config(); 

// We import the Pool class from the 'pg' library
const { Pool } = require('pg');

// We create a new Pool instance with our database connection details
// The process.env object contains all the variables from our .env file
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
});

// We export the pool object so we can use it in other files to query the database
module.exports = pool;