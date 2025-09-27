// backend/routes/laboratorio.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { labAuth } = require('../middleware/auth'); // Permiso para el rol de Laboratorio

// @route   GET /api/laboratorio/pendientes
// @desc    Obtener todos los exámenes con resultado pendiente
router.get('/pendientes', labAuth, async (req, res) => {
    try {
        const query = `
            SELECT
                ev.id_visita,
                ev.id_examen,
                s.fecha_solicitud,
                p.nombre AS nombre_paciente,
                e.nombre_examen,
                s.diagnostico_general AS diagnostico_preliminar, -- Diagnóstico del médico general
                vm.observaciones_medicas, -- Observaciones del especialista
                med_solicitante.nombre AS medico_solicitante -- Nombre del especialista que ordenó el examen
            FROM examen_visita ev
            -- Unir con examen para obtener el nombre del examen
            JOIN examen e ON ev.id_examen = e.id_examen
            -- Unir con visita_medica para obtener la solicitud y observaciones
            JOIN visita_medica vm ON ev.id_visita = vm.id_visita
            -- Unir con solicitud para obtener la fecha y el paciente
            JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            -- Unir con paciente para obtener su nombre
            JOIN paciente p ON s.id_paciente = p.id_paciente
            -- Unir con medico para obtener el nombre del especialista que solicitó el examen
            LEFT JOIN medico med_solicitante ON s.id_medico_especialista = med_solicitante.id_medico
            -- La condición clave: solo los que no tienen resultado
            WHERE ev.resultado IS NULL OR ev.resultado = ''
            ORDER BY s.fecha_solicitud ASC;
        `;
        const pendientes = await db.query(query);
        res.json(pendientes.rows);
    } catch (err) {
        console.error("Error al obtener exámenes pendientes:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   PUT /api/laboratorio/resultado
// @desc    Registrar el resultado de un examen
router.put('/resultado', labAuth, async (req, res) => {
    const { id_visita, id_examen, resultado, fecha_realizacion } = req.body;

    if (!id_visita || !id_examen || !resultado || !fecha_realizacion) {
        return res.status(400).json({ msg: 'Todos los campos son requeridos.' });
    }

    try {
        const updateQuery = `
            UPDATE examen_visita
            SET resultado = $1, fecha_realizacion = $2
            WHERE id_visita = $3 AND id_examen = $4
            RETURNING *;
        `;
        const updatedExamen = await db.query(updateQuery, [resultado, fecha_realizacion, id_visita, id_examen]);

        if (updatedExamen.rows.length === 0) {
            return res.status(404).json({ msg: 'No se encontró el examen para la visita especificada.' });
        }
        
        res.json({ msg: 'Resultado registrado exitosamente', data: updatedExamen.rows[0] });

    } catch (err) {
        console.error("Error al registrar resultado:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;