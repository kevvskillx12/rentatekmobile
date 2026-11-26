import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

// Si no hay SMTP configurado, los correos se omiten (y los enlaces importantes se imprimen en consola).
export const correoActivo = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporte = correoActivo
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    })
  : null;

const escapar = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function enviarCorreo(para, asunto, texto, enlace) {
  if (!transporte) return false;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1e293b">
      <h2 style="color:#172033">RENTA<span style="color:#f59e0b">TEK</span></h2>
      <p style="font-size:15px;line-height:1.5">${escapar(texto).replace(/\n/g, '<br>')}</p>
      ${enlace ? `<p><a href="${escapar(enlace)}" style="display:inline-block;padding:12px 20px;background:#f59e0b;color:#172033;border-radius:8px;text-decoration:none;font-weight:bold">Abrir Rentatek</a></p>` : ''}
      <p style="color:#94a3b8;font-size:12px">Recibes este correo porque tienes una cuenta en Rentatek.</p>
    </div>`;
  try {
    await transporte.sendMail({ from: SMTP_FROM || SMTP_USER, to: para, subject: asunto, text: texto + (enlace ? `\n\n${enlace}` : ''), html });
    return true;
  } catch (e) {
    console.error('No se pudo enviar el correo:', e.message);
    return false;
  }
}
