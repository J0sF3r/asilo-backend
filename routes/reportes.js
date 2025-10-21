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
                m.nombre AS nombre_medicamento,
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

// @desc    Reporte de costos por visita del paciente
router.get('/costos-visitas/:id_paciente', foundationAuth, async (req, res) => {
    const { id_paciente } = req.params;
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
        return res.status(400).json({ msg: 'Fechas de inicio y fin son requeridas' });
    }

    try {
        // Obtener información del paciente y su familiar contacto principal
        const pacienteQuery = `
            SELECT 
                p.nombre, 
                p.fecha_nacimiento,
                pf.id_familiar
            FROM Paciente p
            LEFT JOIN paciente_familiar pf ON p.id_paciente = pf.id_paciente AND pf.es_contacto_principal = true
            WHERE p.id_paciente = $1
            LIMIT 1
        `;
        const pacienteRes = await db.query(pacienteQuery, [id_paciente]);
        
        if (pacienteRes.rows.length === 0) {
            return res.status(404).json({ msg: 'Paciente no encontrado' });
        }

        const paciente = pacienteRes.rows[0];

        // Verificar que tenga familiar asignado
        if (!paciente.id_familiar) {
            return res.status(404).json({ msg: 'Este paciente no tiene un familiar contacto principal asignado' });
        }

        // Obtener visitas médicas del paciente
        const visitasQuery = `
            SELECT 
                vm.id_visita,
                vm.fecha_visita,
                vm.diagnostico,
                m.nombre AS nombre_medico,
                s.id_solicitud
            FROM visita_medica vm
            INNER JOIN solicitud s ON vm.id_solicitud = s.id_solicitud
            LEFT JOIN medico m ON s.id_medico_especialista = m.id_medico
            WHERE s.id_paciente = $1
              AND vm.fecha_visita::date >= $2::date
              AND vm.fecha_visita::date <= $3::date
            ORDER BY vm.fecha_visita DESC
        `;
        
        const visitasRes = await db.query(visitasQuery, [id_paciente, fechaInicio, fechaFin]);
        const visitas = visitasRes.rows;

        // Para cada visita, obtener los costos desde Movimiento_Financiero
        for (let visita of visitas) {
            const fechaVisita = visita.fecha_visita;
            
            // 1. Costo de CONSULTA (buscar UN cargo consulta cercano a la hora de la visita)
            const consultaQuery = `
                SELECT mf.monto, mf.descripcion
                FROM Movimiento_Financiero mf
                WHERE mf.id_familiar = $1
                  AND mf.tipo = 'Cargo Consulta'
                  AND DATE(mf.fecha) = DATE($2::timestamp)
                ORDER BY ABS(EXTRACT(EPOCH FROM (mf.fecha - $2::timestamp)))
                LIMIT 1
            `;
            const consultaRes = await db.query(consultaQuery, [paciente.id_familiar, fechaVisita]);
            visita.costo_consulta = consultaRes.rows.length > 0 ? parseFloat(consultaRes.rows[0].monto || 0) : 0;
            visita.desc_consulta = consultaRes.rows.length > 0 ? consultaRes.rows[0].descripcion : 'Sin consulta registrada';

            // 2. Costos de EXÁMENES (solo los exámenes de ESTA visita)
            const examenesQuery = `
                SELECT DISTINCT
                    e.nombre_examen,
                    mf.monto AS costo
                FROM examen_visita ev
                INNER JOIN examen e ON ev.id_examen = e.id_examen
                LEFT JOIN Movimiento_Financiero mf ON 
                    mf.id_familiar = $1
                    AND mf.tipo = 'Cargo Examen'
                    AND mf.descripcion ILIKE '%' || e.nombre_examen || '%'
                    AND DATE(mf.fecha) = DATE($2::timestamp)
                WHERE ev.id_visita = $3
            `;
            const examenesRes = await db.query(examenesQuery, [paciente.id_familiar, fechaVisita, visita.id_visita]);
            visita.examenes = examenesRes.rows.map(ex => ({
                nombre_examen: ex.nombre_examen,
                costo: parseFloat(ex.costo || 0)
            }));
            visita.total_examenes = visita.examenes.reduce((sum, ex) => sum + ex.costo, 0);

            // 3. Costos de MEDICAMENTOS (solo los medicamentos de ESTA visita)
            const medicamentosQuery = `
                SELECT DISTINCT
                    m.nombre AS nombre_medicamento,
                    mf.monto AS costo
                FROM medicamento_visita mv
                INNER JOIN medicamento m ON mv.id_medicamento = m.id_medicamento
                LEFT JOIN Movimiento_Financiero mf ON 
                    mf.id_familiar = $1
                    AND (mf.tipo = 'Cargo Medicamento' OR mf.tipo = 'Cargo Medicamento Recurrente')
                    AND (mf.descripcion ILIKE '%' || m.nombre || '%')
                    AND DATE(mf.fecha) = DATE($2::timestamp)
                WHERE mv.id_visita = $3
            `;
            const medicamentosRes = await db.query(medicamentosQuery, [paciente.id_familiar, fechaVisita, visita.id_visita]);
            visita.medicamentos = medicamentosRes.rows.map(med => ({
                nombre_medicamento: med.nombre_medicamento,
                costo: parseFloat(med.costo || 0)
            }));
            visita.total_medicamentos = visita.medicamentos.reduce((sum, med) => sum + med.costo, 0);

            // Total por visita
            visita.total_visita = visita.costo_consulta + visita.total_examenes + visita.total_medicamentos;
        }

        // Calcular totales generales
        const totalConsultas = visitas.reduce((sum, v) => sum + v.costo_consulta, 0);
        const totalExamenes = visitas.reduce((sum, v) => sum + v.total_examenes, 0);
        const totalMedicamentos = visitas.reduce((sum, v) => sum + v.total_medicamentos, 0);
        const totalGeneral = visitas.reduce((sum, v) => sum + v.total_visita, 0);

        res.json({
            paciente,
            visitas,
            totalConsultas: totalConsultas.toFixed(2),
            totalExamenes: totalExamenes.toFixed(2),
            totalMedicamentos: totalMedicamentos.toFixed(2),
            totalGeneral: totalGeneral.toFixed(2),
            cantidadVisitas: visitas.length
        });

    } catch (err) {
        console.error('Error al generar reporte de costos:', err);
        res.status(500).json({ msg: 'Error al generar reporte', error: err.message });
    }
});
module.exports = router;