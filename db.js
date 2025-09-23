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
// backend/db.js
// backend/db.js
const { Pool } = require('pg');

// Esta versión es la más simple. Confía 100% en la cadena
// de conexión que le proporcionará el entorno (Render o tu .env local).
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, 
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};