// backend/routes/roles.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth } = require('../middleware/auth');

router.get('/', adminAuth, async (req, res) => {
    try {
        const roles = await db.query('SELECT * FROM Rol ORDER BY id_rol ASC');
        res.json(roles.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;