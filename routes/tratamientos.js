// En: backend/routes/tratamientos.js

const express = require('express');
const router = express.Router();
const db = require('../db');
const { diagnosticoAuth } = require('../middleware/auth'); // Usamos el mismo middleware

// @desc    Añadir un nuevo tratamiento fijo a una condición
router.post('/condicion/:id', diagnosticoAuth, async (req, res) => {
    const { id: id_condicion } = req.params;
    const { id_medicamento, nombre_medicamento, dosis, frecuencia, intervalo_dias } = req.body;

    try {
        // Si se proporciona id_medicamento, obtener el nombre desde la tabla Medicamento
        let nombreFinal = nombre_medicamento;
        if (id_medicamento) {
            const medicamento = await db.query(
                'SELECT nombre FROM Medicamento WHERE id_medicamento = $1',
                [id_medicamento]
            );
            if (medicamento.rowCount > 0) {
                nombreFinal = medicamento.rows[0].nombre;
            }
        }

        const nuevoTratamiento = await db.query(
            `INSERT INTO Tratamiento_Fijo 
                (id_condicion, id_medicamento, nombre_medicamento, dosis, frecuencia, intervalo_dias, activo, fecha_inicio)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW()) 
             RETURNING *`,
            [id_condicion, id_medicamento || null, nombreFinal, dosis, frecuencia, intervalo_dias || 28]
        );
        
        res.status(201).json(nuevoTratamiento.rows[0]);
    } catch (err) {
        console.error("Error al crear tratamiento fijo:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @desc    Actualizar un tratamiento fijo existente
router.put('/:id', diagnosticoAuth, async (req, res) => {
    const { id: id_tratamiento } = req.params;
    const { nombre_medicamento, dosis, frecuencia, fecha_inicio } = req.body;

    try {
        const tratamientoActualizado = await db.query(
            `UPDATE Tratamiento_Fijo 
             SET nombre_medicamento = $1, dosis = $2, frecuencia = $3, fecha_inicio = $4
             WHERE id_tratamiento = $5 RETURNING *`,
            [nombre_medicamento, dosis, frecuencia, fecha_inicio, id_tratamiento]
        );

        if (tratamientoActualizado.rowCount === 0) {
            return res.status(404).json({ msg: 'Tratamiento no encontrado' });
        }

        res.json(tratamientoActualizado.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});


// @route   DELETE api/tratamientos/:id
// @desc    Eliminar un tratamiento fijo
// @access  Private (Admin/Medicos)
router.delete('/:id', diagnosticoAuth, async (req, res) => {
    const { id: id_tratamiento } = req.params;

    try {
        const tratamientoEliminado = await db.query(
            'DELETE FROM Tratamiento_Fijo WHERE id_tratamiento = $1 RETURNING *',
            [id_tratamiento]
        );

        if (tratamientoEliminado.rowCount === 0) {
            return res.status(404).json({ msg: 'Tratamiento no encontrado' });
        }

        res.json({ msg: 'Tratamiento eliminado exitosamente' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;