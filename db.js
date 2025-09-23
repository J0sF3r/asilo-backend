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
const { Pool } = require('pg');

// Solo carga dotenv si NO estamos en producción
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const isProduction = process.env.NODE_ENV === 'production';

// Objeto de configuración que cambiará según el entorno
const connectionConfig = isProduction
    ? { // Configuración para Render usando las variables separadas
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        port: process.env.DB_PORT,
        ssl: { rejectUnauthorized: false }
      }
    : { // Configuración para tu máquina Local
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        port: process.env.DB_PORT
      };

const pool = new Pool(connectionConfig);

module.exports = {
    query: (text, params) => pool.query(text, params),
};