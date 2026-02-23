/**
 * Routes Quiz (Jours 8 à 14)
 * Préfixe : /api/v1/quizzes
 * Toutes les routes nécessitent auth + rôle créateur (ou admin).
 * Chaque route est commentée avec sa méthode, son chemin et son rôle.
 */

const express = require('express');
const quizController = require('../controllers/quizController');
const uploadController = require('../controllers/uploadController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireCreator } = require('../middleware/roleMiddleware');

const router = express.Router();

// Protection globale : toutes les routes ci-dessous exigent un JWT valide et le rôle creator ou admin
router.use(authMiddleware);
router.use(requireCreator);

// Upload média (image ou vidéo) – doit être avant les routes :id
router.post('/upload-media', (req, res, next) => {
  uploadController.upload.single('media')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Erreur upload' });
    next();
  });
}, uploadController.uploadMedia);

// Liste des quiz du créateur connecté (ou tous pour admin) avec nombre de questions
router.get('/', quizController.list);

// Création d'un nouveau quiz (titre, description, state, ranking_enabled)
router.post('/', quizController.create);

// Session active du quiz (code d'accès, started_at) si le quiz est actif
router.get('/:id/session', quizController.getSession);
// Liste des sessions du quiz (triées par numéro ordre croissant)
router.get('/:id/sessions', quizController.listSessions);
// Supprimer une session (interdit si actif ou ouvert)
router.delete('/:id/sessions/:sessionId', quizController.deleteSession);
// Supprimer toutes les sessions du quiz (interdit si actif ou ouvert)
router.delete('/:id/sessions', quizController.deleteAllSessions);
// Statistiques d'une session spécifique
router.get('/:id/sessions/:sessionId/stats', quizController.getSessionStats);
// Statistiques du quiz (taux de participation, bonnes/mauvaises réponses en %)
router.get('/:id/stats', quizController.getStats);
// Suivi temps réel (question courante, réponses, timer) pour le créateur
router.get('/:id/live', quizController.getLiveState);
// Détail d'un quiz avec toutes ses questions (ordre position)
router.get('/:id', quizController.getById);

// Mise à jour du quiz (titre, description, state, ranking, bonus rapidité) – interdit si actif
router.put('/:id', quizController.update);

// Suppression du quiz (et cascade questions, sessions, etc.) – interdit si actif
router.delete('/:id', quizController.remove);

// Lancement : Prêt/Brouillon/Terminé → Actif, création session + code ; relance uniquement depuis Terminé
router.post('/:id/start', quizController.start);
// Fin manuelle : Actif → Terminé (session et quiz)
router.post('/:id/end', quizController.endQuiz);
// Ouvrir : affiche code + QR, participants peuvent rejoindre (quiz reste en attente)
router.post('/:id/open', quizController.openQuiz);
// Lancer : démarre le quiz (première question + timer) après Ouvert
router.post('/:id/launch', quizController.launchQuiz);
// Passer à la question suivante (manuel, côté créateur)
router.post('/:id/next-question', quizController.nextQuestion);

// Ajout d'une question (type, énoncé, options, correct_answer, points, time_limit_seconds) – max 30 questions
router.post('/:id/questions', quizController.addQuestion);

// Modification d'une question existante (mêmes champs que l'ajout)
router.put('/:id/questions/:qid', quizController.updateQuestion);

// Suppression d'une question – interdit si quiz actif
router.delete('/:id/questions/:qid', quizController.deleteQuestion);

module.exports = router;
