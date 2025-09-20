// backend/routes/laboratorio.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { labAuth } = require('../middleware/auth');

// @route   GET api/laboratorio/pendientes
// @desc    Obtener todos los exámenes con resultado pendiente
router.get('/pendientes', labAuth, async (req, res) => {
    try {
        const pendientes = await db.query(
            `SELECT 
                ev.id_visita, 
                ev.id_examen,
                p.nombre AS nombre_paciente, 
                e.nombre_examen,
                s.fecha_solicitud,
                -- CAMPOS NUEVOS AÑADIDOS:
                vm.diagnostico AS diagnostico_preliminar,
                vm.observaciones_medicas,
                med.nombre AS medico_solicitante
             FROM examen_visita ev
             JOIN examen e ON ev.id_examen = e.id_examen
             JOIN visita_medica vm ON ev.id_visita = vm.id_visita
             JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
             JOIN paciente p ON s.id_paciente = p.id_paciente
             LEFT JOIN medico med ON s.id_medico_especialista = med.id_medico
             WHERE ev.resultado IS NULL OR ev.resultado = ''
             ORDER BY s.fecha_solicitud ASC`
        );
        res.json(pendientes.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   PUT api/laboratorio/resultado
// @desc    Registrar el resultado de un examen
router.put('/resultado', labAuth, async (req, res) => {
    const { id_visita, id_examen, resultado, fecha_realizacion } = req.body;

    if (!id_visita || !id_examen || !resultado || !fecha_realizacion) {
        return res.status(400).json({ msg: 'Todos los campos son requeridos.' });
    }

    try {
        const updated = await db.query(
            `UPDATE examen_visita 
             SET resultado = $1, fecha_realizacion = $2
             WHERE id_visita = $3 AND id_examen = $4 RETURNING *`,
            [resultado, fecha_realizacion, id_visita, id_examen]
        );

        if (updated.rows.length === 0) {
            return res.status(404).json({ msg: 'No se encontró el examen asignado para esta visita.' });
        }
        res.json(updated.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;