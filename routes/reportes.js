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

// @desc    Reporte de pagos a la fundación (cargos ya pagados)
router.get('/pagos-fundacion', foundationAuth, async (req, res) => {
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ msg: 'Fechas de inicio y fin son requeridas' });
    }

    try {
        // ✅ CORREGIDO: Buscar cargos con estado_pago = 'Pagado'
        const query = `
            SELECT 
                mf.fecha,
                mf.tipo,
                mf.descripcion,
                mf.monto,
                mf.monto_original,
                mf.descuento_aplicado,
                f.nombre AS nombre_familiar,
                f.telefono AS telefono_familiar
            FROM Movimiento_Financiero mf
            JOIN Familiar f ON mf.id_familiar = f.id_familiar
            WHERE (mf.fecha AT TIME ZONE 'America/Guatemala')::date >= $1::date
              AND (mf.fecha AT TIME ZONE 'America/Guatemala')::date <= $2::date
              AND mf.estado_pago = 'Pagado'
              AND (mf.tipo LIKE 'Cargo%' OR mf.tipo = 'Cuota Mensual')
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

// @desc    Reporte de exámenes médicos por paciente
router.get('/examenes/:id_paciente', foundationAuth, async (req, res) => {
    const { id_paciente } = req.params;
    const { fechaInicio, fechaFin } = req.query;

   

    if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ msg: 'Fechas de inicio y fin son requeridas' });
    }

    try {
        const pacienteQuery = `
            SELECT nombre, fecha_nacimiento 
            FROM Paciente 
            WHERE id_paciente = $1
        `;
        const pacienteRes = await db.query(pacienteQuery, [id_paciente]);
        
        if (pacienteRes.rows.length === 0) {
            return res.status(404).json({ msg: 'Paciente no encontrado' });
        }

        const paciente = pacienteRes.rows[0];

        const examenesQuery = `
            SELECT 
                vm.fecha_visita,
                vm.fecha_visita::date as fecha_solo,
                e.nombre_examen,
                ev.resultado,
                m.nombre AS nombre_medico,
                vm.diagnostico,
                CASE 
                    WHEN vm.fecha_visita::date >= $2::date AND vm.fecha_visita::date <= $3::date 
                    THEN 'INCLUIDO' 
                    ELSE 'EXCLUIDO' 
                END as filtro_status
            FROM examen_visita ev
            INNER JOIN visita_medica vm ON ev.id_visita = vm.id_visita
            INNER JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            INNER JOIN examen e ON ev.id_examen = e.id_examen
            LEFT JOIN medico m ON s.id_medico_especialista = m.id_medico
            WHERE s.id_paciente = $1
            ORDER BY vm.fecha_visita DESC
        `;
        
        const examenesRes = await db.query(examenesQuery, [id_paciente, fechaInicio, fechaFin]);
        const examenes = examenesRes.rows.filter(row => row.filtro_status === 'INCLUIDO');

        res.json({
            paciente,
            examenes,
            totalExamenes: examenes.length
        });

    } catch (err) {
        console.error('Error al generar reporte de exámenes:', err);
        res.status(500).json({ msg: 'Error al generar reporte', error: err.message });
    }
});

// @desc    Reporte de medicamentos aplicados por paciente
router.get('/medicamentos/:id_paciente', foundationAuth, async (req, res) => {
    const { id_paciente } = req.params;
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ msg: 'Fechas de inicio y fin son requeridas' });
    }

    try {
        // Obtener información del paciente
        const pacienteQuery = `
            SELECT nombre, fecha_nacimiento 
            FROM Paciente 
            WHERE id_paciente = $1
        `;
        const pacienteRes = await db.query(pacienteQuery, [id_paciente]);
        
        if (pacienteRes.rows.length === 0) {
            return res.status(404).json({ msg: 'Paciente no encontrado' });
        }

        const paciente = pacienteRes.rows[0];

        // ✅ CORREGIDO: Usar medicamento_visita con sus columnas reales
        const medicamentosQuery = `
            SELECT 
                mv.fecha_entrega,
                m.nombre_medicamento,
                m.tipo,
                mv.cantidad,
                mv.tiempo_aplicacion,
                mv.estado,
                vm.diagnostico,
                med.nombre AS nombre_medico
            FROM medicamento_visita mv
            INNER JOIN visita_medica vm ON mv.id_visita = vm.id_visita
            INNER JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            INNER JOIN medicamento m ON mv.id_medicamento = m.id_medicamento
            LEFT JOIN medico med ON s.id_medico_especialista = med.id_medico
            WHERE s.id_paciente = $1
              AND mv.fecha_entrega::date >= $2::date
              AND mv.fecha_entrega::date <= $3::date
            ORDER BY mv.fecha_entrega DESC
        `;
        
        const medicamentosRes = await db.query(medicamentosQuery, [id_paciente, fechaInicio, fechaFin]);
        const medicamentos = medicamentosRes.rows;

        res.json({
            paciente,
            medicamentos,
            totalAplicaciones: medicamentos.length
        });

    } catch (err) {
        console.error('Error al generar reporte de medicamentos:', err);
        res.status(500).json({ msg: 'Error al generar reporte', error: err.message });
    }
});

module.exports = router;