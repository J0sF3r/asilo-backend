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
const { Pool } = require('pg');
require('dotenv').config();

// Render establece esta variable a 'production' automáticamente.
const isProduction = process.env.NODE_ENV === 'production';

// Usamos la DATABASE_URL de Render si estamos en producción, si no, usamos las variables locales.
const connectionString = isProduction 
    ? process.env.DATABASE_URL 
    : `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_DATABASE}`;

const pool = new Pool({
    connectionString: connectionString,
    // En producción (Render/Supabase), SSL es requerido.
    ssl: isProduction ? { rejectUnauthorized: false } : false,

        // nombre de dominio a una dirección IP de la familia IPv4.
    family: 4,
});

module.exports = {
    query: (text, params) => pool.query(text, params),
};