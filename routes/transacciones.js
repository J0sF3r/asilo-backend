const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth,foundationAuth } = require('../middleware/auth');

// @route   GET api/transacciones
// @desc    Obtener el libro contable unificado
router.get('/', adminAuth, async (req, res) => {
    try {
        const query = `
            SELECT 
                mf.id_movimiento,
                mf.fecha,
                mf.tipo,
                mf.descripcion,
                mf.monto,
                mf.monto_original,
                mf.descuento_aplicado,
                mf.estado_pago,
                mf.id_familiar,
                mf.id_donante,
                f.nombre AS nombre_familiar,
                d.nombre AS nombre_donante
            FROM Movimiento_Financiero mf
            LEFT JOIN Familiar f ON mf.id_familiar = f.id_familiar
            LEFT JOIN Donantes d ON mf.id_donante = d.id_donante
            ORDER BY mf.fecha DESC, mf.id_movimiento DESC;
        `;
        const result = await db.query(query);
        
        // Calcular totales para KPIs
        const transacciones = result.rows;
        
        const pendienteCobro = transacciones
            .filter(t => t.tipo.startsWith('Cargo') && t.estado_pago === 'Pendiente')
            .reduce((sum, t) => sum + parseFloat(t.monto), 0);
        
        const ingresosDelMes = transacciones
            .filter(t => {
                const fecha = new Date(t.fecha);
                const ahora = new Date();
                return fecha.getMonth() === ahora.getMonth() 
                    && fecha.getFullYear() === ahora.getFullYear()
                    && (t.tipo.includes('Ingreso') || t.tipo.includes('Donación') || t.tipo === 'Pago');
            })
            .reduce((sum, t) => sum + parseFloat(t.monto), 0);
        
        const gastosDelMes = transacciones
            .filter(t => {
                const fecha = new Date(t.fecha);
                const ahora = new Date();
                return fecha.getMonth() === ahora.getMonth() 
                    && fecha.getFullYear() === ahora.getFullYear()
                    && t.tipo.includes('Gasto');
            })
            .reduce((sum, t) => sum + Math.abs(parseFloat(t.monto)), 0);
        
        const balance = ingresosDelMes - gastosDelMes;
        
        res.json({
            transacciones,
            kpis: {
                pendienteCobro: pendienteCobro.toFixed(2),
                ingresosDelMes: ingresosDelMes.toFixed(2),
                gastosDelMes: gastosDelMes.toFixed(2),
                balance: balance.toFixed(2)
            }
        });
    } catch (err) {
        console.error("Error al obtener transacciones:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});
// @route   POST api/transacciones
// @desc    Registrar cualquier movimiento manual (ingreso, gasto, pago de familiar)
router.post('/', adminAuth, async (req, res) => {
    const { tipo, descripcion, monto, id_familiar, id_donante } = req.body;

    if (!tipo || !monto || !descripcion) {
        return res.status(400).json({ msg: 'Tipo, descripción y monto son requeridos.' });
    }

    try {
        // Los gastos siempre se guardan como negativos, el resto como positivos
        const montoFinal = tipo.toLowerCase().includes('gasto') ? -Math.abs(monto) : Math.abs(monto);
        
        // La consulta ahora es más simple
        const nuevaTransaccion = await db.query(
            `INSERT INTO Movimiento_Financiero (fecha, tipo, descripcion, monto, id_familiar, id_donante)
             VALUES (NOW(), $1, $2, $3, $4, $5) RETURNING *`,
            [tipo, descripcion, montoFinal, id_familiar || null, id_donante || null]
        );
        res.status(201).json(nuevaTransaccion.rows[0]);
    } catch (err) {
        console.error("Error al registrar transacción:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});


// @route   PUT api/transacciones/:id/descuento
// @desc    Aplicar o modificar descuento a un movimiento
router.put('/:id/descuento', foundationAuth , async (req, res) => {
    const { id } = req.params;
    const { descuento_aplicado } = req.body;

    if (descuento_aplicado === undefined || descuento_aplicado < 0 || descuento_aplicado > 100) {
        return res.status(400).json({ msg: 'El descuento debe ser entre 0 y 100%.' });
    }

    try {
        // Obtener el movimiento actual
        const movimiento = await db.query(
            'SELECT * FROM Movimiento_Financiero WHERE id_movimiento = $1',
            [id]
        );

        if (movimiento.rowCount === 0) {
            return res.status(404).json({ msg: 'Movimiento no encontrado.' });
        }

        const mov = movimiento.rows[0];
        const montoOriginal = parseFloat(mov.monto_original || mov.monto);
        const nuevoMonto = montoOriginal - (montoOriginal * (descuento_aplicado / 100));

        // Actualizar el movimiento
        const actualizado = await db.query(
            `UPDATE Movimiento_Financiero 
             SET descuento_aplicado = $1, monto = $2
             WHERE id_movimiento = $3
             RETURNING *`,
            [descuento_aplicado, nuevoMonto.toFixed(2), id]
        );

        res.json(actualizado.rows[0]);
    } catch (err) {
        console.error("Error al aplicar descuento:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @route   PUT api/transacciones/:id/pagar
// @desc    Marcar un movimiento como pagado
router.put('/:id/pagar', adminAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const actualizado = await db.query(
            `UPDATE Movimiento_Financiero 
             SET estado_pago = 'Pagado'
             WHERE id_movimiento = $1
             RETURNING *`,
            [id]
        );

        if (actualizado.rowCount === 0) {
            return res.status(404).json({ msg: 'Movimiento no encontrado.' });
        }

        res.json(actualizado.rows[0]);
    } catch (err) {
        console.error("Error al marcar como pagado:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});
// La ruta POST /pago ya no es necesaria, fue unificada en la ruta POST / de arriba.

module.exports = router;