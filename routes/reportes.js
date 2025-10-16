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
        // ✅ SOLUCIÓN DEFINITIVA: Convertir fechas a timestamp con zona horaria de Guatemala
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
              AND (mf.fecha AT TIME ZONE 'America/Guatemala')::date >= $2::date
              AND (mf.fecha AT TIME ZONE 'America/Guatemala')::date <= $3::date
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

// @desc    Reporte de pagos a la fundación (SOLO PAGOS de familiares)
router.get('/pagos-fundacion', foundationAuth, async (req, res) => {
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ msg: 'Fechas de inicio y fin son requeridas' });
    }

    try {
        // ✅ SOLO tipo = 'Pago' (cuando familiares pagan sus deudas)
        const query = `
            SELECT 
                mf.fecha,
                mf.descripcion,
                mf.monto,
                f.nombre AS nombre_familiar,
                f.telefono AS telefono_familiar
            FROM Movimiento_Financiero mf
            JOIN Familiar f ON mf.id_familiar = f.id_familiar
            WHERE (mf.fecha AT TIME ZONE 'America/Guatemala')::date >= $1::date
              AND (mf.fecha AT TIME ZONE 'America/Guatemala')::date <= $2::date
              AND mf.tipo = 'Pago'
            ORDER BY mf.fecha DESC
        `;
        
        const result = await db.query(query, [fechaInicio, fechaFin]);
        const pagos = result.rows;

        const totalPagos = pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0);

        res.json({
            pagos,
            totalPagos: totalPagos.toFixed(2),
            cantidadPagos: pagos.length
        });

    } catch (err) {
        console.error('Error al generar reporte de pagos:', err);
        res.status(500).json({ msg: 'Error al generar reporte', error: err.message });
    }
});

// @desc    Reporte de entradas (donaciones y cobros)
router.get('/entradas', foundationAuth, async (req, res) => {
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ msg: 'Fechas de inicio y fin son requeridas' });
    }

    try {
        const query = `
            SELECT 
                mf.fecha,
                mf.tipo,
                mf.descripcion,
                mf.monto,
                f.nombre AS nombre_familiar,
                d.nombre AS nombre_donante
            FROM Movimiento_Financiero mf
            LEFT JOIN Familiar f ON mf.id_familiar = f.id_familiar
            LEFT JOIN Donantes d ON mf.id_donante = d.id_donante
            WHERE (mf.fecha AT TIME ZONE 'America/Guatemala')::date >= $1::date
              AND (mf.fecha AT TIME ZONE 'America/Guatemala')::date <= $2::date
              AND (
                  mf.tipo LIKE '%Donación%' 
                  OR mf.tipo = 'Cuota Mensual' 
                  OR mf.tipo = 'Pago'
                  OR mf.tipo LIKE 'Ingreso%'
              )
            ORDER BY mf.fecha DESC
        `;
        
        const result = await db.query(query, [fechaInicio, fechaFin]);
        const transacciones = result.rows;

        // Calcular totales por categoría
        const totalDonaciones = transacciones
            .filter(t => t.tipo.includes('Donación'))
            .reduce((sum, t) => sum + parseFloat(t.monto), 0);

        const totalCobros = transacciones
            .filter(t => t.tipo === 'Cuota Mensual' || t.tipo === 'Pago')
            .reduce((sum, t) => sum + parseFloat(t.monto), 0);

        const totalOtrosIngresos = transacciones
            .filter(t => t.tipo.includes('Ingreso'))
            .reduce((sum, t) => sum + parseFloat(t.monto), 0);

        const totalGeneral = transacciones.reduce((sum, t) => sum + parseFloat(t.monto), 0);

        res.json({
            transacciones,
            totalDonaciones: totalDonaciones.toFixed(2),
            totalCobros: totalCobros.toFixed(2),
            totalOtrosIngresos: totalOtrosIngresos.toFixed(2),
            totalGeneral: totalGeneral.toFixed(2),
            cantidadTransacciones: transacciones.length
        });

    } catch (err) {
        console.error('Error al generar reporte de entradas:', err);
        res.status(500).json({ msg: 'Error al generar reporte', error: err.message });
    }
});
module.exports = router;