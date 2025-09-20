// backend/routes/medicos.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, solicitudesViewAuth } = require('../middleware/auth');

// @route   POST api/medicos
// @desc    Registrar un nuevo médico
router.post('/', adminAuth, async (req, res) => {
    // Recibimos el nuevo campo 'tipo'
    const { nombre, tipo, especialidad, email, telefono } = req.body;
    try {
        const newMedico = await db.query(
            // Lo insertamos en la base de datos
            `INSERT INTO Medico (nombre, tipo, especialidad, email, telefono) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [nombre, tipo, especialidad, email, telefono]
        );
        res.status(201).json(newMedico.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// rutas Get para obtener médicos
//   GET api/medicos
//   Obtener todos los médicos
router.get('/', solicitudesViewAuth, async (req, res) => {
    try {
        const medicos = await db.query('SELECT * FROM Medico ORDER BY nombre ASC');
        res.json(medicos.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});
//solo medicos generales
router.get('/generales', adminAuth, async (req, res) => {
    try {
        const medicosGenerales = await db.query(
            "SELECT * FROM Medico WHERE tipo = 'General' ORDER BY nombre ASC"
        );
        res.json(medicosGenerales.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});
//solo medicos especialistas
router.get('/especialistas', adminAuth, async (req, res) => {
    try {
        const especialistas = await db.query(
            "SELECT * FROM Medico WHERE tipo = 'Especialista' ORDER BY nombre ASC"
        );
        res.json(especialistas.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// Obtener médicos para asignar en usuarios
router.get('/', adminAuth, async (req, res) => {
    try {
        const medicos = await db.query("SELECT id_medico, nombre, tipo FROM medicos ORDER BY nombre ASC");
        res.json(medicos.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});
module.exports = router;