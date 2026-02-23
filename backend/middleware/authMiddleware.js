/**
 * Middleware d'authentification JWT (Jour 4)
 * Vérifie la présence et la validité du token JWT dans la requête.
 * Attache l'utilisateur décodé à req.user pour les routes suivantes.
 */

const jwt = require('jsonwebtoken');

/**
 * Middleware : vérifie que la requête contient un JWT valide
 * @param {object} req - Requête Express
 * @param {object} res - Réponse Express
 * @param {function} next - Passe la main au middleware suivant si auth OK
 */
function authMiddleware(req, res, next) {
  // Récupère le header "Authorization" (format attendu : "Bearer <token>")
  const authHeader = req.headers.authorization;

  // Si pas de header ou pas au format Bearer, refuser l'accès
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant ou invalide' });
  }

  // Extrait le token après "Bearer " (7 caractères)
  const token = authHeader.slice(7);

  try {
    // Vérifie et décode le JWT avec le secret (stocké en .env)
    // jwt.verify lance une erreur si token expiré, falsifié ou invalide
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attache le payload décodé à la requête pour les contrôleurs (id, role, email)
    req.user = decoded;

    // Passe au middleware ou à la route suivante
    next();
  } catch (err) {
    // Token expiré (err.name === 'TokenExpiredError') ou invalide
    return res.status(401).json({ message: 'Token expiré ou invalide' });
  }
}

module.exports = { authMiddleware };
