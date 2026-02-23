/**
 * Contrôleur d'authentification (Jours 3 et 4)
 * Gère l'inscription, la vérification email et le login.
 * Chaque ligne est commentée pour expliquer le rôle du code.
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/db');
const { sendVerificationEmail } = require('../services/emailService');

// Nombre de "rounds" bcrypt : plus c'est élevé, plus le hash est sûr mais lent (10 = compromis sécurité/perf)
const SALT_ROUNDS = 10;

// Durée de validité du lien de vérification email (24 h en millisecondes)
const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/v1/auth/register
 * Flux : l'adresse du formulaire est stockée dans pending_registrations, puis un email
 * est envoyé depuis freespirit@alwaysdata.net (SMTP_FROM) vers cette adresse. Le compte
 * n'est créé qu'au clic "Oui" sur le lien. La ligne pending est supprimée si pas de
 * réponse sous 24 h ou si l'utilisateur clique "Non".
 */
async function register(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Format email invalide' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 8 caractères' });
    }

    const emailNorm = email.toLowerCase().trim();

    // Nettoyer les inscriptions en attente expirées (24 h sans clic sur le lien)
    await pool.query('DELETE FROM pending_registrations WHERE expires_at < NOW()', []);

    // Compte déjà existant
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [emailNorm]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Un compte existe déjà avec cet email' });
    }

    // Inscription déjà en attente : on remplace par une nouvelle demande (nouveau token)
    await pool.query('DELETE FROM pending_registrations WHERE email = $1', [emailNorm]);

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS);

    await pool.query(
      `INSERT INTO pending_registrations (email, password_hash, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [emailNorm, passwordHash, verificationToken, expiresAt]
    );

    const baseUrl = process.env.APP_URL || 'http://localhost:5173';
    const confirmUrl = `${baseUrl}/confirm-email?token=${verificationToken}`;

    const isMockEmail = process.env.MOCK_EMAIL === 'true' || process.env.MOCK_EMAIL === '1';
    if (isMockEmail) {
      console.log('[MOCK EMAIL] Lien de confirmation pour', emailNorm, ':', confirmUrl);
    } else {
      try {
        await sendVerificationEmail(emailNorm, confirmUrl);
      } catch (emailErr) {
        console.error('Envoi email échoué:', emailErr);
        await pool.query('DELETE FROM pending_registrations WHERE token = $1', [verificationToken]);
        return res.status(500).json({ message: 'Impossible d\'envoyer l\'email de vérification. Réessayez ou contactez le support.' });
      }
    }

    return res.status(201).json({
      message: isMockEmail
        ? 'Un email de confirmation vous a été envoyé (mode dev : consultez la console pour le lien).'
        : 'Un email de confirmation vous a été envoyé. Consultez votre boîte mail et cliquez sur le lien pour créer votre compte (valide 24 h).',
      confirmUrl: isMockEmail ? confirmUrl : undefined,
    });
  } catch (err) {
    console.error('Erreur register:', err);
    const message = process.env.NODE_ENV !== 'production'
      ? `Erreur serveur : ${err.message}. Vérifiez que PostgreSQL est démarré et que le script a créé la table pending_registrations.`
      : 'Erreur serveur lors de l\'inscription';
    return res.status(500).json({ message });
  }
}

/**
 * GET /api/v1/auth/confirm-email/status?token=xxx
 * Vérifie si le token est valide et non expiré (inscription en attente dans pending_registrations).
 */
async function confirmEmailStatus(req, res) {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ valid: false, message: 'Token manquant' });
    }
    const row = await pool.query(
      'SELECT id, expires_at FROM pending_registrations WHERE token = $1',
      [token]
    );
    if (row.rows.length === 0) {
      return res.status(200).json({ valid: false, message: 'Token invalide ou déjà utilisé' });
    }
    const r = row.rows[0];
    const expired = new Date(r.expires_at) < new Date();
    if (expired) {
      return res.status(200).json({ valid: false, expired: true, message: 'Lien expiré (24 h)' });
    }
    return res.status(200).json({ valid: true });
  } catch (err) {
    console.error('confirmEmailStatus:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/auth/confirm-email
 * Body: { token, action: 'confirm' | 'cancel' }
 * confirm = créer le compte dans users (verified=true) et supprimer la ligne pending.
 * cancel ou expiré = supprimer uniquement la ligne pending (aucun compte créé).
 */
async function confirmEmailAction(req, res) {
  try {
    const { token, action } = req.body;
    if (!token) {
      return res.status(400).json({ message: 'Token manquant' });
    }
    const pending = await pool.query(
      'SELECT id, email, password_hash, expires_at FROM pending_registrations WHERE token = $1',
      [token]
    );
    if (pending.rows.length === 0) {
      return res.status(400).json({ message: 'Token invalide ou déjà utilisé' });
    }
    const row = pending.rows[0];
    const expired = new Date(row.expires_at) < new Date();

    if (expired || action === 'cancel') {
      await pool.query('DELETE FROM pending_registrations WHERE id = $1', [row.id]);
      return res.status(200).json({
        success: true,
        cancelled: true,
        expired: expired,
        message: expired ? 'Lien expiré. Aucun compte créé.' : 'Inscription annulée. Aucun compte créé.',
      });
    }

    if (action === 'confirm') {
      await pool.query(
        `INSERT INTO users (email, password_hash, role, verified)
         VALUES ($1, $2, 'creator', true)`,
        [row.email, row.password_hash]
      );
      await pool.query('DELETE FROM pending_registrations WHERE id = $1', [row.id]);
      return res.status(200).json({
        success: true,
        message: 'Compte créé. Vous pouvez vous connecter.',
      });
    }

    return res.status(400).json({ message: 'Action invalide (confirm ou cancel)' });
  } catch (err) {
    console.error('confirmEmailAction:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/auth/verify-email?token=xxx
 * Ancienne vérification directe (conservée pour compatibilité).
 */
async function verifyEmail(req, res) {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ message: 'Token de vérification manquant' });
    }
    const tokenRow = await pool.query(
      `SELECT vt.id, vt.user_id, vt.expires_at FROM verification_tokens vt WHERE vt.token = $1`,
      [token]
    );
    if (tokenRow.rows.length === 0) {
      return res.status(400).json({ message: 'Token invalide ou déjà utilisé' });
    }
    const row = tokenRow.rows[0];
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ message: 'Le lien de vérification a expiré' });
    }
    await pool.query('UPDATE users SET verified = true WHERE id = $1', [row.user_id]);
    await pool.query('DELETE FROM verification_tokens WHERE id = $1', [row.id]);
    return res.status(200).json({ message: 'Email vérifié. Vous pouvez vous connecter.' });
  } catch (err) {
    console.error('Erreur verifyEmail:', err);
    return res.status(500).json({ message: 'Erreur serveur lors de la vérification' });
  }
}

/**
 * POST /api/v1/auth/login
 * Authentification : email + mot de passe → renvoie un JWT si identifiants valides et compte vérifié.
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }

    // Récupération du user par email (un seul résultat attendu grâce à UNIQUE)
    const userResult = await pool.query(
      'SELECT id, email, password_hash, role, verified, disabled FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (userResult.rows.length === 0) {
      // Ne pas révéler si l'email existe ou non (sécurité)
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }

    const user = userResult.rows[0];

    // Compte désactivé par un admin
    if (user.disabled) {
      return res.status(403).json({ message: 'Ce compte a été désactivé. Contactez l\'administrateur.' });
    }

    // Vérification que le compte a été activé via le lien email
    if (!user.verified) {
      return res.status(403).json({ message: 'Veuillez vérifier votre email avant de vous connecter' });
    }

    // Comparaison du mot de passe envoyé avec le hash stocké (bcrypt.compare est asynchrone)
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Identifiants incorrects' });
    }

    // Mise à jour de last_login (optionnel, pour statistiques)
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Génération du JWT : payload = données à transporter (id, email, role)
    // Ne jamais mettre de données sensibles dans le JWT (il est lisible en base64)
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    // Signature du token (JWT_EXPIRES_IN dans .env, ex: 24h ou 7d ; défaut 24h)
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Réponse : envoi du token au client (à stocker côté frontend et envoyer dans Authorization)
    return res.status(200).json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Erreur login:', err);
    return res.status(500).json({ message: 'Erreur serveur lors de la connexion' });
  }
}

/**
 * GET /api/v1/auth/me
 * Renvoie le profil de l'utilisateur connecté (nécessite authMiddleware).
 * Utile pour vérifier le token et afficher les infos utilisateur côté frontend.
 */
async function me(req, res) {
  try {
    // req.user est rempli par authMiddleware (payload du JWT décodé)
    const { id, email, role } = req.user;

    // Optionnel : recharger depuis la base pour avoir les infos à jour (verified, etc.)
    const userResult = await pool.query(
      'SELECT id, email, role, verified, disabled, created_at FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    return res.status(200).json({ user: userResult.rows[0] });
  } catch (err) {
    console.error('Erreur me:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = {
  register,
  verifyEmail,
  confirmEmailStatus,
  confirmEmailAction,
  login,
  me,
};
