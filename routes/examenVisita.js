// backend/routes/examenVisita.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, generalViewAuth, labAuth } = require('../middleware/auth');

// @desc    Obtener todos los exámenes asignados a una visita, antes tenia adminAuth ahora generalViewAuth
router.get('/visitas/:id/examenes', generalViewAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const examenesAsignados = await db.query(
            `SELECT 
                e.id_examen, 
                e.nombre_examen, 
                e.costo,
                ev.resultado,
                ev.fecha_realizacion
             FROM examen_visita ev
             JOIN examen e ON ev.id_examen = e.id_examen
             WHERE ev.id_visita = $1`,
            [id]
        );
        res.json(examenesAsignados.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});


// @desc    Asignar un examen a una visita, antes tenia adminAuth ahora generalViewAuth
router.post('/visitas/:id/examenes', generalViewAuth, async (req, res) => {
    const { id: id_visita } = req.params;
    const { id_examen } = req.body;
    try {
        const newAsignacion = await db.query(
            `INSERT INTO examen_visita (id_visita, id_examen) VALUES ($1, $2) RETURNING *`,
            [id_visita, id_examen]
        );
        res.status(201).json(newAsignacion.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   PUT api/examenes_visita/:id_visita/:id_examen
// @desc    Actualizar el resultado de un examen en una visita
router.put('/:id_visita/:id_examen', labAuth, async (req, res) => {
    const { id_visita, id_examen } = req.params;
    const { resultado } = req.body;

    try {
        // --- 1. ACTUALIZAMOS EL EXAMEN (YA NO GUARDA COSTOS) ---
        const updated = await db.query(
            `UPDATE examen_visita 
             SET resultado = $1, fecha_realizacion = NOW(), estado = 'realizado'
             WHERE id_visita = $2 AND id_examen = $3 RETURNING *`,
            [resultado, id_visita, id_examen]
        );
        
        if (updated.rowCount === 0) {
            return res.status(404).json({ msg: 'No se encontró el examen asignado a esta visita.' });
        }

        // --- 2. OBTENEMOS INFO PARA EL MOVIMIENTO FINANCIERO ---
        const infoParaCobro = await db.query(
            `SELECT 
                e.costo, e.nombre_examen, s.id_paciente
             FROM examen e
             JOIN examen_visita ev ON e.id_examen = ev.id_examen
             JOIN visita_medica vm ON ev.id_visita = vm.id_visita
             JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
             WHERE ev.id_visita = $1 AND ev.id_examen = $2`,
            [id_visita, id_examen]
        );
        
        const { costo, nombre_examen, id_paciente } = infoParaCobro.rows[0];

        // --- 3. CREAMOS EL MOVIMIENTO FINANCIERO ---
        if (costo > 0) {
            const infoFamiliar = await db.query(
                'SELECT id_familiar FROM paciente_familiar WHERE id_paciente = $1 AND es_contacto_principal = TRUE',
                [id_paciente]
            );
            const id_familiar = infoFamiliar.rows[0]?.id_familiar;

            await db.query(
                `INSERT INTO Movimiento_Financiero 
                    (fecha, tipo, descripcion, monto, id_visita, id_familiar, estado_pago, monto_original, descuento_aplicado)
                 VALUES (NOW(), 'Cargo Examen', $1, $2, $3, $4, 'Pendiente', $2, 0)`,
                [nombre_examen, costo, id_visita, id_familiar]
            );
        }

        // --- 4. VERIFICAMOS SI TODOS LOS EXÁMENES ESTÁN COMPLETOS ---
        const pendientesQuery = `
            SELECT COUNT(*) 
            FROM examen_visita 
            WHERE id_visita = $1 AND resultado IS NULL;
        `;
        const pendientesResult = await db.query(pendientesQuery, [id_visita]);
        const numPendientes = parseInt(pendientesResult.rows[0].count, 10);

        if (numPendientes === 0) {
            await db.query(
                "UPDATE visita_medica SET estado = 'resultados_listos' WHERE id_visita = $1",
                [id_visita]
            );
        }

        res.json(updated.rows[0]);
    } catch(err) {
        console.error("Error al actualizar resultado de examen:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});
// @route   DELETE api/visitas/:id/examenes/:id_examen
// @desc    Quitar un examen de una visita
router.delete('/visitas/:id/examenes/:id_examen', adminAuth, async (req, res) => {
    const { id: id_visita, id_examen } = req.params;
    try {
        await db.query(
            "DELETE FROM examen_visita WHERE id_visita = $1 AND id_examen = $2",
            [id_visita, id_examen]
        );
        res.json({ msg: 'Asignación de examen eliminada' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;