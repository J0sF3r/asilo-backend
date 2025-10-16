const express = require('express');
const router = express.Router();
const db = require('../db');
const { foundationAuth } = require('../middleware/auth');

// @desc    Reporte de cobros por familiar
router.get('/cobros/:id_familiar', foundationAuth, async (req, res) => {
    const { id_familiar } = req.params;
    let { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ msg: 'Fechas de inicio y fin son requeridas' });
    }

    try {
        // ✅ SOLUCIÓN: Usar CAST para convertir a fecha sin hora
        const query = `
            SELECT 
                mf.fecha,
                mf.tipo,
                mf.descripcion,
                mf.monto,
                mf.monto_original,
                mf.descuento_aplicado,
                mf.estado_pago
            FROM Movimiento_Financiero mf
            WHERE mf.id_familiar = $1
              AND CAST(mf.fecha AS DATE) >= $2::date
              AND CAST(mf.fecha AS DATE) <= $3::date
              AND (mf.tipo LIKE 'Cargo%' OR mf.tipo = 'Cuota Mensual')
            ORDER BY mf.fecha DESC
        `;
        
        const result = await db.query(query, [id_familiar, fechaInicio, fechaFin]);
        const transacciones = result.rows;

        // Calcular totales
        const totalCargos = transacciones.reduce((sum, t) => 
            sum + parseFloat(t.monto_original || t.monto), 0
        );

        const totalDescuentos = transacciones
            .filter(t => t.descuento_aplicado)
            .reduce((sum, t) => {
                const original = parseFloat(t.monto_original || t.monto);
                const descuento = parseFloat(t.descuento_aplicado);
                return sum + (original * (descuento / 100));
            }, 0);

        const totalPagado = transacciones
            .filter(t => t.estado_pago === 'Pagado')
            .reduce((sum, t) => sum + parseFloat(t.monto), 0);

        const balancePendiente = transacciones
            .filter(t => t.estado_pago === 'Pendiente')
            .reduce((sum, t) => sum + parseFloat(t.monto), 0);

        res.json({
            transacciones,
            totalCargos: totalCargos.toFixed(2),
            totalDescuentos: totalDescuentos.toFixed(2),
            totalPagado: totalPagado.toFixed(2),
            balancePendiente: balancePendiente.toFixed(2)
        });

    } catch (err) {
        console.error('Error al generar reporte de cobros:', err);
        res.status(500).json({ msg: 'Error al generar reporte', error: err.message });
    }
});

module.exports = router;