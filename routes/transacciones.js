// En: backend/routes/transacciones.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth } = require('../middleware/auth'); // Solo el admin puede gestionar finanzas

// @route   GET api/transacciones
// @desc    Obtener TODAS las transacciones (cargos automáticos + manuales)
router.get('/', adminAuth, async (req, res) => {
    try {
        const query = `
            -- 1. Cargos de Consultas
            SELECT 
                vm.id_visita AS id_original,
                vm.fecha_visita AS fecha,
                'Cargo Consulta' AS tipo,
                'Consulta: ' || vm.diagnostico AS descripcion,
                p.nombre AS nombre_paciente,
                vm.costo_final_con_descuento AS monto,
                pf.id_familiar
            FROM visita_medica vm
            JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            JOIN paciente p ON s.id_paciente = p.id_paciente
            LEFT JOIN paciente_familiar pf ON p.id_paciente = pf.id_paciente AND pf.es_contacto_principal = TRUE
            WHERE vm.costo_final_con_descuento > 0

            UNION ALL

            -- 2. Cargos de Exámenes
            SELECT 
                ev.id_examen AS id_original,
                ev.fecha_realizacion AS fecha,
                'Cargo Examen' AS tipo,
                'Examen: ' || e.nombre_examen AS descripcion,
                p.nombre AS nombre_paciente,
                ev.costo_cobrado AS monto,
                pf.id_familiar
            FROM examen_visita ev
            JOIN examen e ON ev.id_examen = e.id_examen
            JOIN visita_medica vm ON ev.id_visita = vm.id_visita
            JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            JOIN paciente p ON s.id_paciente = p.id_paciente
            LEFT JOIN paciente_familiar pf ON p.id_paciente = pf.id_paciente AND pf.es_contacto_principal = TRUE
            WHERE ev.costo_cobrado > 0

            UNION ALL

            -- 3. Cargos de Medicamentos de Visita
            SELECT 
                mv.id_medicamento AS id_original,
                mv.fecha_entrega AS fecha,
                'Cargo Medicamento Visita' AS tipo,
                'Medicamento: ' || m.nombre AS descripcion,
                p.nombre AS nombre_paciente,
                mv.costo_cobrado AS monto,
                pf.id_familiar
            FROM medicamento_visita mv
            JOIN medicamento m ON mv.id_medicamento = m.id_medicamento
            JOIN visita_medica vm ON mv.id_visita = vm.id_visita
            JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            JOIN paciente p ON s.id_paciente = p.id_paciente
            LEFT JOIN paciente_familiar pf ON p.id_paciente = pf.id_paciente AND pf.es_contacto_principal = TRUE
            WHERE mv.costo_cobrado > 0

            UNION ALL

            -- 4. Cargos de Tratamientos Fijos
            SELECT 
                cmf.id_tratamiento_fijo AS id_original,
                cmf.fecha_cobro AS fecha,
                'Cargo Tratamiento Fijo' AS tipo,
                'Tratamiento Fijo: ' || tf.nombre_medicamento AS descripcion,
                p.nombre AS nombre_paciente,
                cmf.costo_total AS monto,
                pf.id_familiar
            FROM Cobro_Medicamento_Fijo cmf
            JOIN Tratamiento_Fijo tf ON cmf.id_tratamiento_fijo = tf.id_tratamiento
            JOIN Condicion_Base cb ON tf.id_condicion = cb.id_condicion
            JOIN Paciente p ON cb.id_paciente = p.id_paciente
            LEFT JOIN paciente_familiar pf ON p.id_paciente = pf.id_paciente AND pf.es_contacto_principal = TRUE
            WHERE cmf.costo_total > 0
            
            UNION ALL

            -- 5. Transacciones Manuales (Donaciones, Gastos, etc.)
            SELECT
                t.id_transaccion AS id_original,
                t.fecha,
                t.tipo,
                t.descripcion,
                f.nombre AS nombre_paciente, -- Usamos el campo paciente para el familiar aquí
                t.monto,
                t.id_familiar
            FROM Transacciones t
            LEFT JOIN Familiar f ON t.id_familiar = f.id_familiar

            ORDER BY fecha DESC;
        `;
        const transacciones = await db.query(query);
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