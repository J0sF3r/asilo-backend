// backend/index.js

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
console.log("--- VARIABLES DE ENTORNO DISPONIBLES ---", process.env);
const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/farmacia', require('./routes/farmacia'));
app.use('/api/pacientes', require('./routes/pacientes'));
app.use('/api/familiares', require('./routes/familiares'));
app.use('/api/medicos', require('./routes/medicos'));
app.use('/api/enfermeros', require('./routes/enfermeros'));
app.use('/api/solicitudes', require('./routes/solicitudes'));
app.use('/api/visitas', require('./routes/visitas'));
app.use('/api/examenes', require('./routes/examenes'));
app.use('/api/laboratorio', require('./routes/laboratorio'));
app.use('/api/medicamentos', require('./routes/medicamentos'));
app.use('/api', require('./routes/examenVisita'));
app.use('/api', require('./routes/medicamentoVisita'));
app.use('/api/tratamientos', require('./routes/tratamientos'));
app.use('/api/condiciones', require('./routes/condiciones'));
app.use('/api/cobros-medicamentos', require('./routes/cobros'));
app.use('/api/examenes-visita', require('./routes/examenVisita'));
app.use('/api/transacciones', require('./routes/transacciones.js'));
app.use('/api/cuotas', require('./routes/cuotas'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));