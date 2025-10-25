// backend/utils/emailService.js
const nodemailer = require('nodemailer');
const sgTransport = require('nodemailer-sendgrid-transport');

const transporter = nodemailer.createTransport(sgTransport({
    auth: {
        api_key: process.env.SENDGRID_API_KEY
    }
}));

const enviarCorreoNotificacion = async (destinatario, datos) => {
    const {
        nombrePaciente,
        nombreMedicoEspecialista,
        especialidadMedico,
        fechaVisita,
        lugar,
        motivoVisita,
        nombreMedicoGeneral,
        nombreEnfermero,
        telefonoEnfermero
    } = datos;

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: destinatario,
        subject: `Notificación de Cita Médica para ${nombrePaciente}`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
                <h2 style="color: #0056b3; border-bottom: 2px solid #0056b3; padding-bottom: 10px;">Notificación de Cita Programada</h2>
                <p>Estimado/a familiar,</p>
                <p>Le informamos que se ha programado una nueva cita médica para <strong>${nombrePaciente}</strong> como parte de su cuidado en el Asilo de Ancianos Cabeza de Algodón.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd; width: 40%;"><strong>Motivo de la Cita:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${motivoVisita || 'No especificado'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Referido por:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${nombreMedicoGeneral || 'N/A'}</td>
                    </tr>
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Médico Especialista:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${nombreMedicoEspecialista} (${especialidadMedico || 'Especialista'})</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Fecha y Hora:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${new Date(fechaVisita).toLocaleString('es-GT', { dateStyle: 'full', timeStyle: 'short' })}</td>
                    </tr>
                    <tr style="background-color: #f2f2f2;">
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Lugar:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${lugar}</td>
                    </tr>
                </table>

                <h3 style="color: #555; margin-top: 25px;">Acompañamiento</h3>
                <p>Para su tranquilidad, el paciente será acompañado por:</p>
                <p style="padding: 10px; border: 1px solid #ddd; background-color: #f2f2f2;">
                    <strong>Enfermero/a a Cargo:</strong> ${nombreEnfermero || 'Asignado por el asilo'}<br>
                    <strong>Contacto del Enfermero/a:</strong> ${telefonoEnfermero || 'No disponible'}
                </p>

                <p>Si tiene alguna pregunta, por favor comuníquese con la administración del asilo al teléfono <strong>(502) 1234-5678</strong>.</p>
                
                <p style="font-size: 0.9em; color: #777; margin-top: 30px; text-align: center;">
                    Este es un correo automático. Por favor, no responda a este mensaje.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error al enviar el correo de notificación:', error.toString());
    }
};

module.exports = { enviarCorreoNotificacion };