/**
 * Contrôleur Admin : gestion des comptes créateurs, statistiques globales.
 * Droits : créer/désactiver comptes, promouvoir/rétrograder, stats globales, supprimer quiz non actif.
 */

const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

const SALT_ROUNDS = 10;
const MAX_ADMINS = 5;

/**
 * GET /api/v1/admin/users – Liste des créateurs et admins (admin uniquement)
 */
async function listUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.role, u.verified, u.disabled, u.created_at, u.last_login,
        (SELECT COUNT(*) FROM quizzes WHERE creator_id = u.id) AS quiz_count
       FROM users u ORDER BY u.role DESC, u.email ASC`
    );
    const admins = result.rows.filter((u) => u.role === 'admin');
    const creators = result.rows.filter((u) => u.role === 'creator');
    return res.status(200).json({
      admins,
      creators,
      adminCount: admins.length,
      creatorCount: creators.length,
    });
  } catch (err) {
    console.error('Erreur listUsers:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/admin/users – Créer un compte créateur (admin uniquement)
 * Body: { email, password }
 */
async function createCreator(req, res) {
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

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [emailNorm]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Un compte existe déjà avec cet email' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const insert = await pool.query(
      `INSERT INTO users (email, password_hash, role, verified, disabled)
       VALUES ($1, $2, 'creator', true, false)
       RETURNING id, email, role, verified, disabled, created_at`,
      [emailNorm, passwordHash]
    );
    return res.status(201).json({ user: insert.rows[0], message: 'Compte créateur créé' });
  } catch (err) {
    console.error('Erreur createCreator:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * PATCH /api/v1/admin/users/:id/deactivate – Désactiver un créateur
 */
async function deactivateCreator(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) return res.status(400).json({ message: 'ID invalide' });

    const user = await pool.query('SELECT id, role, disabled FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (user.rows[0].role === 'admin') {
      return res.status(403).json({ message: 'Impossible de désactiver un administrateur' });
    }
    if (user.rows[0].disabled) {
      return res.status(400).json({ message: 'Compte déjà désactivé' });
    }

    await pool.query('UPDATE users SET disabled = true WHERE id = $1', [userId]);
    return res.status(200).json({ message: 'Compte désactivé' });
  } catch (err) {
    console.error('Erreur deactivateCreator:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * PATCH /api/v1/admin/users/:id/activate – Réactiver un créateur
 */
async function activateCreator(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) return res.status(400).json({ message: 'ID invalide' });

    const user = await pool.query('SELECT id, role, disabled FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (user.rows[0].role === 'admin') {
      return res.status(403).json({ message: 'Impossible de modifier un administrateur' });
    }
    if (!user.rows[0].disabled) {
      return res.status(400).json({ message: 'Compte déjà actif' });
    }

    await pool.query('UPDATE users SET disabled = false WHERE id = $1', [userId]);
    return res.status(200).json({ message: 'Compte réactivé' });
  } catch (err) {
    console.error('Erreur activateCreator:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * PATCH /api/v1/admin/users/:id/promote – Promouvoir un créateur en admin (max 5 admins)
 */
async function promoteCreator(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) return res.status(400).json({ message: 'ID invalide' });

    const countAdmin = await pool.query("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
    if (parseInt(countAdmin.rows[0].c, 10) >= MAX_ADMINS) {
      return res.status(400).json({ message: `Nombre maximum d'administrateurs atteint (${MAX_ADMINS})` });
    }

    const user = await pool.query('SELECT id, role FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (user.rows[0].role === 'admin') {
      return res.status(400).json({ message: 'Utilisateur déjà administrateur' });
    }

    await pool.query(
      'UPDATE users SET role = \'admin\', disabled = false WHERE id = $1',
      [userId]
    );
    return res.status(200).json({ message: 'Créateur promu administrateur' });
  } catch (err) {
    console.error('Erreur promoteCreator:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * PATCH /api/v1/admin/users/:id/demote – Rétrograder un admin en créateur
 */
async function demoteAdmin(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    if (Number.isNaN(userId)) return res.status(400).json({ message: 'ID invalide' });

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous rétrograder vous-même' });
    }

    const user = await pool.query('SELECT id, role FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    if (user.rows[0].role !== 'admin') {
      return res.status(400).json({ message: 'Utilisateur n\'est pas administrateur' });
    }

    await pool.query('UPDATE users SET role = \'creator\' WHERE id = $1', [userId]);
    return res.status(200).json({ message: 'Administrateur rétrogradé en créateur' });
  } catch (err) {
    console.error('Erreur demoteAdmin:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/admin/stats – Statistiques globales (admin uniquement)
 */
async function getGlobalStats(req, res) {
  try {
    const [
      totalQuizzes,
      totalQuestions,
      totalSessions,
      totalParticipants,
      activeQuizzes,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS c FROM quizzes').then((r) => parseInt(r.rows[0].c, 10)),
      pool.query('SELECT COUNT(*) AS c FROM questions').then((r) => parseInt(r.rows[0].c, 10)),
      pool.query('SELECT COUNT(*) AS c FROM quiz_sessions').then((r) => parseInt(r.rows[0].c, 10)),
      pool.query('SELECT COUNT(*) AS c FROM participants').then((r) => parseInt(r.rows[0].c, 10)),
      pool.query(
        "SELECT COUNT(*) AS c FROM quizzes WHERE state IN ('actif', 'ouvert')"
      ).then((r) => parseInt(r.rows[0].c, 10)),
    ]);

    const creatorCount = await pool.query(
      "SELECT COUNT(*) AS c FROM users WHERE role = 'creator' AND (disabled IS NULL OR disabled = false)"
    ).then((r) => parseInt(r.rows[0].c, 10));

    const adminCount = await pool.query(
      "SELECT COUNT(*) AS c FROM users WHERE role = 'admin'"
    ).then((r) => parseInt(r.rows[0].c, 10));

    // Statistiques par quiz et par créateur (participation, bonnes/mauvaises réponses)
    const quizStatsResult = await pool.query(`
      SELECT q.id, q.title, q.state, q.creator_id,
        u.email AS creator_email,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
        (SELECT COUNT(*) FROM quiz_sessions WHERE quiz_id = q.id) AS session_count,
        (SELECT COUNT(*) FROM participants p
         INNER JOIN quiz_sessions qs ON qs.id = p.session_id AND qs.quiz_id = q.id) AS total_participants,
        (SELECT COUNT(DISTINCT r.participant_id)
         FROM responses r
         INNER JOIN questions qq ON qq.id = r.question_id AND qq.quiz_id = q.id
         INNER JOIN participants p ON p.id = r.participant_id
         INNER JOIN quiz_sessions qs ON qs.id = p.session_id AND qs.quiz_id = q.id) AS participants_with_response,
        (SELECT COUNT(*) FROM responses r
         INNER JOIN questions qq ON qq.id = r.question_id AND qq.quiz_id = q.id AND qq.type != 'ouverte'
         WHERE r.is_correct = true) AS correct_count,
        (SELECT COUNT(*) FROM responses r
         INNER JOIN questions qq ON qq.id = r.question_id AND qq.quiz_id = q.id AND qq.type != 'ouverte'
         WHERE r.is_correct = false) AS incorrect_count
      FROM quizzes q
      LEFT JOIN users u ON u.id = q.creator_id
      ORDER BY u.email, q.created_at DESC, q.id DESC
    `);

    const quizStats = quizStatsResult.rows.map((row) => {
      const totalParticipants = parseInt(row.total_participants || 0, 10);
      const participantsWithResponse = parseInt(row.participants_with_response || 0, 10);
      const correctCount = parseInt(row.correct_count || 0, 10);
      const incorrectCount = parseInt(row.incorrect_count || 0, 10);
      const totalAnswered = correctCount + incorrectCount;
      const participationRate = totalParticipants > 0
        ? Math.round((participantsWithResponse / totalParticipants) * 100)
        : 0;
      const correctPercent = totalAnswered > 0
        ? Math.round((correctCount / totalAnswered) * 100)
        : 0;
      const incorrectPercent = totalAnswered > 0
        ? Math.round((incorrectCount / totalAnswered) * 100)
        : 0;
      return {
        quiz_id: row.id,
        quiz_title: row.title,
        quiz_state: row.state,
        creator_id: row.creator_id,
        creator_email: row.creator_email || '(inconnu)',
        question_count: parseInt(row.question_count || 0, 10),
        session_count: parseInt(row.session_count || 0, 10),
        total_participants: totalParticipants,
        participants_with_response: participantsWithResponse,
        participation_rate: participationRate,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        correct_percent: correctPercent,
        incorrect_percent: incorrectPercent,
      };
    });

    return res.status(200).json({
      totalQuizzes,
      totalQuestions,
      totalSessions,
      totalParticipants,
      activeQuizzes,
      creatorCount,
      adminCount,
      quizStats,
    });
  } catch (err) {
    console.error('Erreur getGlobalStats:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/admin/quizzes – Liste tous les quiz (admin) pour suppression
 * Retourne id, title, creator_id, state, question_count
 */
async function listAllQuizzes(req, res) {
  try {
    const result = await pool.query(
      `SELECT q.id, q.title, q.description, q.state, q.creator_id, q.created_at,
        u.email AS creator_email,
        (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count
       FROM quizzes q
       LEFT JOIN users u ON u.id = q.creator_id
       ORDER BY q.created_at DESC, q.id DESC`
    );
    return res.status(200).json({ quizzes: result.rows });
  } catch (err) {
    console.error('Erreur listAllQuizzes:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * DELETE /api/v1/admin/quizzes/:id – Supprimer un quiz uniquement s'il n'est pas actif (admin)
 */
async function deleteQuiz(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });

    const quiz = await pool.query('SELECT id, state, title FROM quizzes WHERE id = $1', [quizId]);
    if (quiz.rows.length === 0) {
      return res.status(404).json({ message: 'Quiz non trouvé' });
    }
    if (quiz.rows[0].state === 'actif' || quiz.rows[0].state === 'ouvert') {
      return res.status(400).json({
        message: 'Impossible de supprimer un quiz actif ou ouvert. Terminez-le d\'abord.',
      });
    }

    await pool.query('DELETE FROM quizzes WHERE id = $1', [quizId]);
    return res.status(204).send();
  } catch (err) {
    console.error('Erreur admin deleteQuiz:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = {
  listUsers,
  createCreator,
  deactivateCreator,
  activateCreator,
  promoteCreator,
  demoteAdmin,
  getGlobalStats,
  listAllQuizzes,
  deleteQuiz,
};
