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


const { Pool } = require('pg');
        
const pool = new Pool({
    // Siempre usará la variable de entorno que le corresponda.
    // En local, dotenv la cargará del archivo .env (desde index.js).
    // En Render, el servidor la inyectará.
    connectionString: process.env.DATABASE_URL,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};