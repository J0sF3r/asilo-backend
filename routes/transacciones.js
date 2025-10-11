// En: backend/routes/transacciones.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth } = require('../middleware/auth'); // Solo el admin puede gestionar finanzas

// @route   GET api/transacciones
// @desc    Obtener todas las transacciones (el libro contable)
router.get('/', adminAuth, async (req, res) => {
    try {
        const transacciones = await db.query(
            `SELECT t.*, d.nombre AS nombre_donante, f.nombre AS nombre_familiar
             FROM Transacciones t
             LEFT JOIN Donantes d ON t.id_donante = d.id_donante
             LEFT JOIN Familiar f ON t.id_familiar = f.id_familiar
             ORDER BY t.fecha DESC, t.id_transaccion DESC`
        );
        res.json(transacciones.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   POST api/transacciones
// @desc    Registrar un nuevo ingreso (donación, pago) o gasto
router.post('/', adminAuth, async (req, res) => {
    const { tipo, descripcion, monto, id_familiar, id_donante } = req.body;

    // Validación básica
    if (!tipo || !monto || !descripcion) {
        return res.status(400).json({ msg: 'Tipo, descripción and monto son requeridos.' });
    }

    try {
        const nuevaTransaccion = await db.query(
            `INSERT INTO Transacciones (fecha, tipo, descripcion, monto, id_familiar, id_donante)
             VALUES (CURRENT_DATE, $1, $2, $3, $4, $5) RETURNING *`,
            [tipo, descripcion, monto, id_familiar || null, id_donante || null]
        );
        res.status(201).json(nuevaTransaccion.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;