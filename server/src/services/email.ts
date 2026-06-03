import nodemailer from 'nodemailer';

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT ?? 587),
    secure: Number(SMTP_PORT ?? 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendRejectionEmail(to: string, participantName: string): Promise<void> {
  const subject = 'Tu porra del Mundial 2026 ha sido rechazada';
  const text = `Hola ${participantName},\n\nLamentamos informarte de que tu porra "${participantName}" ha sido rechazada por el administrador.\n\nPuedes volver a la web y enviar una nueva porra antes del cierre.\n\nUn saludo,\nLa organización de La Porra del Chat`;

  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`[EMAIL] SMTP no configurado. Email de rechazo para ${to}:\n${text}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject,
    text,
  });
}
