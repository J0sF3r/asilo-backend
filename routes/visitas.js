// backend/routes/visitas.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, foundationAuth, medicoAuth, auth } = require('../middleware/auth');

// Crear un nuevo registro de visita médica
router.post('/', adminAuth, async (req, res) => {
    const { id_solicitud, fecha_visita, lugar, observaciones_preparacion } = req.body;

    if (!id_solicitud || !fecha_visita || !lugar) {
        return res.status(400).json({ msg: 'Por favor, complete la fecha y el lugar.' });
    }

    try {
        const newVisita = await db.query(
            `INSERT INTO visita_medica (id_solicitud, fecha_visita, lugar, observaciones_preparacion, estado) 
             VALUES ($1, $2, $3, $4, 'programada') RETURNING *`,
            [id_solicitud, fecha_visita, lugar, observaciones_preparacion]
        );
        res.status(201).json(newVisita.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// Obtener todas las visitas médicas programadas
router.get('/', foundationAuth, async (req, res) => {
    try {
        let queryText = `
                SELECT 
                vm.id_visita,
                vm.id_solicitud,
                vm.fecha_visita,
                vm.lugar,
                vm.estado,
                p.nombre AS nombre_paciente, 
                me.nombre AS nombre_medico_especialista,
                en.nombre AS nombre_enfermero -- <-- Añadido
            FROM visita_medica vm
            JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            JOIN paciente p ON s.id_paciente = p.id_paciente
            LEFT JOIN medico me ON s.id_medico_especialista = me.id_medico
            LEFT JOIN enfermero en ON s.id_enfermero = en.id_enfermero
        `;
        const queryParams = [];

        if (req.user.nombre_rol === 'Medico Especialista') {
            queryText += ' WHERE s.id_medico_especialista = $1';
            queryParams.push(req.user.id_medico);
        }

        queryText += ' ORDER BY vm.fecha_visita DESC';
        
        const visitas = await db.query(queryText, queryParams);
        res.json(visitas.rows);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el servidor');
    }
});


// OBTENER CITAS PROGRAMADAS PARA EL MÉDICO AUTENTICADO
// En backend/routes/visitas.js
router.get('/mis-citas', medicoAuth, async (req, res) => {
    try {
        const { estado } = req.query; 
        const idMedicoLogueado = req.user.id_medico;
        
        if (!idMedicoLogueado) {
            return res.json([]);
        }
        let queryParams = [idMedicoLogueado];
        let query = `
            SELECT 
                vm.id_visita, vm.id_solicitud, vm.fecha_visita, vm.lugar, vm.estado,
                p.nombre AS nombre_paciente, 
                me.nombre AS nombre_medico_especialista,
                en.nombre AS nombre_enfermero
            FROM visita_medica vm
            JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            JOIN paciente p ON s.id_paciente = p.id_paciente
            LEFT JOIN medico me ON s.id_medico_especialista = me.id_medico
            LEFT JOIN enfermero en ON s.id_enfermero = en.id_enfermero
            WHERE s.id_medico_especialista = $1
        `;

        // Si se proporciona un estado en la URL, se añade a la consulta
        if (estado) {
            queryParams.push(estado);
            query += ` AND vm.estado = $2`;
        }

        query += ` ORDER BY vm.fecha_visita DESC;`;

        const citasAsignadas = await db.query(query, queryParams);
        res.json(citasAsignadas.rows);

    } catch (err) {
        console.error("Error al obtener las citas del médico:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// Obtener visitas con resultados de examen listos para revisión médica
router.get('/pendientes-revision', auth, async (req, res) => { // Usamos el middleware 'auth' general
    try {
        const userRole = req.user.nombre_rol;
        const userId = req.user.id_usuario; // Obtenemos el ID del usuario del token

        let query = `
            SELECT 
                vm.id_visita,
                vm.fecha_visita,
                p.nombre as nombre_paciente
            FROM visita_medica vm
            JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            JOIN paciente p ON s.id_paciente = p.id_paciente
            WHERE vm.estado = 'resultados_listos' 
        `;
        
        const queryParams = [];

        // Si el usuario es un Administrador, puede ver todas las pendientes
        if (userRole === 'Administración') {
            // No se añaden más filtros, la consulta se queda como está.
        } 
        // Si es un Médico Especialista, solo ve las suyas
        else if (userRole === 'Medico Especialista') {
            query += ` AND s.id_medico_especialista = $1`;
            queryParams.push(userId); // Filtramos por el ID del médico logueado
        } 
        // Si es cualquier otro rol (ej. Médico General), no debe ver nada
        else {
            return res.json([]); // Devolvemos una lista vacía
        }

        query += ` ORDER BY vm.fecha_visita ASC;`;

        const pendientes = await db.query(query, queryParams);
        res.json(pendientes.rows);

    } catch (err) {
        console.error("Error al obtener visitas pendientes de revisión:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});
//  Actualizar una visita médica y la solicitud original
router.put('/:id', medicoAuth, async (req, res) => { 
    const { id: id_visita } = req.params;
    const { estado, diagnostico, observaciones_medicas, proxima_cita } = req.body;

    try {
        const fieldsToUpdate = [];
        const values = [];
        let queryIndex = 1;

        // 1. Construimos la consulta dinámicamente
        if (estado) {
            fieldsToUpdate.push(`estado = $${queryIndex++}`);
            values.push(estado);
        }
        if (diagnostico) {
            fieldsToUpdate.push(`diagnostico = $${queryIndex++}`);
            values.push(diagnostico);
        }
        if (observaciones_medicas) {
            fieldsToUpdate.push(`observaciones_medicas = $${queryIndex++}`);
            values.push(observaciones_medicas);
        }
        if (proxima_cita) {
            fieldsToUpdate.push(`proxima_cita = $${queryIndex++}`);
            values.push(proxima_cita);
        }

        // Si no se envió ningún campo para actualizar, no hacemos nada
        if (fieldsToUpdate.length === 0) {
            // Buscamos la visita solo para obtener la info para la lógica de cobro
             const visitaExistente = await db.query('SELECT * FROM visita_medica WHERE id_visita = $1', [id_visita]);
             if (visitaExistente.rowCount === 0) return res.status(404).json({ msg: 'Visita no encontrada.' });
        } else {
            // Si hay campos para actualizar, ejecutamos el UPDATE
            values.push(id_visita);
            const updateQuery = `
                UPDATE visita_medica 
                SET ${fieldsToUpdate.join(', ')} 
                WHERE id_visita = $${queryIndex} 
                RETURNING *;
            `;
            const updatedResult = await db.query(updateQuery, values);
            if (updatedResult.rowCount === 0) return res.status(404).json({ msg: 'Visita no encontrada.' });
        }

        if (estado === 'completada') {
            const costoConsulta = parseFloat(updatedVisita.rows[0].costo_consulta) || 0;
            const costoExamenesRes = await db.query(
                `SELECT COALESCE(SUM(e.costo), 0) as total FROM examen_visita ev
                 JOIN examen e ON ev.id_examen = e.id_examen WHERE ev.id_visita = $1`,
                [id_visita]
            );
            const totalExamenes = parseFloat(costoExamenesRes.rows[0].total);
            const montoFinal = costoConsulta + totalExamenes;
            await db.query(
                `INSERT INTO cobro (id_visita, monto_total, monto_pagado, estado_pago)
                 VALUES ($1, $2, 0, 'pendiente')
                 ON CONFLICT (id_visita) DO UPDATE SET monto_total = $2`,
                [id_visita, montoFinal]
            );
            
            const id_solicitud = updatedVisita.rows[0].id_solicitud;
            await db.query(`UPDATE solicitud SET estado = 'atendida' WHERE id_solicitud = $1`, [id_solicitud]);
        }

        res.json({ msg: 'Visita actualizada exitosamente' });

    } catch (err) {
        console.error("Error al actualizar la visita:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;
