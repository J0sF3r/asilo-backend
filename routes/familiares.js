// backend/routes/familiares.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, generalAuth } = require('../middleware/auth');

// @route   POST api/familiares
//Registrar un nuevo familiar
router.post('/', adminAuth, async (req, res) => {
    const { nombre, parentesco, telefono, email } = req.body;
    try {
        const newFamiliar = await db.query(
            `INSERT INTO Familiar (nombre, parentesco, telefono, email) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [nombre, parentesco, telefono, email]
        );
        res.status(201).json(newFamiliar.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

//obtener todos los familiares
router.get('/', adminAuth, async (req, res) => {
    try {
        const familiares = await db.query('SELECT * FROM Familiar WHERE activo = TRUE ORDER BY nombre ASC');
        res.json(familiares.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   GET api/familiares/disponibles/:id_paciente
//Obtener familiares ACTIVOS que no están asignados a ESTE paciente
router.get('/disponibles/:id_paciente', adminAuth, async (req, res) => {
    try {
        const { id_paciente } = req.params;
        const disponibles = await db.query(
            `SELECT * FROM Familiar 
             WHERE activo = TRUE AND id_familiar NOT IN 
             (SELECT id_familiar FROM Paciente_Familiar WHERE id_paciente = $1)`,
            [id_paciente]
        );
        res.json(disponibles.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   GET api/familiares/:id/estado-de-cuenta
//Obtener el estado de cuenta completo de un familiar
router.get('/:id/estado-de-cuenta', adminAuth, async (req, res) => {
    const { id: id_familiar } = req.params;
    try {
        const query = `
            SELECT 
                id_movimiento,
                fecha,
                tipo,
                descripcion,
                monto,
                monto_original,
                descuento_aplicado,
                estado_pago
            FROM Movimiento_Financiero
            WHERE id_familiar = $1
            ORDER BY fecha DESC;
        `;

        const result = await db.query(query, [id_familiar]);
        const transacciones = result.rows;

        const cargos = transacciones.filter(t => t.tipo.startsWith('Cargo') || t.tipo === 'Cuota Mensual');
        
        const totalCargos = cargos.reduce((sum, t) => {
            return sum + parseFloat(t.monto_original || t.monto);
        }, 0);

        const totalDescuentos = cargos
            .filter(t => t.descuento_aplicado)
            .reduce((sum, t) => {
                const original = parseFloat(t.monto_original || t.monto);
                const descuento = parseFloat(t.descuento_aplicado || 0);
                return sum + (original * (descuento / 100));
            }, 0);


        const balance = transacciones
            .filter(t => {
                return (t.tipo.startsWith('Cargo') || t.tipo === 'Cuota Mensual') && 
                       t.estado_pago === 'Pendiente';
            })
            .reduce((sum, t) => sum + parseFloat(t.monto), 0);

        res.json({
            balance: balance.toFixed(2),
            totalCargos: totalCargos.toFixed(2),
            totalDescuentos: totalDescuentos.toFixed(2),
            transacciones: transacciones
        });

    } catch (err) {
        console.error("Error al obtener el estado de cuenta:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

//actualizar familiar
router.put('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const { nombre, parentesco, telefono, email } = req.body;
    try {
        const updatedFamiliar = await db.query(
            `UPDATE Familiar SET nombre = $1, parentesco = $2, telefono = $3, email = $4 
             WHERE id_familiar = $5 RETURNING *`,
            [nombre, parentesco, telefono, email, id]
        );
        if (updatedFamiliar.rowCount === 0) {
            return res.status(404).json({ msg: 'Familiar no encontrado' });
        }
        res.json(updatedFamiliar.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

//desactivar familiar
router.delete('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const deactivatedFamiliar = await db.query(
            `UPDATE Familiar SET activo = FALSE WHERE id_familiar = $1 RETURNING *`,
            [id]
        );
        if (deactivatedFamiliar.rowCount === 0) {
            return res.status(404).json({ msg: 'Familiar no encontrado' });
        }
        res.json({ msg: 'Familiar desactivado exitosamente' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;