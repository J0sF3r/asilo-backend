// backend/routes/examenVisita.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, generalViewAuth } = require('../middleware/auth');

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
router.put('/:id_visita/:id_examen', labAuth, async (req, res) => { // Usamos labAuth o el permiso que corresponda
    const { id_visita, id_examen } = req.params;
    const { resultado } = req.body;

    try {
        // 1. Buscamos el costo estándar del examen en el catálogo "examen"
        const costoExamenInfo = await db.query(
            `SELECT costo FROM examen WHERE id_examen = $1`,
            [id_examen]
        );
        
        // Si no se encuentra el examen en el catálogo, usamos 0 como costo
        const costo_cobrado = costoExamenInfo.rows[0]?.costo || 0;

        // 2. Actualizamos la tabla examen_visita con el resultado Y el costo cobrado
        const updated = await db.query(
            `UPDATE examen_visita 
             SET 
                resultado = $1, 
                fecha_realizacion = NOW(), 
                costo_cobrado = $2,
                estado = 'realizado'
             WHERE id_visita = $3 AND id_examen = $4 RETURNING *`,
            [resultado, costo_cobrado, id_visita, id_examen]
        );
        
        if (updated.rowCount === 0) {
            return res.status(404).json({ msg: 'No se encontró el examen asignado a esta visita.' });
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