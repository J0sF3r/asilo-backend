const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth } = require('../middleware/auth');

// @route   GET api/transacciones
// @desc    Obtener el libro contable unificado
router.get('/', adminAuth, async (req, res) => {
    try {
        // Consulta simplificada que lee directamente de la tabla unificada
        const query = `
            SELECT 
                mf.id_movimiento,
                mf.fecha,
                mf.tipo,
                mf.descripcion,
                mf.monto,
                f.nombre AS nombre_familiar,
                d.nombre AS nombre_donante
            FROM Movimiento_Financiero mf
            LEFT JOIN Familiar f ON mf.id_familiar = f.id_familiar
            LEFT JOIN Donantes d ON mf.id_donante = d.id_donante
            ORDER BY mf.fecha DESC, mf.id_movimiento DESC;
        `;
        const transacciones = await db.query(query);
        res.json(transacciones.rows);
    } catch (err) {
        console.error("Error al obtener transacciones:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   POST api/transacciones
// @desc    Registrar cualquier movimiento manual (ingreso, gasto, pago de familiar)
router.post('/', adminAuth, async (req, res) => {
    const { tipo, descripcion, monto, id_familiar, id_donante } = req.body;

    if (!tipo || !monto || !descripcion) {
        return res.status(400).json({ msg: 'Tipo, descripción y monto son requeridos.' });
    }

    try {
        // Los gastos siempre se guardan como negativos, el resto como positivos
        const montoFinal = tipo.toLowerCase().includes('gasto') ? -Math.abs(monto) : Math.abs(monto);
        
        // La consulta ahora es más simple
        const nuevaTransaccion = await db.query(
            `INSERT INTO Movimiento_Financiero (fecha, tipo, descripcion, monto, id_familiar, id_donante)
             VALUES (NOW(), $1, $2, $3, $4, $5) RETURNING *`,
            [tipo, descripcion, montoFinal, id_familiar || null, id_donante || null]
        );
        res.status(201).json(nuevaTransaccion.rows[0]);
    } catch (err) {
        console.error("Error al registrar transacción:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// La ruta POST /pago ya no es necesaria, fue unificada en la ruta POST / de arriba.

module.exports = router;