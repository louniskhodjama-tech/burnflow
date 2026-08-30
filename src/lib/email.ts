import "server-only";
import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
    });
  }
  return transporter;
}

/**
 * Envoie un email. Retourne false si SMTP non configuré ou en erreur —
 * l'appelant décide si c'est bloquant (jamais pour les notifications).
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    console.warn(`[email] SMTP non configuré — email non envoyé à ${opts.to} : ${opts.subject}`);
    return false;
  }
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM ?? "Triage brûlés <noreply@iqmed.io>",
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return true;
  } catch (err) {
    console.error("[email] échec d'envoi :", err);
    return false;
  }
}
