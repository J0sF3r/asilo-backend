const express = require('express');
const router = express.Router();
const db = require('../db');
// Importamos los nuevos permisos junto con el de admin
const { adminAuth, generalAuth, foundationAuth, solicitudesViewAuth } = require('../middleware/auth');
const { enviarCorreoNotificacion } = require('../utils/emailService');

// @route   GET api/solicitudes
// @desc    Obtener todas las solicitudes
router.get('/', solicitudesViewAuth,  async (req, res) => {
    try {
        const solicitudes = await db.query(
            `SELECT 
                s.*, 
                p.nombre as nombre_paciente, 
                m.nombre as nombre_medico_general,
                s.motivo 
             FROM solicitud s
             JOIN paciente p ON s.id_paciente = p.id_paciente
             LEFT JOIN medico m ON s.id_medico_general = m.id_medico
             ORDER BY s.fecha_solicitud DESC`
        );
        res.json(solicitudes.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   POST api/solicitudes
// @desc    Crear una nueva solicitud (Acción de Administración)
router.post('/', adminAuth, async (req, res) => {
    const { id_paciente, id_medico_general, motivo } = req.body;
    try {
        const nuevaSolicitud = await db.query(
            `INSERT INTO solicitud (id_paciente, id_medico_general, motivo, estado)
             VALUES ($1, $2, $3, 'pendiente') RETURNING *`,
            [id_paciente, id_medico_general, motivo]
        );
        res.status(201).json(nuevaSolicitud.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   PUT api/solicitudes/:id/aprobar
// @desc    Aprobar una solicitud (Acción de Médico General)
router.put('/:id/aprobar', generalAuth, async (req, res) => {
    const { id } = req.params;
    // Ahora también recibimos el diagnóstico del Médico General
    const { especialidad_requerida, id_enfermero, diagnostico_general } = req.body; 

    try {
        const solicitudAprobada = await db.query(
            `UPDATE solicitud 
             SET especialidad_requerida = $1, id_enfermero = $2, diagnostico_general = $3, estado = 'aprobada'
             WHERE id_solicitud = $4 AND estado = 'pendiente' RETURNING *`,
            [especialidad_requerida, id_enfermero, diagnostico_general, id]
        );

        if (solicitudAprobada.rows.length === 0) {
            return res.status(404).json({ msg: 'Solicitud no encontrada o ya no está pendiente.' });
        }
        res.json(solicitudAprobada.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

router.post('/:id/programar', foundationAuth, async (req, res) => {
    const { id: id_solicitud } = req.params;
    const { id_medico_especialista, fecha_visita, lugar, costo_consulta } = req.body;

    try {
        // --- 1. OPERACIONES DE BASE DE DATOS (QUEDAN IGUAL) ---
        const nuevaVisita = await db.query(
            `INSERT INTO visita_medica (id_solicitud, fecha_visita, lugar, estado, costo_consulta)
             VALUES ($1, $2, $3, 'programada', $4) RETURNING *`,
            [id_solicitud, fecha_visita, lugar, costo_consulta || 0]
        );
        await db.query(
            `UPDATE solicitud SET id_medico_especialista = $1, estado = 'programada'
             WHERE id_solicitud = $2 AND estado = 'aprobada'`,
            [id_medico_especialista, id_solicitud]
        );

        // --- 2. LÓGICA DE CORREO MEJORADA ---
        const datosParaCorreoQuery = `
            SELECT 
                fam.email, 
                pac.nombre AS "nombrePaciente", 
                med_esp.nombre AS "nombreMedicoEspecialista",
                med_esp.especialidad AS "especialidadMedico",
                s.motivo AS "motivoVisita",
                med_gen.nombre AS "nombreMedicoGeneral",
                enf.nombre as "nombreEnfermero",
                enf.telefono as "telefonoEnfermero"
             FROM solicitud s
             JOIN paciente pac ON s.id_paciente = pac.id_paciente
             LEFT JOIN paciente_familiar pf ON pac.id_paciente = pf.id_paciente
             LEFT JOIN familiar fam ON pf.id_familiar = fam.id_familiar
             LEFT JOIN medico med_esp ON s.id_medico_especialista = med_esp.id_medico
             LEFT JOIN medico med_gen ON s.id_medico_general = med_gen.id_medico
             LEFT JOIN enfermero enf ON s.id_enfermero = enf.id_enfermero
             WHERE s.id_solicitud = $1 AND fam.email IS NOT NULL
             LIMIT 1
        `;
        const datosParaCorreoResult = await db.query(datosParaCorreoQuery, [id_solicitud]);

        if (datosParaCorreoResult.rows.length > 0) {
            const { email, ...datosCita } = datosParaCorreoResult.rows[0];
            datosCita.fechaVisita = fecha_visita;
            datosCita.lugar = lugar;
            await enviarCorreoNotificacion(email, datosCita);
        }
        
        res.status(201).json(nuevaVisita.rows[0]);
    } catch (err) {
        console.error("Error al programar la solicitud:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});


router.get('/:id', solicitudesViewAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                s.motivo,
                p.nombre as nombre_paciente,
                s.id_paciente
            FROM solicitud s
            JOIN paciente p ON s.id_paciente = p.id_paciente
            WHERE s.id_solicitud = $1;
        `;
        const solicitud = await db.query(query, [id]);

        if (solicitud.rows.length === 0) {
            return res.status(404).json({ msg: 'Solicitud no encontrada' });
        }

        res.json(solicitud.rows[0]);
    } catch (err) {
        console.error("Error al obtener la solicitud:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;