// backend/utils/emailService.js
const nodemailer = require('nodemailer');
const sgTransport = require('nodemailer-sendgrid-transport');

const transporter = nodemailer.createTransport(sgTransport({
    auth: {
        api_key: process.env.SENDGRID_API_KEY
    }
}));

const enviarCorreoNotificacion = async (destinatario, nombrePaciente, nombreMedico, fechaVisita, lugar) => {
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: destinatario,
        subject: `Notificación de Cita Médica para ${nombrePaciente}`,
        html: `
            <div style="font-family: sans-serif; line-height: 1.6;">
                <h2 style="color: #333;">Notificación de Cita Programada</h2>
                <p>Hola,</p>
                <p>Te informamos que se ha programado una nueva cita médica para <strong>${nombrePaciente}</strong> en el Asilo de Ancianos Cabeza de Algodón.</p>
                <hr>
                <h3 style="color: #555;">Detalles de la Cita:</h3>
                <ul>
                    <li><strong>Médico Especialista Asignado:</strong> ${nombreMedico}</li>
                    <li><strong>Fecha y Hora:</strong> ${new Date(fechaVisita).toLocaleString('es-GT', { dateStyle: 'full', timeStyle: 'short' })}</li>
                    <li><strong>Lugar:</strong> ${lugar}</li>
                </ul>
                <hr>
                <p style="font-size: 0.9em; color: #777;">
                    Este es un correo automático. Por favor, no respondas a este mensaje.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Correo de notificación enviado exitosamente a:', destinatario);
    } catch (error) {
        console.error('Error al enviar el correo de notificación:', error.toString());
    }
};

module.exports = { enviarCorreoNotificacion };