const express = require('express');
const router = express.Router();
const db = require('../db');
// Importamos medicoAuth ya que prescribir es una acción médica
const { adminAuth, generalViewAuth, medicoAuth } = require('../middleware/auth');

// @route   GET api/visitas/:id/medicamentos
// @desc    Obtener todos los medicamentos asignados a una visita
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
// @desc    Asignar un medicamento a una visita y generar el cobro
// --- ESTA ES LA RUTA MODIFICADA ---
router.post('/visitas/:id/medicamentos', medicoAuth, async (req, res) => {
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
        if (err.code === '23505') {
            return res.status(400).json({ msg: 'Este medicamento ya ha sido recetado en esta visita.' });
        }
        res.status(500).send('Error en el Servidor');
    }
});
// @route   DELETE api/visitas/:id/medicamentos/:id_medicamento
// @desc    Quitar un medicamento de una visita
router.delete('/visitas/:id/medicamentos/:id_medicamento', medicoAuth, async (req, res) => {
    const { id: id_visita, id_medicamento } = req.params;
    try {
        // También sería bueno verificar que el medicamento no haya sido ya entregado antes de borrar
        const result = await db.query(
            "DELETE FROM medicamento_visita WHERE id_visita = $1 AND id_medicamento = $2 AND estado = 'pendiente' RETURNING *",
            [id_visita, id_medicamento]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ msg: 'No se encontró el medicamento en esta receta o ya fue entregado.' });
        }

        res.json({ msg: 'Medicamento eliminado de la receta' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;