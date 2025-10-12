// backend/routes/familiares.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, generalAuth } = require('../middleware/auth');

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

//obtener todos los familiares
router.get('/', adminAuth, async (req, res) => {
    try {
        // --- CAMBIO: Se añade "WHERE activo = TRUE"
        const familiares = await db.query('SELECT * FROM Familiar WHERE activo = TRUE ORDER BY nombre ASC');
        res.json(familiares.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   GET api/familiares/disponibles/:id_paciente
// @desc    Obtener familiares ACTIVOS que no están asignados a ESTE paciente
// --- ESTA ES LA RUTA QUE FALTABA ---
router.get('/disponibles/:id_paciente', adminAuth, async (req, res) => {
    try {
        const { id_paciente } = req.params;
        const disponibles = await db.query(
            `SELECT * FROM Familiar 
             WHERE activo = TRUE AND id_familiar NOT IN 
             (SELECT id_familiar FROM Paciente_Familiar WHERE id_paciente = $1)`,
            [id_paciente]
        );
        res.json(disponibles.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @desc    Obtener el estado de cuenta completo de un familiar (desde la tabla unificada)
router.get('/:id/estado-de-cuenta', adminAuth, async (req, res) => {
    const { id: id_familiar } = req.params;
    try {
        // --- ESTA ES LA NUEVA CONSULTA SIMPLIFICADA ---
        // Buscamos todos los movimientos asociados directamente a este familiar.
        const query = `
            SELECT 
                fecha,
                tipo,
                descripcion,
                monto
            FROM Movimiento_Financiero
            WHERE id_familiar = $1
            ORDER BY fecha DESC;
        `;

        const result = await db.query(query, [id_familiar]);
        const transacciones = result.rows;

        // Calculamos el balance final sumando todos los montos.
        // Los cargos son negativos y los pagos son positivos.
        const balance = transacciones.reduce((sum, t) => sum + parseFloat(t.monto), 0);

        res.json({
            balance: balance.toFixed(2),
            transacciones: transacciones
        });

    } catch (err) {
        console.error("Error al obtener el estado de cuenta:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});
//actualizar familiar
router.put('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const { nombre, parentesco, telefono, email } = req.body;
    try {
        const updatedFamiliar = await db.query(
            `UPDATE Familiar SET nombre = $1, parentesco = $2, telefono = $3, email = $4 
             WHERE id_familiar = $5 RETURNING *`,
            [nombre, parentesco, telefono, email, id]
        );
        if (updatedFamiliar.rowCount === 0) {
            return res.status(404).json({ msg: 'Familiar no encontrado' });
        }
        res.json(updatedFamiliar.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

//desactivar familiar
router.delete('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const deactivatedFamiliar = await db.query(
            `UPDATE Familiar SET activo = FALSE WHERE id_familiar = $1 RETURNING *`,
            [id]
        );
        if (deactivatedFamiliar.rowCount === 0) {
            return res.status(404).json({ msg: 'Familiar no encontrado' });
        }
        res.json({ msg: 'Familiar desactivado exitosamente' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

/*
router.get('/', adminAuth, async (req, res) => {
    try {
        const medicos = await db.query("SELECT id_familiar, nombre FROM familiar ORDER BY nombre ASC");
        res.json(familiares.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});
*/


module.exports = router;