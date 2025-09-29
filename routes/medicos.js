const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, solicitudesViewAuth, foundationAuth } = require('../middleware/auth');

// @route   POST api/medicos
// @desc    Registrar un nuevo médico
router.post('/', foundationAuth, async (req, res) => {
    const { nombre, tipo, especialidad, email, telefono, costo_consulta } = req.body;
    try {
        const newMedico = await db.query(
            `INSERT INTO Medico (nombre, tipo, especialidad, email, telefono, costo_consulta, activo) 
             VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING *`,
            [nombre, tipo, especialidad, email, telefono, costo_consulta || 0]
        );
        res.status(201).json(newMedico.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   GET api/medicos
// @desc    Obtener todos los médicos ACTIVOS
router.get('/', solicitudesViewAuth, async (req, res) => {
    try {
        const medicos = await db.query("SELECT * FROM Medico WHERE activo = TRUE ORDER BY nombre ASC");
        res.json(medicos.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   GET api/medicos/generales
// @desc    Obtener todos los médicos generales ACTIVOS
router.get('/generales', adminAuth, async (req, res) => {
    try {
        const medicosGenerales = await db.query(
            "SELECT * FROM Medico WHERE tipo = 'General' AND activo = TRUE ORDER BY nombre ASC"
        );
        res.json(medicosGenerales.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   GET api/medicos/especialistas
// @desc    Obtener todos los médicos especialistas ACTIVOS
router.get('/especialistas', adminAuth, async (req, res) => {
    try {
        const especialistas = await db.query(
            "SELECT * FROM Medico WHERE tipo = 'Especialista' AND activo = TRUE ORDER BY nombre ASC"
        );
        res.json(especialistas.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});


// @route   PUT /api/medicos/:id
// @desc    Actualizar un médico
router.put('/:id', adminAuth, async (req, res) => { // Simplificado a solo adminAuth, puedes ajustarlo
    const { id } = req.params;
    const { nombre, especialidad, email, telefono, tipo, costo_consulta } = req.body;
    try {
        const updatedMedico = await db.query(
            `UPDATE Medico SET nombre = $1, especialidad = $2, email = $3, telefono = $4, tipo = $5, costo_consulta = $6
             WHERE id_medico = $7 RETURNING *`,
            [nombre, especialidad, email, telefono, tipo, costo_consulta || 0, id]
        );
        if (updatedMedico.rowCount === 0) {
            return res.status(404).json({ msg: 'Médico no encontrado' });
        }
        res.json(updatedMedico.rows[0]);
    } catch (err) {
        console.error("Error al actualizar médico:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @desc    Obtener los datos de un médico específico
// --- NUEVA RUTA ---
router.get('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const medico = await db.query(
            "SELECT * FROM Medico WHERE id_medico = $1 AND activo = TRUE",
            [id]
        );

        if (medico.rows.length === 0) {
            return res.status(404).json({ msg: 'Médico no encontrado o inactivo' });
        }
        
        res.json(medico.rows[0]);
    } catch (err) {
        console.error("Error al obtener datos del médico:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   DELETE /api/medicos/:id
// @desc    Desactivar un médico (Borrado Lógico)
router.delete('/:id', adminAuth, async (req, res) => { // Simplificado a solo adminAuth
    const { id } = req.params;
    try {
        const deactivatedMedico = await db.query(
            `UPDATE Medico SET activo = FALSE WHERE id_medico = $1 RETURNING *`,
            [id]
        );
        if (deactivatedMedico.rowCount === 0) {
            return res.status(404).json({ msg: 'Médico no encontrado' });
        }
        res.json({ msg: 'Médico desactivado exitosamente' });
    } catch (err) {
        console.error("Error al eliminar médico:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;