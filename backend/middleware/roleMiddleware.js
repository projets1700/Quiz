/**
 * Middleware de contrôle des rôles (Jour 5)
 * À utiliser après authMiddleware : req.user doit déjà être défini.
 * Restreint l'accès aux routes selon le rôle (admin / creator).
 */

/**
 * Autorise uniquement les utilisateurs avec le rôle "admin"
 * @param {object} req - Requête Express (doit contenir req.user.role)
 * @param {object} res - Réponse Express
 * @param {function} next - Next middleware
 */
function requireAdmin(req, res, next) {
  // req.user est défini par authMiddleware (JWT décodé)
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
}

/**
 * Autorise uniquement les utilisateurs avec le rôle "creator" (ou admin si on souhaite que l'admin puisse tout faire)
 * @param {object} req
 * @param {object} res
 * @param {function} next
 */
function requireCreator(req, res, next) {
  if (req.user && (req.user.role === 'creator' || req.user.role === 'admin')) {
    return next();
  }
  return res.status(403).json({ message: 'Accès réservé aux créateurs' });
}

/**
 * Factory : retourne un middleware qui exige un des rôles passés en argument
 * Ex: requireRoles('admin', 'creator') => accès si admin OU creator
 * @param  {...string} roles - Liste des rôles autorisés
 */
function requireRoles(...roles) {
  return (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({ message: 'Rôle insuffisant' });
  };
}

module.exports = { requireAdmin, requireCreator, requireRoles };
