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

// backend/db.js render
// backend/db.js
// backend/db.js
const { Pool } = require('pg');

// Solo carga dotenv si NO estamos en producción
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const connectionString = process.env.NODE_ENV === 'production'
    ? process.env.DATABASE_URL
    : `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;

// El objeto de configuración ahora es mucho más simple
const pool = new Pool({
    connectionString: connectionString,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};