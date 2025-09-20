// backend/routes/enfermeros.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, generalAuth, solicitudesViewAuth } = require('../middleware/auth');

// @route   POST api/enfermeros
// @desc    Registrar un nuevo enfermero/a
router.post('/', adminAuth, async (req, res) => {
    const { nombre, telefono, email } = req.body;
    try {
        const newEnfermero = await db.query(
            `INSERT INTO Enfermero (nombre, telefono, email) 
             VALUES ($1, $2, $3) RETURNING *`,
            [nombre, telefono, email]
        );
        res.status(201).json(newEnfermero.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   GET api/enfermeros
// @desc    Obtener todos los enfermeros/as
router.get('/', solicitudesViewAuth, async (req, res) => {
    try {
        const enfermeros = await db.query('SELECT * FROM Enfermero ORDER BY nombre ASC');
        res.json(enfermeros.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

router.get('/', adminAuth, async (req, res) => {
    try {
        const medicos = await db.query("SELECT id_enfermero, nombre FROM enfermero ORDER BY nombre ASC");
    res.json(enfermeros.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;