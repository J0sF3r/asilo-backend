// backend/routes/pacientes.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, medicoAuth, diagnosticoAuth, generalAuth } = require('../middleware/auth'); // Usaremos adminAuth para proteger las rutas

// @desc    Registrar un nuevo paciente
router.post('/', adminAuth, async (req, res) => {
    const { nombre, fecha_nacimiento, sexo, direccion, telefono, email, fecha_ingreso } = req.body;
    try {
        const newPaciente = await db.query(
            `INSERT INTO Paciente (nombre, fecha_nacimiento, sexo, direccion, telefono, email, fecha_ingreso) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [nombre, fecha_nacimiento, sexo, direccion, telefono, email, fecha_ingreso]
        );
        res.status(201).json(newPaciente.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

router.post('/:id/familiares', generalAuth, async (req, res) => {
    try {
        const { id: id_paciente } = req.params;
        const { id_familiar } = req.body;

        if (!id_familiar) {
            return res.status(400).json({ msg: 'Se requiere el ID del familiar' });
        }

        const newLink = await db.query(
            `INSERT INTO Paciente_Familiar (id_paciente, id_familiar) VALUES ($1, $2) RETURNING *`,
            [id_paciente, id_familiar]
        );
        res.status(201).json(newLink.rows[0]);
    } catch (err) {

        if (err.code === '23505') {
            return res.status(400).json({ msg: 'Este familiar ya está asignado a este paciente.' });
        }
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @desc    Obtener todos los pacientes
router.get('/', generalAuth, async (req, res) => {
    try {
        const pacientes = await db.query(
        `SELECT 
         id_paciente,
         nombre,
         fecha_nacimiento,
         DATE_PART('year', AGE(fecha_nacimiento)) AS edad, -- ← AGREGAR ESTO
         sexo,
         telefono,
         direccion,
         email,
         activo
         FROM Paciente
          WHERE activo = TRUE
         ORDER BY nombre`,);
        res.json(pacientes.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

router.get('/:id', generalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const paciente = await db.query('SELECT * FROM Paciente WHERE id_paciente = $1 AND activo = TRUE', [id]);

        if (paciente.rows.length === 0) {
            return res.status(404).json({ msg: 'Paciente no encontrado' });
        }
        res.json(paciente.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

router.get('/:id/familiares', generalAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const familiares = await db.query(
            `SELECT f.id_familiar, f.nombre, f.parentesco, f.telefono, f.email, pf.es_contacto_principal 
             FROM Familiar f
             JOIN Paciente_Familiar pf ON f.id_familiar = pf.id_familiar
             WHERE pf.id_paciente = $1 AND f.activo = TRUE`,
            [id]
        );
        res.json(familiares.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// Get historial de solicitudes de un paciente
router.get('/:id/solicitudes', generalAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const solicitudesRes = await db.query(
            `SELECT s.*, mg.nombre as nombre_medico_general, me.nombre as nombre_medico_especialista
             FROM solicitud s
             LEFT JOIN medico mg ON s.id_medico_general = mg.id_medico
             LEFT JOIN medico me ON s.id_medico_especialista = me.id_medico
             WHERE s.id_paciente = $1 ORDER BY s.fecha_solicitud DESC`, [id]
        );
        const solicitudes = solicitudesRes.rows;

        for (const solicitud of solicitudes) {
            const visitaRes = await db.query(
                `SELECT * FROM visita_medica WHERE id_solicitud = $1 LIMIT 1`,
                [solicitud.id_solicitud]
            );

            if (visitaRes.rows.length > 0) {
                const visita = visitaRes.rows[0];
                const examenesRes = await db.query(
                    `SELECT e.nombre_examen, e.costo, ev.resultado, ev.fecha_realizacion
                     FROM examen_visita ev
                     JOIN examen e ON ev.id_examen = e.id_examen
                     WHERE ev.id_visita = $1`,
                    [visita.id_visita]
                );
                visita.examenes = examenesRes.rows;
                solicitud.visita = visita;

                const medicamentosRes = await db.query(
                    `SELECT m.nombre, mv.cantidad, mv.tiempo_aplicacion, mv.estado
                     FROM medicamento_visita mv
                     JOIN medicamento m ON mv.id_medicamento = m.id_medicamento
                     WHERE mv.id_visita = $1`,
                    [visita.id_visita]
                );
                visita.medicamentos = medicamentosRes.rows;

                solicitud.visita = visita;
            }
        }
        res.json(solicitudes);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});


//delete familiar from paciente
router.delete('/:id_paciente/familiares/:id_familiar', adminAuth, async (req, res) => {
    try {
        const { id_paciente, id_familiar } = req.params;

        const deleteLink = await db.query(
            `DELETE FROM Paciente_Familiar WHERE id_paciente = $1 AND id_familiar = $2 RETURNING *`,
            [id_paciente, id_familiar]
        );

        if (deleteLink.rowCount === 0) {
            return res.status(404).json({ msg: 'El vínculo entre paciente y familiar no fue encontrado.' });
        }

        res.json({ msg: 'Familiar desvinculado exitosamente.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @desc    Obtener el historial médico completo de un paciente
router.get('/:id/historial', medicoAuth, async (req, res) => {
    const { id: id_paciente } = req.params;

    try {
        // --- 1. OBTENER HISTORIAL DE VISITAS ---
        const visitasQuery = `
            SELECT 
                vm.id_visita, 
                vm.fecha_visita, 
                vm.diagnostico,  
                vm.observaciones_medicas,       
                me.nombre as nombre_medico
            FROM visita_medica vm
            JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            LEFT JOIN medico me ON s.id_medico_especialista = me.id_medico
            WHERE s.id_paciente = $1 ORDER BY vm.fecha_visita DESC;
        `;
        const visitasResult = await db.query(visitasQuery, [id_paciente]);
        const visitas = visitasResult.rows;

        for (const visita of visitas) {

            const examenesRes = await db.query(
                `SELECT e.nombre_examen, ev.resultado FROM examen_visita ev 
                 JOIN examen e ON ev.id_examen = e.id_examen WHERE ev.id_visita = $1`,
                [visita.id_visita]
            );
            visita.examenes = examenesRes.rows;

            const medicamentosRes = await db.query(
                `SELECT m.nombre, mv.cantidad, mv.tiempo_aplicacion 
                 FROM medicamento_visita mv
                 JOIN medicamento m ON mv.id_medicamento = m.id_medicamento 
                 WHERE mv.id_visita = $1`,
                [visita.id_visita]
            );
            visita.medicamentos = medicamentosRes.rows;
        }

        const condicionesResult = await db.query('SELECT * FROM Condicion_Base WHERE id_paciente = $1', [id_paciente]);
        const condiciones = condicionesResult.rows;
        for (const condicion of condiciones) {
            const tratamientosRes = await db.query('SELECT * FROM Tratamiento_Fijo WHERE id_condicion = $1', [condicion.id_condicion]);
            condicion.tratamientos = tratamientosRes.rows;
        }

        res.json({
            visitas: visitas,
            condiciones: condiciones
        });
    } catch (err) {
        console.error("Error al obtener el historial del paciente:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @desc    Actualizar un paciente existente
router.put('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const { nombre, fecha_nacimiento, sexo, direccion, telefono, email } = req.body;

    try {
        const updatePaciente = await db.query(
            `UPDATE Paciente 
             SET nombre = $1, fecha_nacimiento = $2, sexo = $3, direccion = $4, telefono = $5, email = $6
             WHERE id_paciente = $7 RETURNING *`,
            [nombre, fecha_nacimiento, sexo, direccion, telefono, email, id]
        );

        if (updatePaciente.rowCount === 0) {
            return res.status(404).json({ msg: 'Paciente no encontrado' });
        }

        res.json(updatePaciente.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   DELETE api/pacientes/:id
router.delete('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const deactivatePaciente = await db.query(
            'UPDATE Paciente SET activo = FALSE WHERE id_paciente = $1 RETURNING *',
            [id]
        );

        if (deactivatePaciente.rowCount === 0) {
            return res.status(404).json({ msg: 'Paciente no encontrado' });
        }

        res.json({ msg: 'Paciente desactivado exitosamente' }); // Mensaje actualizado
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @desc    Obtener todas las condiciones de base de un paciente
router.get('/:id/condiciones', generalAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const condicionesRes = await db.query(
            'SELECT * FROM Condicion_Base WHERE id_paciente = $1 ORDER BY fecha_diagnostico DESC',
            [id]
        );
        const condiciones = condicionesRes.rows;

        for (const condicion of condiciones) {
            const tratamientosRes = await db.query(
                'SELECT * FROM Tratamiento_Fijo WHERE id_condicion = $1 ORDER BY fecha_inicio ASC',
                [condicion.id_condicion]
            );
            condicion.tratamientos = tratamientosRes.rows;
        }

        res.json(condiciones);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});


// @desc    Añadir una nueva condición de base a un paciente
router.post('/:id/condiciones', diagnosticoAuth, async (req, res) => {
    const { id: id_paciente } = req.params;
    const { nombre_condicion, fecha_diagnostico, observaciones } = req.body;

    try {
        const nuevaCondicion = await db.query(
            `INSERT INTO Condicion_Base (id_paciente, nombre_condicion, fecha_diagnostico, observaciones)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [id_paciente, nombre_condicion, fecha_diagnostico, observaciones]
        );
        res.status(201).json(nuevaCondicion.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @desc    Designar a un familiar como el contacto principal
router.put('/:id/familiares/:id_familiar/principal', adminAuth, async (req, res) => {
    const { id: id_paciente, id_familiar } = req.params;

    try {

        await db.query(
            'UPDATE Paciente_Familiar SET es_contacto_principal = FALSE WHERE id_paciente = $1',
            [id_paciente]
        );

        const result = await db.query(
            'UPDATE Paciente_Familiar SET es_contacto_principal = TRUE WHERE id_paciente = $1 AND id_familiar = $2 RETURNING *',
            [id_paciente, id_familiar]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ msg: 'La asignación entre paciente y familiar no fue encontrada.' });
        }

        res.json({ msg: 'Contacto principal actualizado exitosamente.', data: result.rows[0] });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});
module.exports = router;