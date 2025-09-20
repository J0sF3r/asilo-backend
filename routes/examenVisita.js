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
router.put('/examenes_visita/:id_visita/:id_examen', adminAuth, async (req, res) => {
    const { id_visita, id_examen } = req.params;
    const { resultado, fecha_realizacion } = req.body;
    try {
        const updated = await db.query(
            `UPDATE examen_visita SET resultado = $1, fecha_realizacion = $2
             WHERE id_visita = $3 AND id_examen = $4 RETURNING *`,
            [resultado, fecha_realizacion || null, id_visita, id_examen]
        );
        res.json(updated.rows[0]);
    } catch(err) {
        console.error(err.message);
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