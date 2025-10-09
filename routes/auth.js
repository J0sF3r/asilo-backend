// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// @desc    Autenticar usuario y obtener token (CÓDIGO RESTAURADO)
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userRes = await db.query(
            `SELECT u.*, r.nombre_rol 
             FROM usuario u
             JOIN rol r ON u.id_rol = r.id_rol
             WHERE u.username = $1`,
            [username]
        );

        if (userRes.rows.length === 0) {
            return res.status(400).json({ msg: 'Credenciales inválidas' });
        }

        const user = userRes.rows[0];


        const isMatch = await bcrypt.compare(password, user.password_hash);


        if (!isMatch) {
            return res.status(400).json({ msg: 'Credenciales inválidas' });
        }

        const payload = {
            user: {
                id: user.id_usuario,
                nombre_rol: user.nombre_rol
            }
        };
        if (user.id_medico) {
            payload.user.id_medico = user.id_medico;
        }

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '5h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, rol: user.nombre_rol });
            }
        );F
    } catch (err) {
        console.error("--- ERROR DETALLADO EN RUTA DE LOGIN ---");
        console.error(err); // Imprimimos el objeto de error completo
        console.error("--------------------------------------");
        res.status(500).send('Error en el Servidor');
    }
});

// En backend/routes/auth.js
router.post('/register', async (req, res) => {
    const {
        username,
        nombre_completo,
        email,
        password,
        id_rol,
        id_medico,
        id_enfermero,
        id_familiar
    } = req.body;

    if (!username || !password || !id_rol || !nombre_completo) {
        return res.status(400).json({ msg: 'Por favor, complete todos los campos requeridos.' });
    }

    try {
        const userExists = await db.query("SELECT * FROM usuario WHERE username = $1", [username]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ msg: 'El nombre de usuario ya está en uso.' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newUserQuery = `
            INSERT INTO usuario (username, nombre_completo, email, password_hash, id_rol, id_medico, id_enfermero, id_familiar, estado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activo')
            RETURNING id_usuario;
        `;

        await db.query(newUserQuery, [
            username,
            nombre_completo,
            email || null,
            password_hash,
            id_rol,
            id_medico || null,
            id_enfermero || null,
            id_familiar || null
        ]);

        res.status(201).json({ msg: 'Usuario registrado exitosamente' });

    } catch (err) {
        console.error("Error al registrar usuario:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});
module.exports = router;