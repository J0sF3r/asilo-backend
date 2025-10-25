// En: backend/routes/condiciones.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const { diagnosticoAuth } = require('../middleware/auth');

// @route   PUT api/condiciones/:id
//Actualizar una condición de base
router.put('/:id', diagnosticoAuth, async (req, res) => {
    const { id: id_condicion } = req.params;
    const { nombre_condicion, fecha_diagnostico, observaciones } = req.body;

    try {
        const condicionActualizada = await db.query(
            `UPDATE Condicion_Base
             SET nombre_condicion = $1, fecha_diagnostico = $2, observaciones = $3
             WHERE id_condicion = $4 RETURNING *`,
            [nombre_condicion, fecha_diagnostico, observaciones, id_condicion]
        );

        if (condicionActualizada.rowCount === 0) {
            return res.status(404).json({ msg: 'Condición no encontrada' });
        }

        res.json(condicionActualizada.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   DELETE api/condiciones/:id
// Eliminar una condición de base y sus tratamientos fijos asociados
router.delete('/:id', diagnosticoAuth, async (req, res) => {
    const { id: id_condicion } = req.params;

    try {
        // borra automáticamente los tratamientos fijos
        const condicionEliminada = await db.query(
            'DELETE FROM Condicion_Base WHERE id_condicion = $1 RETURNING *',
            [id_condicion]
        );

        if (condicionEliminada.rowCount === 0) {
            return res.status(404).json({ msg: 'Condición no encontrada' });
        }

        res.json({ msg: 'Condición y sus tratamientos asociados eliminados exitosamente' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;