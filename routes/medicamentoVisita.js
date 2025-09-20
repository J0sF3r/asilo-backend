// backend/routes/medicamentoVisita.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, generalViewAuth } = require('../middleware/auth');

// @route   GET api/visitas/:id/medicamentos
// @desc    Obtener todos los medicamentos asignados a una visita, antes tenia adminAuth ahora generalViewAuth
router.get('/visitas/:id/medicamentos', generalViewAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const medicamentosAsignados = await db.query(
            `SELECT mv.*, m.nombre, m.costo
             FROM medicamento_visita mv
             JOIN medicamento m ON mv.id_medicamento = m.id_medicamento
             WHERE mv.id_visita = $1`,
            [id]
        );
        res.json(medicamentosAsignados.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   POST api/visitas/:id/medicamentos
// @desc    Asignar un medicamento a una visita antes tenia adminAuth ahora generalViewAuth
router.post('/visitas/:id/medicamentos', generalViewAuth, async (req, res) => {
    const { id: id_visita } = req.params;
    const { id_medicamento, cantidad, tiempo_aplicacion } = req.body;

    if (!id_medicamento || !cantidad || !tiempo_aplicacion) {
        return res.status(400).json({ msg: 'Todos los campos son requeridos para la prescripción.' });
    }

    try {
        const newAsignacion = await db.query(
            `INSERT INTO medicamento_visita (id_visita, id_medicamento, cantidad, tiempo_aplicacion, estado) 
             VALUES ($1, $2, $3, $4, 'pendiente') RETURNING *`,
            [id_visita, id_medicamento, cantidad, tiempo_aplicacion]
        );
        res.status(201).json(newAsignacion.rows[0]);
    } catch (err) {
        console.error(err.message);
        // Manejar error de llave duplicada (si el médico intenta añadir el mismo medicamento dos veces)
        if (err.code === '23505') {
            return res.status(400).json({ msg: 'Este medicamento ya ha sido recetado en esta visita.' });
        }
        res.status(500).send('Error en el Servidor');
    }
});

// @route   DELETE api/visitas/:id/medicamentos/:id_medicamento
// @desc    Quitar un medicamento de una visita
router.delete('/visitas/:id/medicamentos/:id_medicamento', adminAuth, async (req, res) => {
    const { id: id_visita, id_medicamento } = req.params;
    try {
        await db.query(
            "DELETE FROM medicamento_visita WHERE id_visita = $1 AND id_medicamento = $2",
            [id_visita, id_medicamento]
        );
        res.json({ msg: 'Medicamento eliminado de la receta' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;