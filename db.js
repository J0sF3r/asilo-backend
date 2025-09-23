// backend/db.js local
/*const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};*/

  
const pool = new Pool({
    connectionString: connectionString,
    ssl: process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } // Para Supabase
        : false
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};