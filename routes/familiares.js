// backend/routes/familiares.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth } = require('../middleware/auth');

// @route   POST api/familiares
// @desc    Registrar un nuevo familiar
// @access  Private (Admin)
router.post('/', adminAuth, async (req, res) => {
    const { nombre, parentesco, telefono, email } = req.body;
    try {
        const newFamiliar = await db.query(
            `INSERT INTO Familiar (nombre, parentesco, telefono, email) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [nombre, parentesco, telefono, email]
        );
        res.status(201).json(newFamiliar.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   GET api/familiares
// @desc    Obtener todos los familiares
// @access  Private (Admin)
router.get('/', adminAuth, async (req, res) => {
    try {
        const familiares = await db.query('SELECT * FROM Familiar ORDER BY nombre ASC');
        res.json(familiares.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

router.get('/disponibles/:id_paciente', adminAuth, async (req, res) => {
    try {
        const { id_paciente } = req.params;
        const disponibles = await db.query(
            `SELECT * FROM Familiar 
             WHERE id_familiar NOT IN 
             (SELECT id_familiar FROM Paciente_Familiar WHERE id_paciente = $1)`,
            [id_paciente]
        );
        res.json(disponibles.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

router.get('/', adminAuth, async (req, res) => {
    try {
        const medicos = await db.query("SELECT id_familiar, nombre FROM familiar ORDER BY nombre ASC");
        res.json(familiares.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;