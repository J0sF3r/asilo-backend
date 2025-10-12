const express = require('express');
const router = express.Router();
const db = require('../db');
const { farmaciaAuth } = require('../middleware/auth');

// @route   GET api/farmacia/pendientes-visita
// @desc    Obtener medicamentos pendientes de VISITAS PUNTUALES
router.get('/pendientes-visita', farmaciaAuth, async (req, res) => {
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
        console.error("Error al obtener pendientes de visita:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   PUT api/farmacia/entregar-visita
// @desc    Entregar un medicamento de una VISITA PUNTUAL y registrar el costo
// En: backend/routes/farmacia.js
router.put('/entregar-visita', farmaciaAuth, async (req, res) => {
    const { id_visita, id_medicamento } = req.body;
    try {
        // --- 1. SE MARCA EL MEDICAMENTO COMO ENTREGADO ---
        const updateResult = await db.query(
            `UPDATE medicamento_visita 
             SET estado = 'entregado', fecha_entrega = NOW()
             WHERE id_visita = $1 AND id_medicamento = $2 AND estado = 'pendiente'
             RETURNING cantidad`,
            [id_visita, id_medicamento]
        );

        if (updateResult.rowCount === 0) {
            return res.status(404).json({ msg: 'Este medicamento no está pendiente o ya fue entregado.' });
        }

        // --- 2. LÓGICA DE COBRO (AQUÍ SE USA TU SELECT) ---
        // Se busca la información necesaria para crear el movimiento financiero
        const infoParaCobro = await db.query(
            `SELECT 
                m.nombre AS nombre_medicamento, 
                m.costo,
                s.id_paciente
             FROM medicamento m
             JOIN medicamento_visita mv ON m.id_medicamento = mv.id_medicamento
             JOIN visita_medica vm ON mv.id_visita = vm.id_visita
             JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
             WHERE mv.id_visita = $1 AND mv.id_medicamento = $2`,
            [id_visita, id_medicamento]
        );
        
        const { nombre_medicamento, costo, id_paciente } = infoParaCobro.rows[0];
        const cantidad = parseInt(updateResult.rows[0].cantidad, 10) || 1;
        const costo_total = (parseFloat(costo) || 0) * cantidad;

        if (costo_total > 0) {
            const infoFamiliar = await db.query(
                'SELECT id_familiar FROM paciente_familiar WHERE id_paciente = $1 AND es_contacto_principal = TRUE',
                [id_paciente]
            );
            const id_familiar = infoFamiliar.rows[0]?.id_familiar;

            // --- 3. SE CREA EL REGISTRO EN LA TABLA MAESTRA ---
            await db.query(
                `INSERT INTO Movimiento_Financiero 
                    (fecha, tipo, descripcion, monto, id_visita, id_familiar, estado_pago, monto_original)
                 VALUES (NOW(), 'Cargo Medicamento', $1, $2, $3, $4, 'Pendiente', $2)`,
                [nombre_medicamento, -costo_total, id_visita, id_familiar]
            );
        }

        res.json({ msg: 'Entrega registrada y cobro generado exitosamente.' });
    } catch (err) {
        console.error("Error al registrar entrega:", err.message);
        res.status(500).json({ msg: "Error en el servidor al procesar la entrega." });
    }
});
// @route   GET api/farmacia/pendientes-fijos
// @desc    Obtener la lista de TRATAMIENTOS FIJOS pendientes de dispensar
router.get('/pendientes-fijos', farmaciaAuth, async (req, res) => {
    try {
        const pendientesFijos = await db.query(
            `WITH UltimaDispensacion AS (
                SELECT 
                    id_tratamiento_fijo, 
                    MAX(fecha_cobro) as ultima_fecha
                FROM Cobro_Medicamento_Fijo
                GROUP BY id_tratamiento_fijo
            )
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
                AND (ud.ultima_fecha IS NULL OR 
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