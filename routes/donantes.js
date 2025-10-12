const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth } = require('../middleware/auth');

// @route   GET api/donantes
// @desc    Obtener todos los donantes
router.get('/', adminAuth, async (req, res) => {
    try {
        const query = `
            SELECT 
                id_donante,
                nombre,
                tipo,
                contacto,
                email,
                telefono,
                pais,
                activo,
                fecha_registro,
                notas
            FROM donantes
            ORDER BY nombre;
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener donantes:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   POST api/donantes
// @desc    Crear nuevo donante
router.post('/', adminAuth, async (req, res) => {
    const { nombre, tipo, contacto, email, telefono, pais, notas } = req.body;

    if (!nombre || !tipo) {
        return res.status(400).json({ msg: 'Nombre y tipo son requeridos.' });
    }

    try {
        const nuevo = await db.query(
            `INSERT INTO donantes (nombre, tipo, contacto, email, telefono, pais, notas, activo, fecha_registro)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW())
             RETURNING *`,
            [nombre, tipo, contacto, email, telefono, pais, notas]
        );
        res.status(201).json(nuevo.rows[0]);
    } catch (err) {
        console.error("Error al crear donante:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   PUT api/donantes/:id
// @desc    Actualizar donante
router.put('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const { nombre, tipo, contacto, email, telefono, pais, notas } = req.body;

    try {
        const actualizado = await db.query(
            `UPDATE donantes 
             SET nombre = $1, tipo = $2, contacto = $3, email = $4, telefono = $5, pais = $6, notas = $7
             WHERE id_donante = $8
             RETURNING *`,
            [nombre, tipo, contacto, email, telefono, pais, notas, id]
        );

        if (actualizado.rowCount === 0) {
            return res.status(404).json({ msg: 'Donante no encontrado.' });
        }

        res.json(actualizado.rows[0]);
    } catch (err) {
        console.error("Error al actualizar donante:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   PUT api/donantes/:id/desactivar
// @desc    Desactivar donante
router.put('/:id/desactivar', adminAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const actualizado = await db.query(
            `UPDATE donantes 
             SET activo = FALSE
             WHERE id_donante = $1
             RETURNING *`,
            [id]
        );

        if (actualizado.rowCount === 0) {
            return res.status(404).json({ msg: 'Donante no encontrado.' });
        }

        res.json(actualizado.rows[0]);
    } catch (err) {
        console.error("Error al desactivar donante:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   PUT api/donantes/:id/activar
// @desc    Activar donante
router.put('/:id/activar', adminAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const actualizado = await db.query(
            `UPDATE donantes 
             SET activo = TRUE
             WHERE id_donante = $1
             RETURNING *`,
            [id]
        );

        if (actualizado.rowCount === 0) {
            return res.status(404).json({ msg: 'Donante no encontrado.' });
        }

        res.json(actualizado.rows[0]);
    } catch (err) {
        console.error("Error al activar donante:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   POST api/donantes/:id/donar
// @desc    Registrar una donación de un donante
router.post('/:id/donar', adminAuth, async (req, res) => {
    const { id: id_donante } = req.params;
    const { monto, descripcion } = req.body;

    if (!monto || parseFloat(monto) <= 0) {
        return res.status(400).json({ msg: 'El monto debe ser mayor a 0.' });
    }

    try {
        // Verificar que el donante existe
        const donante = await db.query(
            'SELECT nombre FROM donantes WHERE id_donante = $1',
            [id_donante]
        );

        if (donante.rowCount === 0) {
            return res.status(404).json({ msg: 'Donante no encontrado.' });
        }

        const nombreDonante = donante.rows[0].nombre;
        const descripcionFinal = descripcion || `Donación de ${nombreDonante}`;

        // Crear movimiento financiero
        const movimiento = await db.query(
            `INSERT INTO Movimiento_Financiero 
                (fecha, tipo, descripcion, monto, id_donante, estado_pago)
             VALUES (NOW(), 'Ingreso por Donación', $1, $2, $3, NULL)
             RETURNING *`,
            [descripcionFinal, parseFloat(monto), id_donante]
        );

        res.status(201).json(movimiento.rows[0]);
    } catch (err) {
        console.error("Error al registrar donación:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;