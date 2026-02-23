/**
 * Service d'envoi d'emails (Nodemailer + SMTP).
 * Utilise les variables SMTP_* du .env.
 * Chaque fonction et bloc est commenté pour expliquer son rôle.
 */

// Bibliothèque d'envoi d'emails (SMTP, etc.)
const nodemailer = require('nodemailer');

/**
 * Crée et retourne un transport Nodemailer configuré depuis .env
 * @returns {object} Transport Nodemailer
 */
function getTransporter() {
  // Lecture de la configuration SMTP depuis les variables d'environnement
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;  // 587 = TLS par défaut
  const secure = process.env.SMTP_SECURE === 'true';        // true pour port 465
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  // Vérification des paramètres obligatoires avant de créer le transport
  if (!host || !user || !pass) {
    throw new Error('SMTP non configuré : SMTP_HOST, SMTP_USER, SMTP_PASS requis dans .env');
  }
  // Création du transport (connexion au serveur SMTP)
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * Envoie l'email de vérification avec le lien vers la page de confirmation.
 * Appelé après inscription (pending_registrations) pour que l'utilisateur confirme son email.
 * @param {string} toEmail - Adresse du destinataire
 * @param {string} confirmUrl - URL complète vers /confirm-email?token=xxx
 */
async function sendVerificationEmail(toEmail, confirmUrl) {
  const transporter = getTransporter();
  // Adresse expéditeur : SMTP_FROM si définie, sinon l'email SMTP_USER
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from: from,
    to: toEmail,
    subject: 'Vérification de votre compte – Quiz',
    // Version texte brut (clients mail sans HTML)
    text: `Bonjour,\n\nPour confirmer votre inscription, cliquez sur le lien ci-dessous (valide 24 h) :\n\n${confirmUrl}\n\nSi vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email ou annuler depuis la page.\n\nCordialement.`,
    // Version HTML (affichage enrichi)
    html: `
      <p>Bonjour,</p>
      <p>Pour confirmer votre inscription, cliquez sur le lien ci-dessous (valide 24 h) :</p>
      <p><a href="${confirmUrl}">${confirmUrl}</a></p>
      <p>Si vous n'êtes pas à l'origine de cette inscription, vous pouvez ignorer cet email ou annuler depuis la page.</p>
      <p>Cordialement.</p>
    `,
  });
}

module.exports = { sendVerificationEmail };
