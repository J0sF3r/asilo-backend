// En: backend/routes/cobros.js

const express = require('express');
const router = express.Router();
const db = require('../db');
// Usaremos farmaciaAuth que, según tu configuración, permite a 'Farmacia' y 'Administración'
const { farmaciaAuth } = require('../middleware/auth');

// @route   POST api/cobros-medicamentos
// @desc    Registrar un nuevo cobro por un medicamento fijo dispensado
// @access  Private (Farmacia/Admin)
router.post('/', farmaciaAuth, async (req, res) => {
    const { 
        id_tratamiento_fijo, 
        cantidad_dispensada, 
        costo_total 
    } = req.body;

    // Obtenemos el ID del usuario que está registrando el cobro (el farmacéutico)
    const id_usuario_farmacia = req.user.id_usuario; 

    try {
        const nuevoCobro = await db.query(
            `INSERT INTO Cobro_Medicamento_Fijo 
                (id_tratamiento_fijo, fecha_cobro, cantidad_dispensada, costo_total, id_usuario_farmacia)
             VALUES ($1, CURRENT_DATE, $2, $3, $4) RETURNING *`,
            [id_tratamiento_fijo, cantidad_dispensada, costo_total, id_usuario_farmacia]
        );
        res.status(201).json(nuevoCobro.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;