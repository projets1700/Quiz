/**
 * Routes d'authentification (Jours 3 à 6)
 * Préfixe attendu : /api/v1/auth
 * Chaque route est documentée pour le test API (Postman/Insomnia).
 */

// Framework web et contrôleur auth
const express = require('express');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

// Création du routeur Express pour grouper les routes sous /auth
const router = express.Router();

// Inscription : enregistrement en pending_registrations + envoi email (ou mock)
// POST /api/v1/auth/register – Body: { "email", "password" } – Réponse 201
router.post('/register', authController.register);

// Vérification email (ancienne méthode, table verification_tokens)
// GET /api/v1/auth/verify-email?token=xxx
router.get('/verify-email', authController.verifyEmail);

// Page de confirmation : vérifier si le token est valide avant d'afficher Oui/Non
// GET /api/v1/auth/confirm-email/status?token=xxx
router.get('/confirm-email/status', authController.confirmEmailStatus);
// Page de confirmation : confirmer (créer le compte) ou annuler
// POST /api/v1/auth/confirm-email – Body: { token, action: 'confirm' | 'cancel' }
router.post('/confirm-email', authController.confirmEmailAction);

// Connexion : email + mot de passe → JWT + infos user (403 si compte non vérifié)
// POST /api/v1/auth/login – Body: { "email", "password" } – Réponse 200 : { token, user }
router.post('/login', authController.login);

// Profil de l'utilisateur connecté (nécessite JWT dans Authorization: Bearer <token>)
// GET /api/v1/auth/me – Réponse 200 : { user }
router.get('/me', authMiddleware, authController.me);

// Export du routeur pour montage dans index.js (app.use('/api/v1/auth', authRoutes))
module.exports = router;
