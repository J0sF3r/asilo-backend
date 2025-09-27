// backend/routes/examenes.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, generalViewAuth, foundationAuth} = require('../middleware/auth');

// @route   POST api/examenes
// @desc    Crear un nuevo examen
router.post('/', foundationAuth, async (req, res) => {
    const { nombre_examen, descripcion, costo } = req.body;
    if (!nombre_examen || !costo) {
        return res.status(400).json({ msg: 'El nombre y el costo del examen son requeridos.' });
    }
    try {
        const newExamen = await db.query(
            "INSERT INTO examen (nombre_examen, descripcion, costo) VALUES ($1, $2, $3) RETURNING *",
            [nombre_examen, descripcion, costo]
        );
        res.status(201).json(newExamen.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   GET api/examenes
// @desc    Obtener todos los exámenes antes tenia adminAuth ahora generalViewAuth
router.get('/', generalViewAuth, async (req, res) => {
    try {
        const examenes = await db.query("SELECT * FROM examen ORDER BY nombre_examen ASC");
        res.json(examenes.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   PUT api/examenes/:id
// @desc    Actualizar un examen
router.put('/:id', foundationAuth, async (req, res) => {
    const { id } = req.params;
    const { nombre_examen, descripcion, costo } = req.body;
    if (!nombre_examen || !costo) {
        return res.status(400).json({ msg: 'El nombre y el costo del examen son requeridos.' });
    }
    try {
        const updatedExamen = await db.query(
            "UPDATE examen SET nombre_examen = $1, descripcion = $2, costo = $3 WHERE id_examen = $4 RETURNING *",
            [nombre_examen, descripcion, costo, id]
        );
        if (updatedExamen.rows.length === 0) {
            return res.status(404).json({ msg: 'Examen no encontrado' });
        }
        res.json(updatedExamen.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   DELETE api/examenes/:id
// @desc    Eliminar un examen
router.delete('/:id', foundationAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const deleteOp = await db.query("DELETE FROM examen WHERE id_examen = $1", [id]);
        if (deleteOp.rowCount === 0) {
            return res.status(404).json({ msg: 'Examen no encontrado' });
        }
        res.json({ msg: 'Examen eliminado exitosamente' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;