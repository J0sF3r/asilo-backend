// backend/routes/familiares.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, generalAuth } = require('../middleware/auth');

// @route   POST api/familiares
// @desc    Registrar un nuevo familiar
// @access  Private (Admin)
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
        // --- CAMBIO: Se añade "WHERE activo = TRUE"
        const familiares = await db.query('SELECT * FROM Familiar WHERE activo = TRUE ORDER BY nombre ASC');
        res.json(familiares.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   GET api/familiares/disponibles/:id_paciente
// @desc    Obtener familiares ACTIVOS que no están asignados a ESTE paciente
// --- ESTA ES LA RUTA QUE FALTABA ---
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

// @desc    Obtener el estado de cuenta completo de un familiar
router.get('/:id/estado-de-cuenta', adminAuth, async (req, res) => {
    const { id: id_familiar } = req.params;
    try {
        // Esta consulta unifica todos los cargos y pagos de un familiar específico
        const query = `
            -- 1. Cargos por Consultas
            SELECT 
                vm.fecha_visita AS fecha, 
                'Cargo por Consulta' AS tipo, 
                'Consulta con ' || me.nombre || ' para ' || p.nombre AS descripcion,
                (vm.costo_final_con_descuento * -1) AS monto -- Se multiplica por -1 para representar una deuda
            FROM visita_medica vm
            JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            JOIN paciente p ON s.id_paciente = p.id_paciente
            JOIN paciente_familiar pf ON p.id_paciente = pf.id_paciente
            LEFT JOIN medico me ON s.id_medico_especialista = me.id_medico
            WHERE pf.id_familiar = $1 AND pf.es_contacto_principal = TRUE AND vm.costo_final_con_descuento > 0

            UNION ALL

            -- 2. Cargos por Exámenes
            SELECT ev.fecha_realizacion, 'Cargo por Examen', e.nombre_examen, (ev.costo_cobrado * -1)
            FROM examen_visita ev
            JOIN examen e ON ev.id_examen = e.id_examen
            JOIN visita_medica vm ON ev.id_visita = vm.id_visita
            JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            JOIN paciente p ON s.id_paciente = p.id_paciente
            JOIN paciente_familiar pf ON p.id_paciente = pf.id_paciente
            WHERE pf.id_familiar = $1 AND pf.es_contacto_principal = TRUE AND ev.costo_cobrado > 0

            UNION ALL

            -- 3. Cargos por Medicamentos de Visita
            SELECT mv.fecha_entrega, 'Cargo por Medicamento', m.nombre, (mv.costo_cobrado * -1)
            FROM medicamento_visita mv
            JOIN medicamento m ON mv.id_medicamento = m.id_medicamento
            JOIN visita_medica vm ON mv.id_visita = vm.id_visita
            JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            JOIN paciente p ON s.id_paciente = p.id_paciente
            JOIN paciente_familiar pf ON p.id_paciente = pf.id_paciente
            WHERE pf.id_familiar = $1 AND pf.es_contacto_principal = TRUE AND mv.costo_cobrado > 0

            UNION ALL

            -- 4. Pagos y Abonos registrados manualmente
            SELECT t.fecha, t.tipo, t.descripcion, t.monto
            FROM Transacciones t
            WHERE t.id_familiar = $1

            ORDER BY fecha DESC;
        `;

        const result = await db.query(query, [id_familiar]);
        const transacciones = result.rows;

        // Calculamos el balance final sumando todos los montos
        const balance = transacciones.reduce((sum, t) => sum + parseFloat(t.monto), 0);

        // Enviamos un objeto con el balance y la lista de transacciones
        res.json({
            balance: balance.toFixed(2),
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

/*
router.get('/', adminAuth, async (req, res) => {
    try {
        const medicos = await db.query("SELECT id_familiar, nombre FROM familiar ORDER BY nombre ASC");
        res.json(familiares.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Error en el Servidor');
    }
});
*/


module.exports = router;