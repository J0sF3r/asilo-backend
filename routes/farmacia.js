// backend/routes/farmacia.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { farmaciaAuth } = require('../middleware/auth');

// @route   GET api/farmacia/pendientes
router.get('/pendientes', farmaciaAuth, async (req, res) => {
    try {
        const pendientes = await db.query(
            `SELECT 
                mv.id_visita, mv.id_medicamento,
                p.nombre AS nombre_paciente, 
                m.nombre AS nombre_medicamento,
                mv.cantidad, mv.tiempo_aplicacion AS indicaciones
             FROM medicamento_visita mv
             JOIN medicamento m ON mv.id_medicamento = m.id_medicamento
             JOIN visita_medica vm ON mv.id_visita = vm.id_visita
             JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
             JOIN paciente p ON s.id_paciente = p.id_paciente
             WHERE mv.estado = 'pendiente'
             ORDER BY s.fecha_solicitud ASC`
        );
        res.json(pendientes.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   PUT api/farmacia/entregar 
router.put('/entregar', farmaciaAuth, async (req, res) => {
    const { id_visita, id_medicamento } = req.body;


    try {
        // Obtener el costo del medicamento y la cantidad
        const medInfo = await db.query(
            `SELECT m.costo, mv.cantidad 
             FROM medicamento_visita mv
             JOIN medicamento m ON mv.id_medicamento = m.id_medicamento
             WHERE mv.id_visita = $1 AND mv.id_medicamento = $2 AND mv.estado = 'pendiente'`,
            [id_visita, id_medicamento]
        );

        if (medInfo.rows.length === 0) {
            return res.status(404).json({ msg: 'Este medicamento no está pendiente o ya fue entregado.' });
        }

        const costoMedicamento = parseFloat(medInfo.rows[0].costo) * parseInt(medInfo.rows[0].cantidad, 10);

        // Marcar el medicamento como 'entregado'
        await db.query(
            `UPDATE medicamento_visita 
             SET estado = 'entregado', fecha_entrega = NOW()
             WHERE id_visita = $1 AND id_medicamento = $2`,
            [id_visita, id_medicamento]
        );

        // Añadir el costo del medicamento al cobro total de la visita
        await db.query(
            `UPDATE cobro 
             SET monto_total = monto_total + $1 
             WHERE id_visita = $2`,
            [costoMedicamento, id_visita]
        );

        res.json({ msg: 'Entrega registrada y costo añadido al cobro.' });

    } catch (err) {
        console.error("Error al registrar entrega:", err.message);
        res.status(500).json({ msg: "Error en el servidor al procesar la entrega." });
    }
});

//pendientes de tratamientos fijos
router.get('/pendientes-fijos', farmaciaAuth, async (req, res) => {
    try {
        // Esta consulta es compleja, pero es el corazón de la lógica de farmacia
        const pendientesFijos = await db.query(
            `WITH UltimaDispensacion AS (
                -- Primero, encontramos la fecha de la última entrega para cada tratamiento
                SELECT 
                    id_tratamiento_fijo, 
                    MAX(fecha_cobro) as ultima_fecha
                FROM Cobro_Medicamento_Fijo
                GROUP BY id_tratamiento_fijo
            )
            -- Ahora, seleccionamos los tratamientos que necesitan una nueva entrega
            SELECT 
                tf.id_tratamiento,
                p.nombre AS nombre_paciente,
                tf.nombre_medicamento,
                tf.dosis,
                tf.frecuencia,
                ud.ultima_fecha
            FROM Tratamiento_Fijo tf
            JOIN Condicion_Base cb ON tf.id_condicion = cb.id_condicion
            JOIN Paciente p ON cb.id_paciente = p.id_paciente
            LEFT JOIN UltimaDispensacion ud ON tf.id_tratamiento = ud.id_tratamiento_fijo
            WHERE 
                p.activo = TRUE
                -- Lógica para determinar si está pendiente:
                -- 1. Nunca se ha dispensado (ultima_fecha es NULL)
                -- 2. O la próxima dispensación (basada en la frecuencia) es hoy o antes
                AND (ud.ultima_fecha IS NULL OR 
                    -- Esta es una lógica simplificada. Asume una frecuencia mensual.
                    -- En una versión más avanzada, la frecuencia "Dos veces al día" se traduciría a un cálculo más complejo.
                    ud.ultima_fecha <= NOW() - INTERVAL '28 days'
                )`
        );
        res.json(pendientesFijos.rows);
    } catch (err) {
        console.error("Error al obtener tratamientos fijos pendientes:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;