// backend/routes/users.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminAuth } = require('../middleware/auth');

router.get('/', adminAuth, async (req, res) => {
    try {
        const query = `
            SELECT
                u.id_usuario, -- ESTA LÍNEA ES LA MÁS IMPORTANTE
                u.username,
                u.email,
                u.estado,
                u.id_rol,
                u.id_medico,
                u.id_enfermero,
                u.id_familiar,
                u.nombre_completo,
                r.nombre_rol,
                COALESCE(m.nombre, en.nombre, f.nombre, u.nombre_completo) AS nombre_real
            FROM usuario u
            JOIN rol r ON u.id_rol = r.id_rol
            LEFT JOIN medico m ON u.id_medico = m.id_medico
            LEFT JOIN enfermero en ON u.id_enfermero = en.id_enfermero
            LEFT JOIN familiar f ON u.id_familiar = f.id_familiar
            ORDER BY u.id_usuario ASC;
        `;
        const users = await db.query(query);
        res.json(users.rows);
    } catch (err) {
        console.error("Error al obtener usuarios:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// En backend/routes/users.js

// @route   PUT /api/users/:id
// @desc    Actualizar un usuario existente
router.put('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const { username, nombre_completo, email, id_rol, id_medico, id_enfermero, id_familiar, estado } = req.body;

    // Nota: La actualización de contraseña se manejaría por separado por seguridad,
    // pero por ahora actualizaremos los datos del perfil.

    try {
        const updateUserQuery = `
            UPDATE usuario 
            SET 
                username = $1,
                nombre_completo = $2,
                email = $3,
                id_rol = $4,
                id_medico = $5,
                id_enfermero = $6,
                id_familiar = $7,
                estado = $8
            WHERE id_usuario = $9
            RETURNING *;
        `;
        const updatedUser = await db.query(updateUserQuery, [
            username, nombre_completo, email, id_rol, 
            id_medico || null, id_enfermero || null, id_familiar || null, 
            estado, id
        ]);

        if (updatedUser.rows.length === 0) {
            return res.status(404).json({ msg: 'Usuario no encontrado' });
        }

        res.json({ msg: 'Usuario actualizado exitosamente', user: updatedUser.rows[0] });

    } catch (err) {
        console.error("Error al actualizar usuario:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @desc    Eliminar (desactivar) un usuario
router.delete('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        // Hacemos un "soft delete" actualizando el estado
        const result = await db.query(
            "UPDATE usuario SET estado = 'inactivo' WHERE id_usuario = $1 RETURNING id_usuario", 
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ msg: 'Usuario no encontrado para desactivar.' });
        }
        
        res.json({ msg: 'Usuario desactivado exitosamente' });

    } catch (err) {
        console.error("Error al desactivar usuario:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});

// @desc    Obtener los datos completos de un usuario específico para editar
router.get('/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    try {
        // Esta consulta selecciona todos los campos necesarios para el formulario
        const user = await db.query("SELECT * FROM usuario WHERE id_usuario = $1", [id]);

        if (user.rows.length === 0) {
            return res.status(404).json({ msg: 'Usuario no encontrado' });
        }
        
        delete user.rows[0].password_hash;
        
        res.json(user.rows[0]);

    } catch (err) {
        console.error("Error al obtener el usuario:", err.message);
        res.status(500).send('Error en el Servidor');
    }
});
module.exports = router;