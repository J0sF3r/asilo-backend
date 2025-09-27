// backend/routes/medicos.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, solicitudesViewAuth, foundationAuth } = require('../middleware/auth');

// @route   POST api/medicos
// @desc    Registrar un nuevo médico
router.post('/', foundationAuth, async (req, res) => {
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

// @desc    Actualizar un médico
router.put('/:id', async (req, res) => {
    // Middleware de permisos se maneja dentro de la ruta
    const { id } = req.params;
    const { nombre, especialidad, email, telefono, tipo } = req.body;
    const userRole = req.user.nombre_rol; // Obtenido del token por un middleware 'auth' general

    try {
        // 1. Obtenemos el médico para saber su tipo actual
        const medicoResult = await db.query("SELECT tipo FROM medicos WHERE id_medico = $1", [id]);
        if (medicoResult.rows.length === 0) {
            return res.status(404).json({ msg: 'Médico no encontrado' });
        }
        const medicoTipo = medicoResult.rows[0].tipo;

        // 2. Lógica de Permisos
        if (medicoTipo === 'General' && userRole !== 'Administración') {
            return res.status(403).json({ msg: 'No autorizado para modificar a este médico' });
        }
        if (medicoTipo === 'Especialista' && userRole !== 'Fundación' && userRole !== 'Administración') {
            return res.status(403).json({ msg: 'No autorizado para modificar a este médico' });
        }

        // 3. Si pasa los permisos, actualizamos
        const updatedMedico = await db.query(
            `UPDATE medicos SET nombre = $1, especialidad = $2, email = $3, telefono = $4, tipo = $5
             WHERE id_medico = $6 RETURNING *`,
            [nombre, especialidad, email, telefono, tipo, id]
        );

        res.json(updatedMedico.rows[0]);

    } catch (err) {
        console.error("Error al actualizar médico:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   DELETE /api/medicos/:id
// @desc    Eliminar (desactivar) un médico
router.delete('/:id', async (req, res) => {
    // La lógica de permisos es idéntica a la de actualizar
    const { id } = req.params;
    const userRole = req.user.nombre_rol;

    try {
        const medicoResult = await db.query("SELECT tipo FROM medicos WHERE id_medico = $1", [id]);
        if (medicoResult.rows.length === 0) {
            return res.status(404).json({ msg: 'Médico no encontrado' });
        }
        const medicoTipo = medicoResult.rows[0].tipo;

        if (medicoTipo === 'General' && userRole !== 'Administración') {
            return res.status(403).json({ msg: 'No autorizado para eliminar a este médico' });
        }
        if (medicoTipo === 'Especialista' && userRole !== 'Fundación' && userRole !== 'Administración') {
            return res.status(403).json({ msg: 'No autorizado para eliminar a este médico' });
        }

        // En lugar de un DELETE, podrías tener una columna 'estado' y cambiarla a 'inactivo'
        await db.query("DELETE FROM medicos WHERE id_medico = $1", [id]);
        res.json({ msg: 'Médico eliminado' });
        
    } catch (err) {
        console.error("Error al eliminar médico:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;