const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth, foundationAuth } = require('../middleware/auth');

// @route   GET api/cuotas
// Obtener todas las configuraciones de cuotas
router.get('/', foundationAuth, async (req, res) => {
    try {
        const query = `
            SELECT 
                cc.id_cuota,
                cc.id_familiar,
                cc.monto,
                cc.fecha_inicio,
                cc.activo,
                cc.descripcion,
                f.nombre AS nombre_familiar,
                f.email
            FROM configuracion_cuota cc
            JOIN Familiar f ON cc.id_familiar = f.id_familiar
            ORDER BY f.nombre;
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error("Error al obtener configuraciones de cuotas:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   POST api/cuotas
// Crear o actualizar configuración de cuota para un familiar
router.post('/', adminAuth, async (req, res) => {
    const { id_familiar, monto, descripcion } = req.body;

    if (!id_familiar || !monto) {
        return res.status(400).json({ msg: 'Familiar y monto son requeridos.' });
    }

    try {
        // Verificar si existe una configuración activa para este familiar
        const existe = await db.query(
            'SELECT * FROM configuracion_cuota WHERE id_familiar = $1 AND activo = TRUE',
            [id_familiar]
        );

        if (existe.rowCount > 0) {
            // Actualiza existente
            const actualizado = await db.query(
                `UPDATE configuracion_cuota 
                 SET monto = $1, descripcion = $2
                 WHERE id_familiar = $3 AND activo = TRUE
                 RETURNING *`,
                [monto, descripcion, id_familiar]
            );
            res.json(actualizado.rows[0]);
        } else {
            // Crear nuevo
            const nuevo = await db.query(
                `INSERT INTO configuracion_cuota (id_familiar, monto, descripcion, fecha_inicio, activo)
                 VALUES ($1, $2, $3, NOW(), TRUE)
                 RETURNING *`,
                [id_familiar, monto, descripcion]
            );
            res.status(201).json(nuevo.rows[0]);
        }
    } catch (err) {
        console.error("Error al configurar cuota:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   PUT api/cuotas/:id/desactivar
//Desactivar configuración de cuota
router.put('/:id/desactivar', adminAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const actualizado = await db.query(
            `UPDATE configuracion_cuota 
             SET activo = FALSE
             WHERE id_cuota = $1
             RETURNING *`,
            [id]
        );

        if (actualizado.rowCount === 0) {
            return res.status(404).json({ msg: 'Configuración no encontrada.' });
        }

        res.json(actualizado.rows[0]);
    } catch (err) {
        console.error("Error al desactivar cuota:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   POST api/cuotas/generar-mes
// Generar cuotas del mes para todos los familiares activos
router.post('/generar-mes', adminAuth, async (req, res) => {
    const { mes, año } = req.body; 

    if (!mes || !año) {
        return res.status(400).json({ msg: 'Mes y año son requeridos.' });
    }

    try {
        // Obtengo todas las configuraciones activas
        const configuraciones = await db.query(
            'SELECT * FROM configuracion_cuota WHERE activo = TRUE'
        );

        if (configuraciones.rowCount === 0) {
            return res.status(404).json({ msg: 'No hay configuraciones de cuotas activas.' });
        }

        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const nombreMes = meses[mes - 1];

        let generadas = 0;
        let yaExistentes = 0;

        for (const config of configuraciones.rows) {
            // Verificar si ya existe una cuota para este familiar en este
            const existe = await db.query(
                `SELECT * FROM Movimiento_Financiero 
                 WHERE id_familiar = $1 
                   AND tipo = 'Cuota Mensual'
                   AND descripcion LIKE $2`,
                [config.id_familiar, `%${nombreMes} ${año}%`]
            );

            if (existe.rowCount === 0) {
                // Crear el movimiento financiero
                await db.query(
                    `INSERT INTO Movimiento_Financiero 
                        (fecha, tipo, descripcion, monto, id_familiar, estado_pago, monto_original, descuento_aplicado)
                     VALUES (NOW(), 'Cuota Mensual', $1, $2, $3, 'Pendiente', $2, 0)`,
                    [`Cuota Mensual - ${nombreMes} ${año}`, config.monto, config.id_familiar]
                );
                generadas++;
            } else {
                yaExistentes++;
            }
        }

        res.json({
            msg: `Cuotas generadas exitosamente.`,
            generadas,
            yaExistentes,
            total: configuraciones.rowCount
        });
    } catch (err) {
        console.error("Error al generar cuotas del mes:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

module.exports = router;