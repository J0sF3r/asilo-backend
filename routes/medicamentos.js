// backend/routes/medicamentos.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, generalAuth, generalViewAuth } = require('../middleware/auth');


// Crear un nuevo medicamento
router.post('/', adminAuth, async (req, res) => {
    const { nombre, descripcion, costo } = req.body;
    if (!nombre || !costo) {
        return res.status(400).json({ msg: 'El nombre y el costo del medicamento son requeridos.' });
    }
    try {
        const newMedicamento = await db.query(
            "INSERT INTO medicamento (nombre, descripcion, costo) VALUES ($1, $2, $3) RETURNING *",
            [nombre, descripcion, costo]
        );
        res.status(201).json(newMedicamento.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});


// Obtener todos los medicamentos, antes tenia adminAuth ahora generalViewAuth
router.get('/', generalViewAuth, async (req, res) => {
    try {
        const medicamentos = await db.query("SELECT * FROM medicamento ORDER BY nombre ASC");
        res.json(medicamentos.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});


// Actualizar un medicamento
router.put('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, costo } = req.body;
    if (!nombre || !costo) {
        return res.status(400).json({ msg: 'El nombre y el costo son requeridos.' });
    }
    try {
        const updatedMedicamento = await db.query(
            "UPDATE medicamento SET nombre = $1, descripcion = $2, costo = $3 WHERE id_medicamento = $4 RETURNING *",
            [nombre, descripcion, costo, id]
        );
        if (updatedMedicamento.rows.length === 0) {
            return res.status(404).json({ msg: 'Medicamento no encontrado' });
        }
        res.json(updatedMedicamento.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});


// Eliminar un medicamento
router.delete('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const deleteOp = await db.query("DELETE FROM medicamento WHERE id_medicamento = $1", [id]);
        if (deleteOp.rowCount === 0) {
            return res.status(404).json({ msg: 'Medicamento no encontrado' });
        }
        res.json({ msg: 'Medicamento eliminado exitosamente' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;