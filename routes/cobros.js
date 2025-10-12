// En: backend/routes/cobros.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const { farmaciaAuth } = require('../middleware/auth');

// @route   POST api/cobros-medicamentos
// @desc    Registrar un cobro por Tratamiento Fijo en la tabla unificada
router.post('/cobros-medicamentos', farmaciaAuth, async (req, res) => {
    const { id_tratamiento_fijo, cantidad_dispensada, costo_total } = req.body;

    try {
        // 1. Buscamos la información necesaria para la descripción del cobro
        const infoParaCobro = await db.query(
            `SELECT 
                tf.nombre_medicamento, 
                cb.id_paciente,
                p.nombre AS nombre_paciente
             FROM Tratamiento_Fijo tf
             JOIN Condicion_Base cb ON tf.id_condicion = cb.id_condicion
             JOIN Paciente p ON cb.id_paciente = p.id_paciente
             WHERE tf.id_tratamiento = $1`,
            [id_tratamiento_fijo]
        );

        if (infoParaCobro.rowCount === 0) {
            return res.status(404).json({ msg: 'Tratamiento no encontrado.' });
        }

        const { nombre_medicamento, id_paciente, nombre_paciente } = infoParaCobro.rows[0];
        const descripcion = `${nombre_medicamento} - Tratamiento recurrente para ${nombre_paciente}${cantidad_dispensada ? ` (${cantidad_dispensada})` : ''}`;

        // 2. Buscamos al familiar principal para asignarle el cobro
        const infoFamiliar = await db.query(
            'SELECT id_familiar FROM paciente_familiar WHERE id_paciente = $1 AND es_contacto_principal = TRUE',
            [id_paciente]
        );
        const id_familiar = infoFamiliar.rows[0]?.id_familiar;

        // 3. Creamos el registro en la tabla maestra 'Movimiento_Financiero'
        const nuevoMovimiento = await db.query(
            `INSERT INTO Movimiento_Financiero 
                (fecha, tipo, descripcion, monto, id_familiar, id_tratamiento_fijo, estado_pago, monto_original, descuento_aplicado)
             VALUES (NOW(), 'Cargo Medicamento Recurrente', $1, $2, $3, $4, 'Pendiente', $2, 0)
             RETURNING *`,
            [descripcion, parseFloat(costo_total), id_familiar, id_tratamiento_fijo]
        );

        res.status(201).json(nuevoMovimiento.rows[0]);

    } catch (err) {
        console.error("Error al registrar el cobro de tratamiento fijo:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;