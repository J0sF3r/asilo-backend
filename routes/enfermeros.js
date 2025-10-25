const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, solicitudesViewAuth } = require('../middleware/auth');

// @route   POST api/enfermeros
// Registrar un nuevo enfermero/a
router.post('/', adminAuth, async (req, res) => {
    const { nombre, telefono, email } = req.body;
    try {
        const newEnfermero = await db.query(
            `INSERT INTO Enfermero (nombre, telefono, email) 
             VALUES ($1, $2, $3) RETURNING *`,
            [nombre, telefono, email]
        );
        res.status(201).json(newEnfermero.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   GET api/enfermeros
// Obtener todos los enfermeros/as ACTIVOS
router.get('/', solicitudesViewAuth, async (req, res) => {
    try {
        const enfermeros = await db.query('SELECT * FROM Enfermero WHERE activo = TRUE ORDER BY nombre ASC');
        res.json(enfermeros.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   PUT api/enfermeros/:id
//Actualizar un enfermero/a
router.put('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const { nombre, telefono, email } = req.body;
    try {
        const updatedEnfermero = await db.query(
            `UPDATE Enfermero SET nombre = $1, telefono = $2, email = $3 
             WHERE id_enfermero = $4 RETURNING *`,
            [nombre, telefono, email, id]
        );
        if (updatedEnfermero.rowCount === 0) {
            return res.status(404).json({ msg: 'Enfermero/a no encontrado/a' });
        }
        res.json(updatedEnfermero.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   DELETE api/enfermeros/:id
// Desactivar un enfermero/a (Borrado Lógico)
router.delete('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const deactivatedEnfermero = await db.query(
            `UPDATE Enfermero SET activo = FALSE WHERE id_enfermero = $1 RETURNING *`,
            [id]
        );
        if (deactivatedEnfermero.rowCount === 0) {
            return res.status(404).json({ msg: 'Enfermero/a no encontrado/a' });
        }
        res.json({ msg: 'Enfermero/a desactivado/a exitosamente' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;