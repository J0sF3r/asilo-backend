// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        return res.status(401).json({ msg: 'No hay token, autorización denegada' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token no es válido' });
    }
};

const adminAuth = (req, res, next) => {
    auth(req, res, () => {
        // Usamos el nombre del rol que viene de la base de datos
        if (req.user.nombre_rol === 'Administración') {
            next();
        } else {
            res.status(403).json({ msg: 'Acceso denegado. Se requiere rol de Administrador.' });
        }
    });
};
// Middleware para roles de Laboratorio
const labAuth = (req, res, next) => {
    auth(req, res, () => {
        // Permitimos el acceso si el rol es 'Administración' O 'Laboratorio'
        if (req.user.nombre_rol === 'Administración' || req.user.nombre_rol === 'Laboratorio') {
            next();
        } else {
            res.status(403).json({ msg: 'Acceso denegado. Se requiere rol autorizado.' });
        }
    });
};
// Middleware para roles de Farmacia
const farmaciaAuth = (req, res, next) => {
    auth(req, res, () => {
        if (req.user.nombre_rol === 'Administración' || req.user.nombre_rol === 'Farmacia') {
            next();
        } else {
            res.status(403).json({ msg: 'Acceso denegado. Se requiere rol de Farmacia o Administrador.' });
        }
    });
};
// Middleware para roles de Médico General 
const generalAuth = (req, res, next) => {
    auth(req, res, () => {
        if (req.user.nombre_rol === 'Administración' || req.user.nombre_rol === 'Medico General') {
            next();
        } else {
            res.status(403).json({ msg: 'Acceso denegado. Se requiere rol de Médico General.' });
        }
    });
};
// Middleware para roles de Fundación
const foundationAuth = (req, res, next) => {
    auth(req, res, () => {
        if (req.user.nombre_rol === 'Administración' || req.user.nombre_rol === 'Fundación') {
            next();
        } else {
            res.status(403).json({ msg: 'Acceso denegado. Se requiere rol de Fundación.' });
        }
    });
};
// Middleware para roles que pueden ver solicitudes (Administración, Médico General, Fundación)
const solicitudesViewAuth = (req, res, next) => {
    auth(req, res, () => {
        const allowedRoles = ['Administración', 'Medico General', 'Fundación', 'Medico Especialista'];
        if (allowedRoles.includes(req.user.nombre_rol)) {
            next();
        } else {
            res.status(403).json({ msg: 'Acceso denegado para ver solicitudes.' });
        }
    });
};
// Middleware para roles de Médico Especialista
const medicoAuth = (req, res, next) => {
    auth(req, res, () => {

        // Permitimos el acceso si el rol es 'Administración' O 'Medico Especialista'
        if (req.user.nombre_rol === 'Administración' || req.user.nombre_rol === 'Medico Especialista') {
            next();
        } else {
            res.status(403).json({ msg: 'Acceso denegado. Se requiere rol de Médico Especialista.' });
        }
    });
};
//permiso general
const generalViewAuth = (req, res, next) => {
    auth(req, res, () => {
        const allowedRoles = [
            'Administración', 
            'Medico General', 
            'Fundación', 
            'Medico Especialista'
            // Puedes añadir 'Laboratorio', 'Farmacia', etc., si también necesitan ver catálogos
        ];
        if (allowedRoles.includes(req.user.nombre_rol)) {
            next();
        } else {
            res.status(403).json({ msg: 'Acceso denegado para ver este recurso.' });
        }
    });
};

const diagnosticoAuth = (req, res, next) => {
    auth(req, res, () => {
        const allowedRoles = [
            'Administración', 
            'Medico General', 
            'Medico Especialista'
        ];
        if (allowedRoles.includes(req.user.nombre_rol)) {
            next(); // El usuario tiene uno de los roles permitidos
        } else {
            res.status(403).json({ msg: 'Acceso denegado. Se requiere rol de Administrador o Médico.' });
        }
    });
};

module.exports = { auth, adminAuth, labAuth, farmaciaAuth, 
    generalAuth, foundationAuth, solicitudesViewAuth, 
    medicoAuth, generalViewAuth, diagnosticoAuth };