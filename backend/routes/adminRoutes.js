/**
 * Routes Admin : réservées aux comptes avec rôle admin.
 * Préfixe : /api/v1/admin
 */

const express = require('express');
const adminController = require('../controllers/adminController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/users', adminController.listUsers);
router.post('/users', adminController.createCreator);
router.patch('/users/:id/deactivate', adminController.deactivateCreator);
router.patch('/users/:id/activate', adminController.activateCreator);
router.patch('/users/:id/promote', adminController.promoteCreator);
router.patch('/users/:id/demote', adminController.demoteAdmin);

router.get('/stats', adminController.getGlobalStats);
router.get('/quizzes', adminController.listAllQuizzes);
router.delete('/quizzes/:id', adminController.deleteQuiz);

module.exports = router;
