/**
 * Routes Participant (Jours 15–21)
 * Préfixe : /api/v1/participant
 * join = public ; state, respond, ranking = token participant (X-Participant-Token ou Bearer).
 * Chaque route est commentée pour expliquer son rôle.
 */

const express = require('express');
const participantController = require('../controllers/participantController');
const { participantAuth } = require('../middleware/participantAuth');

const router = express.Router();

// Rejoindre une session : code d'accès + pseudo → création participant + score 0, retourne session_token
router.post('/join', participantController.join);

// État courant : question affichée, timer (question_started_at, duration), ou finished si quiz terminé
router.get('/state', participantAuth, participantController.getState);
// Envoyer une réponse pour la question courante ; enregistrement + mise à jour score (bonus rapidité si activé)
router.post('/respond', participantAuth, participantController.respond);
// Classement de la session (tri par total_score DESC) – vide si ranking_enabled = false
router.get('/ranking', participantAuth, participantController.getRanking);

module.exports = router;
