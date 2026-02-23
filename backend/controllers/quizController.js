/**
 * Contrôleur Quiz (Jours 8 à 14)
 * CRUD quiz, questions, lancement. Vérification state != actif pour modification/suppression.
 */

const { pool } = require('../config/db');

const QUIZ_STATES = ['brouillon', 'pret', 'ouvert', 'actif', 'termine'];
const QUESTION_TYPES = ['qcm-unique', 'qcm-multiple', 'vrai-faux', 'ouverte'];
const MAX_QUESTIONS_PER_QUIZ = 30;
const MIN_TIME_PER_QUESTION = 5;
const MAX_TIME_PER_QUESTION = 120;

/**
 * Vérifie que le quiz existe et appartient au créateur (ou admin)
 */
async function getQuizIfAllowed(quizId, userId, userRole) {
  const result = await pool.query(
    'SELECT * FROM quizzes WHERE id = $1',
    [quizId]
  );
  if (result.rows.length === 0) return { error: 404, message: 'Quiz non trouvé' };
  const quiz = result.rows[0];
  if (userRole !== 'admin' && quiz.creator_id !== userId) {
    return { error: 403, message: 'Accès refusé à ce quiz' };
  }
  return { quiz };
}

/**
 * GET /api/v1/quizzes – Liste des quiz du créateur connecté
 */
async function list(req, res) {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const query = isAdmin
      ? 'SELECT q.*, (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count FROM quizzes q ORDER BY q.created_at DESC, q.id DESC'
      : 'SELECT q.*, (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count FROM quizzes q WHERE q.creator_id = $1 ORDER BY q.created_at DESC, q.id DESC';
    const params = isAdmin ? [] : [userId];
    const result = await pool.query(query, params);
    return res.status(200).json({ quizzes: result.rows });
  } catch (err) {
    console.error('Erreur list quizzes:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/quizzes – Créer un quiz (brouillon par défaut) – Jour 8
 * Body: title, description?, state?, ranking_enabled?
 */
async function create(req, res) {
  try {
    const { title, description, state, ranking_enabled } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'Titre requis' });
    }
    const finalState = state && QUIZ_STATES.includes(state) ? state : 'brouillon';
    const ranking = ranking_enabled !== false;
    const result = await pool.query(
      `INSERT INTO quizzes (title, description, creator_id, state, ranking_enabled)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title.trim(), description?.trim() || null, req.user.id, finalState, ranking]
    );
    return res.status(201).json({ quiz: result.rows[0] });
  } catch (err) {
    console.error('Erreur create quiz:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/quizzes/:id/session – Session active (code d'accès) pour le créateur (Semaine 3)
 */
async function getSession(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });
    const sessionResult = await pool.query(
      `SELECT id, access_code, started_at, state FROM quiz_sessions
       WHERE quiz_id = $1 AND state IN ('ouvert', 'actif') ORDER BY started_at DESC LIMIT 1`,
      [quizId]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(200).json({ session: null });
    }
    return res.status(200).json({ session: sessionResult.rows[0] });
  } catch (err) {
    console.error('Erreur getSession:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/quizzes/:id/stats – Statistiques du quiz (taux de participation, bonnes/mauvaises réponses en %)
 */
async function getStats(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });

    const quiz = check.quiz;
    const totalQuestions = await pool.query('SELECT COUNT(*) AS c FROM questions WHERE quiz_id = $1', [quizId]);
    const nQuestions = parseInt(totalQuestions.rows[0].c, 10);

    const sessionsResult = await pool.query('SELECT id FROM quiz_sessions WHERE quiz_id = $1', [quizId]);
    const sessionIds = sessionsResult.rows.map((r) => r.id);
    const totalParticipants = sessionIds.length
      ? (await pool.query('SELECT COUNT(*) AS c FROM participants WHERE session_id = ANY($1::int[])', [sessionIds])).rows[0].c
      : 0;
    const totalParticipantsNum = parseInt(totalParticipants, 10);

    let participantsWithResponse = 0;
    if (sessionIds.length > 0 && nQuestions > 0) {
      const resp = await pool.query(
        `SELECT COUNT(DISTINCT r.participant_id) AS c
         FROM responses r
         INNER JOIN questions q ON q.id = r.question_id AND q.quiz_id = $1
         INNER JOIN participants p ON p.id = r.participant_id AND p.session_id = ANY($2::int[])`,
        [quizId, sessionIds]
      );
      participantsWithResponse = parseInt(resp.rows[0].c, 10);
    }

    const participationRate =
      totalParticipantsNum > 0 ? Math.round((participantsWithResponse / totalParticipantsNum) * 100) : 0;

    const correctResult = await pool.query(
      `SELECT COUNT(*) AS c FROM responses r
       INNER JOIN questions q ON q.id = r.question_id AND q.quiz_id = $1 AND q.type != 'ouverte'
       WHERE r.is_correct = true`,
      [quizId]
    );
    const incorrectResult = await pool.query(
      `SELECT COUNT(*) AS c FROM responses r
       INNER JOIN questions q ON q.id = r.question_id AND q.quiz_id = $1 AND q.type != 'ouverte'
       WHERE r.is_correct = false`,
      [quizId]
    );
    const correctCount = parseInt(correctResult.rows[0].c, 10);
    const incorrectCount = parseInt(incorrectResult.rows[0].c, 10);
    const totalAnswered = correctCount + incorrectCount;
    const correctPercent = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const incorrectPercent = totalAnswered > 0 ? Math.round((incorrectCount / totalAnswered) * 100) : 0;

    // Stats par question : réussite/échec et temps de réponse moyen par question (moyenne des response_time_seconds des participants ayant répondu à chaque question)
    let questionStats = [];
    if (sessionIds.length > 0) {
      const perQuestion = await pool.query(
        `SELECT q.id, q.position, q.question, q.type,
          COUNT(*) FILTER (WHERE r.is_correct = true AND p.id IS NOT NULL) AS correct_count,
          COUNT(*) FILTER (WHERE r.is_correct = false AND p.id IS NOT NULL) AS incorrect_count,
          ROUND(AVG(r.response_time_seconds) FILTER (WHERE r.response_time_seconds IS NOT NULL AND p.id IS NOT NULL)::numeric, 2) AS avg_response_time_seconds
         FROM questions q
         LEFT JOIN responses r ON r.question_id = q.id
         LEFT JOIN participants p ON p.id = r.participant_id AND p.session_id = ANY($2::int[])
         WHERE q.quiz_id = $1
         GROUP BY q.id, q.position, q.question, q.type
         ORDER BY q.position ASC`,
        [quizId, sessionIds]
      );
      questionStats = perQuestion.rows.map((row) => {
        const correct = parseInt(row.correct_count, 10) || 0;
        const incorrect = parseInt(row.incorrect_count, 10) || 0;
        const noAnswer = Math.max(0, totalParticipantsNum - correct - incorrect);
        return {
          question_id: row.id,
          position: row.position,
          label: `question${row.position}`,
          question_text: row.question,
          correct_count: correct,
          incorrect_count: incorrect,
          no_answer_count: noAnswer,
          avg_response_time_seconds: row.avg_response_time_seconds != null ? parseFloat(row.avg_response_time_seconds) : null,
        };
      });
    }

    // Classement du dernier quiz joué (session la plus récente) pour le créateur
    let ranking = [];
    if (quiz.ranking_enabled) {
      const lastSessionRow = await pool.query(
        'SELECT id FROM quiz_sessions WHERE quiz_id = $1 ORDER BY id DESC LIMIT 1',
        [quizId]
      );
      if (lastSessionRow.rows.length > 0) {
        const lastSessionId = lastSessionRow.rows[0].id;
        const rankingResult = await pool.query(
          `SELECT p.pseudo, s.total_score
           FROM participants p
           JOIN scores s ON s.participant_id = p.id
           WHERE p.session_id = $1
           ORDER BY s.total_score DESC, p.joined_at ASC`,
          [lastSessionId]
        );
        ranking = rankingResult.rows.map((r, i) => ({
          rank: i + 1,
          pseudo: r.pseudo,
          total_score: parseInt(r.total_score, 10),
        }));
      }
    }

    return res.status(200).json({
      quiz: { id: quiz.id, title: quiz.title },
      stats: {
        total_sessions: sessionIds.length,
        total_participants: totalParticipantsNum,
        participants_with_at_least_one_response: participantsWithResponse,
        participation_rate_percent: participationRate,
        total_answers_count: totalAnswered,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        correct_percent: correctPercent,
        incorrect_percent: incorrectPercent,
        question_stats: questionStats,
        ranking_enabled: !!quiz.ranking_enabled,
        ranking,
      },
    });
  } catch (err) {
    console.error('Erreur getStats:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/quizzes/:id/live – Suivi en temps réel (créateur) : question courante, réponses, timer
 */
async function getLiveState(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });

    const quiz = check.quiz;

    // Session : si quiz ouvert/actif = session ouverte/active ; si quiz terminé = dernière session pour afficher les données (classement, participants)
    let sessionRow;
    if (quiz.state === 'termine') {
      sessionRow = await pool.query(
        `SELECT id, state, access_code, current_question_position, current_question_started_at, started_at
         FROM quiz_sessions WHERE quiz_id = $1 ORDER BY id DESC LIMIT 1`,
        [quizId]
      );
    } else {
      sessionRow = await pool.query(
        `SELECT id, state, access_code, current_question_position, current_question_started_at, started_at
         FROM quiz_sessions WHERE quiz_id = $1 AND state IN ('ouvert', 'actif') ORDER BY id DESC LIMIT 1`,
        [quizId]
      );
    }
    if (sessionRow.rows.length === 0) {
      return res.status(200).json({
        quiz_state: quiz.state,
        ranking_enabled: !!quiz.ranking_enabled,
        session: null,
      });
    }

    const session = sessionRow.rows[0];
    const questionsResult = await pool.query(
      'SELECT id, position, question, type, time_limit_seconds FROM questions WHERE quiz_id = $1 ORDER BY position ASC',
      [quizId]
    );
    const questions = questionsResult.rows;
    const totalQuestions = questions.length;
    let pos = parseInt(session.current_question_position, 10) || 1;
    let currentQuestion = questions.find((q) => Number(q.position) === pos) || questions[pos - 1] || null;

    let remainingSeconds = null;
    if (currentQuestion && session.current_question_started_at) {
      const elapsedRow = await pool.query(
        'SELECT EXTRACT(EPOCH FROM (NOW() - current_question_started_at)) AS elapsed FROM quiz_sessions WHERE id = $1',
        [session.id]
      );
      const rawElapsed = elapsedRow.rows[0]?.elapsed;
      const elapsed = Math.max(0, Number(rawElapsed) || 0);
      const rawLimit = currentQuestion.time_limit_seconds != null ? Number(currentQuestion.time_limit_seconds) : 30;
      const duration = Math.max(5, Math.min(120, Number.isFinite(rawLimit) ? rawLimit : 30));
      remainingSeconds = Math.max(0, Math.ceil(duration - elapsed));
    }

    const participantCountRow = await pool.query(
      'SELECT COUNT(*) AS c FROM participants WHERE session_id = $1',
      [session.id]
    );
    const participants = parseInt(participantCountRow.rows[0]?.c, 10) || 0;
    const participantsListRow = await pool.query(
      'SELECT id, pseudo FROM participants WHERE session_id = $1 ORDER BY joined_at ASC',
      [session.id]
    );
    const participantsList = participantsListRow.rows.map((p) => ({
      id: p.id,
      pseudo: p.pseudo,
    }));

    // Classement en temps réel pour le créateur (scores par participant)
    let scoresRanking = [];
    if (quiz.ranking_enabled) {
      const rankingResult = await pool.query(
        `SELECT p.id, p.pseudo, s.total_score
         FROM participants p
         JOIN scores s ON s.participant_id = p.id
         WHERE p.session_id = $1
         ORDER BY s.total_score DESC, p.joined_at ASC`,
        [session.id]
      );
      scoresRanking = rankingResult.rows.map((r, i) => ({
        rank: i + 1,
        pseudo: r.pseudo,
        total_score: parseInt(r.total_score, 10),
      }));
    }

    let responses = 0;
    if (currentQuestion) {
      const respRow = await pool.query(
        `SELECT COUNT(*) AS c FROM responses r
         INNER JOIN participants p ON p.id = r.participant_id AND p.session_id = $1
         WHERE r.question_id = $2`,
        [session.id, currentQuestion.id]
      );
      responses = parseInt(respRow.rows[0]?.c, 10) || 0;
    }

    // Répertoire : toutes les questions avec les réponses des participants (pour la page Live)
    const repsRow = await pool.query(
      `SELECT r.question_id, p.pseudo, r.answer, r.is_correct
       FROM responses r
       INNER JOIN participants p ON p.id = r.participant_id AND p.session_id = $1
       ORDER BY r.question_id, p.joined_at ASC`,
      [session.id]
    );
    const formatAnswer = (val) => {
      if (val == null) return '–';
      if (typeof val === 'boolean') return val ? 'Vrai' : 'Faux';
      if (Array.isArray(val)) return val.map(String).join(', ');
      return String(val);
    };
    const responsesByQuestion = {};
    for (const row of repsRow.rows) {
      const qid = row.question_id;
      if (!responsesByQuestion[qid]) responsesByQuestion[qid] = [];
      responsesByQuestion[qid].push({
        pseudo: row.pseudo,
        answer: formatAnswer(row.answer),
        is_correct: row.is_correct,
      });
    }
    const questions_with_responses = questions.map((q) => ({
      id: q.id,
      position: q.position,
      question: q.question,
      type: q.type,
      responses: responsesByQuestion[q.id] || [],
    }));

    return res.status(200).json({
      quiz_state: quiz.state,
      ranking_enabled: !!quiz.ranking_enabled,
      session: {
        id: session.id,
        state: session.state,
        access_code: session.access_code,
        started_at: session.started_at,
        current_question_position: currentQuestion ? Number(currentQuestion.position) : pos,
        total_questions: totalQuestions,
        remaining_seconds: remainingSeconds,
        participants,
        responses,
        participants_list: participantsList,
        scores_ranking: scoresRanking,
        questions_with_responses,
        question: currentQuestion
          ? {
              id: currentQuestion.id,
              question: currentQuestion.question,
              type: currentQuestion.type,
            }
          : null,
      },
    });
  } catch (err) {
    console.error('Erreur getLiveState:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/quizzes/:id – Détail d'un quiz avec ses questions
 */
async function getById(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });

    const questionsResult = await pool.query(
      'SELECT * FROM questions WHERE quiz_id = $1 ORDER BY position ASC',
      [quizId]
    );
    const quiz = { ...check.quiz, questions: questionsResult.rows };
    return res.status(200).json({ quiz });
  } catch (err) {
    console.error('Erreur getById quiz:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * PUT /api/v1/quizzes/:id – Modifier quiz (titres, description, état) – Jour 10
 * Interdit si state === 'actif'
 */
async function update(req, res) {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ message: 'Les administrateurs ne peuvent pas modifier le contenu des quiz' });
    }
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });
    if (check.quiz.state === 'actif' || check.quiz.state === 'ouvert') {
      return res.status(400).json({ message: 'Impossible de modifier un quiz en cours ou ouvert' });
    }

    const { title, description, state, ranking_enabled, speed_bonus_enabled, speed_bonus_seconds, speed_bonus_points, speed_bonus_step_seconds, speed_bonus_points_per_step, time_based_scoring, scoring_min_points, scoring_max_points } = req.body;

    // Règle métier : tant qu'un quiz contient moins d'1 question,
    // son état doit rester "brouillon" (pas de passage à "prêt", "actif" ou "terminé").
    if (state !== undefined && state !== 'brouillon' && QUIZ_STATES.includes(state)) {
      const countResult = await pool.query('SELECT COUNT(*) AS c FROM questions WHERE quiz_id = $1', [quizId]);
      const questionCount = parseInt(countResult.rows[0].c, 10);
      if (questionCount < 1) {
        return res.status(400).json({
          message: 'Tant qu\'un quiz contient moins d\'1 question, son état doit rester \"brouillon\"',
        });
      }
    }

    const updates = [];
    const values = [];
    let i = 1;
    if (title !== undefined) { updates.push(`title = $${i++}`); values.push(title.trim()); }
    if (description !== undefined) { updates.push(`description = $${i++}`); values.push(description === '' ? null : description?.trim()); }
    if (state !== undefined && QUIZ_STATES.includes(state)) { updates.push(`state = $${i++}`); values.push(state); }
    if (ranking_enabled !== undefined) { updates.push(`ranking_enabled = $${i++}`); values.push(!!ranking_enabled); }
    if (speed_bonus_enabled !== undefined) { updates.push(`speed_bonus_enabled = $${i++}`); values.push(!!speed_bonus_enabled); }
    if (speed_bonus_seconds !== undefined) {
      const sec = parseInt(speed_bonus_seconds, 10);
      if (Number.isNaN(sec) || sec < 0) return res.status(400).json({ message: 'Bonus rapidité : nombre de secondes invalide' });
      updates.push(`speed_bonus_seconds = $${i++}`);
      values.push(sec);
    }
    if (speed_bonus_points !== undefined) {
      const pts = parseInt(speed_bonus_points, 10);
      if (Number.isNaN(pts) || pts < 0) return res.status(400).json({ message: 'Bonus rapidité : points de bonus invalides (entier ≥ 0)' });
      updates.push(`speed_bonus_points = $${i++}`);
      values.push(Math.min(100, pts));
    }
    if (speed_bonus_step_seconds !== undefined) {
      const step = parseInt(speed_bonus_step_seconds, 10);
      if (Number.isNaN(step) || step < 1) return res.status(400).json({ message: 'Bonus rapidité : période (secondes) invalide (entier ≥ 1)' });
      updates.push(`speed_bonus_step_seconds = $${i++}`);
      values.push(Math.min(120, step));
    }
    if (speed_bonus_points_per_step !== undefined) {
      const pps = parseInt(speed_bonus_points_per_step, 10);
      if (Number.isNaN(pps) || pps < 0) return res.status(400).json({ message: 'Bonus rapidité : points par palier invalides (entier ≥ 0)' });
      updates.push(`speed_bonus_points_per_step = $${i++}`);
      values.push(Math.min(100, pps));
    }
    if (time_based_scoring !== undefined) { updates.push(`time_based_scoring = $${i++}`); values.push(!!time_based_scoring); }
    if (scoring_min_points !== undefined) {
      const minP = parseInt(scoring_min_points, 10);
      if (Number.isNaN(minP) || minP < 0) return res.status(400).json({ message: 'Points minimum : entier ≥ 0' });
      updates.push(`scoring_min_points = $${i++}`);
      values.push(minP);
    }
    if (scoring_max_points !== undefined) {
      const maxP = parseInt(scoring_max_points, 10);
      if (Number.isNaN(maxP) || maxP < 0) return res.status(400).json({ message: 'Points maximum : entier ≥ 0' });
      updates.push(`scoring_max_points = $${i++}`);
      values.push(maxP);
    }
    if (updates.length === 0) return res.status(200).json({ quiz: check.quiz });

    values.push(quizId);
    const result = await pool.query(
      `UPDATE quizzes SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    return res.status(200).json({ quiz: result.rows[0] });
  } catch (err) {
    console.error('Erreur update quiz:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * DELETE /api/v1/quizzes/:id – Supprimer un quiz – Jour 10
 * Interdit si state === 'actif'
 */
async function remove(req, res) {
  try {
    // Admin ne supprime pas via cette route (utilise /api/v1/admin/quizzes/:id)
    if (req.user.role === 'admin') {
      return res.status(403).json({ message: 'Utilisez l\'espace administrateur pour supprimer un quiz' });
    }
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });
    if (check.quiz.state === 'actif' || check.quiz.state === 'ouvert') {
      return res.status(400).json({ message: 'Impossible de supprimer un quiz en cours ou ouvert' });
    }
    await pool.query('DELETE FROM quizzes WHERE id = $1', [quizId]);
    return res.status(204).send();
  } catch (err) {
    console.error('Erreur delete quiz:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * Génère un code d'accès court (6 caractères alphanumériques) pour une session
 */
function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * POST /api/v1/quizzes/:id/end – Terminer le quiz manuellement (créateur)
 * Si state === 'actif' ou 'ouvert', passe le quiz et la session en Terminé.
 */
async function endQuiz(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });
    const state = check.quiz.state;
    if (state !== 'actif' && state !== 'ouvert') {
      return res.status(400).json({ message: 'Seul un quiz en cours (actif) ou ouvert peut être terminé manuellement' });
    }
    await pool.query(
      "UPDATE quiz_sessions SET state = 'termine', ended_at = NOW() WHERE quiz_id = $1 AND state IN ('actif', 'ouvert')",
      [quizId]
    );
    await pool.query("UPDATE quizzes SET state = 'termine' WHERE id = $1", [quizId]);
    const quizResult = await pool.query('SELECT * FROM quizzes WHERE id = $1', [quizId]);
    return res.status(200).json({ quiz: quizResult.rows[0] });
  } catch (err) {
    console.error('Erreur endQuiz:', err);
    if (err.code === '42P01') {
      return res.status(503).json({
        message: 'La table quiz_sessions n\'existe pas. Exécutez le script backend/scripts/script_quiz.sql sur votre base.',
      });
    }
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/quizzes/:id/open – Ouvrir le quiz : affiche QR + code, les participants peuvent rejoindre. Le quiz ne démarre pas encore.
 */
async function openQuiz(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });
    const { state } = check.quiz;
    if (state === 'actif' || state === 'ouvert') {
      return res.status(400).json({ message: state === 'ouvert' ? 'Quiz déjà ouvert. Cliquez sur Lancé pour démarrer.' : 'Le quiz est déjà en cours.' });
    }
    if (state !== 'pret' && state !== 'brouillon' && state !== 'termine') {
      return res.status(400).json({ message: 'Ouverture possible uniquement depuis Prêt, Brouillon ou Terminé' });
    }
    const countResult = await pool.query('SELECT COUNT(*) AS c FROM questions WHERE quiz_id = $1', [quizId]);
    if (parseInt(countResult.rows[0].c, 10) < 1) {
      return res.status(400).json({ message: 'Un quiz doit contenir au moins 1 question' });
    }
    if (state === 'termine') {
      await pool.query("UPDATE quiz_sessions SET state = 'termine' WHERE quiz_id = $1 AND state != 'termine'", [quizId]);
    }
    await pool.query("UPDATE quizzes SET state = 'ouvert' WHERE id = $1", [quizId]);
    let accessCode = generateAccessCode();
    let exists = await pool.query('SELECT id FROM quiz_sessions WHERE access_code = $1', [accessCode]);
    while (exists.rows.length > 0) {
      accessCode = generateAccessCode();
      exists = await pool.query('SELECT id FROM quiz_sessions WHERE access_code = $1', [accessCode]);
    }
    const sessionResult = await pool.query(
      `INSERT INTO quiz_sessions (quiz_id, host_id, access_code, state, current_question_position, current_question_started_at, started_at)
       VALUES ($1, $2, $3, 'ouvert', 1, NULL, NULL)
       RETURNING id, access_code, started_at, state`,
      [quizId, req.user.id, accessCode]
    );
    const session = sessionResult.rows[0];
    return res.status(200).json({ session: { id: session.id, access_code: session.access_code, started_at: session.started_at, state: session.state } });
  } catch (err) {
    console.error('Erreur openQuiz:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/quizzes/:id/launch – Lancer le quiz : première question affichée, timer démarré (après Ouvert).
 */
async function launchQuiz(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });
    if (check.quiz.state !== 'ouvert') {
      return res.status(400).json({ message: 'Cliquez d\'abord sur Ouvrir pour afficher le code, puis sur Lancé' });
    }
    await pool.query(
      `UPDATE quiz_sessions SET state = 'actif', current_question_started_at = NOW(), started_at = NOW() WHERE quiz_id = $1 AND state = 'ouvert'`,
      [quizId]
    );
    await pool.query("UPDATE quizzes SET state = 'actif' WHERE id = $1", [quizId]);
    const quizResult = await pool.query('SELECT * FROM quizzes WHERE id = $1', [quizId]);
    return res.status(200).json({ quiz: quizResult.rows[0] });
  } catch (err) {
    console.error('Erreur launchQuiz:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/quizzes/:id/next-question – Passer manuellement à la question suivante (créateur)
 * Incrémente current_question_position pour les sessions actives de ce quiz et redémarre le timer.
 */
async function nextQuestion(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });
    if (check.quiz.state !== 'actif') {
      return res.status(400).json({ message: 'Le quiz doit être en cours (actif) pour passer à la question suivante' });
    }
    const countResult = await pool.query('SELECT COUNT(*) AS c FROM questions WHERE quiz_id = $1', [quizId]);
    const questionCount = parseInt(countResult.rows[0].c, 10);
    if (questionCount < 1) {
      return res.status(400).json({ message: 'Aucune question dans ce quiz' });
    }
    const sessionRow = await pool.query(
      'SELECT id, current_question_position FROM quiz_sessions WHERE quiz_id = $1 AND state = $2 ORDER BY id ASC LIMIT 1',
      [quizId, 'actif']
    );
    if (sessionRow.rows.length === 0) {
      return res.status(404).json({ message: 'Aucune session active pour ce quiz' });
    }
    const currentPos = parseInt(sessionRow.rows[0].current_question_position, 10) || 1;
    if (currentPos >= questionCount) {
      return res.status(400).json({ message: 'Dernière question atteinte. Cliquez sur « Terminer » pour finir le quiz.' });
    }
    const nextPos = currentPos + 1;
    await pool.query(
      'UPDATE quiz_sessions SET current_question_position = $1, current_question_started_at = NOW() WHERE quiz_id = $2 AND state = $3',
      [nextPos, quizId, 'actif']
    );
    return res.status(200).json({ current_question_position: nextPos });
  } catch (err) {
    console.error('Erreur nextQuestion:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/quizzes/:id/start – Lancer ou relancer le quiz (legacy / relance directe)
 * Le quiz passe en état Actif et le reste jusqu'à la fin réelle du quiz (toutes les questions passées
 * ou délai total écoulé) ou jusqu'à un clic "Terminer" par le créateur. Ce n'est qu'à ce moment qu'il passe en Terminé.
 */
async function start(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });
    const { state } = check.quiz;
    if (state === 'actif') {
      return res.status(400).json({ message: 'Le quiz est déjà actif' });
    }
    if (state !== 'pret' && state !== 'brouillon' && state !== 'termine') {
      return res.status(400).json({ message: 'Lancement possible uniquement depuis Prêt, Brouillon (premier lancement) ou Terminé (relance)' });
    }
    const countResult = await pool.query('SELECT COUNT(*) AS c FROM questions WHERE quiz_id = $1', [quizId]);
    const questionCount = parseInt(countResult.rows[0].c, 10);
    if (questionCount < 1) {
      return res.status(400).json({ message: 'Un quiz doit contenir au moins 1 question pour pouvoir être lancé' });
    }
    if (state === 'termine') {
      await pool.query("UPDATE quiz_sessions SET state = 'termine' WHERE quiz_id = $1", [quizId]);
    }
    await pool.query(
      "UPDATE quizzes SET state = 'actif' WHERE id = $1",
      [quizId]
    );
    let accessCode = generateAccessCode();
    let exists = await pool.query('SELECT id FROM quiz_sessions WHERE access_code = $1', [accessCode]);
    while (exists.rows.length > 0) {
      accessCode = generateAccessCode();
      exists = await pool.query('SELECT id FROM quiz_sessions WHERE access_code = $1', [accessCode]);
    }
    // current_question_started_at = NULL : le timer ne démarre qu'au premier getState (premier participant qui charge /play)
    const sessionResult = await pool.query(
      `INSERT INTO quiz_sessions (quiz_id, host_id, access_code, state, current_question_position, current_question_started_at)
       VALUES ($1, $2, $3, 'actif', 1, NULL)
       RETURNING *`,
      [quizId, req.user.id, accessCode]
    );
    const session = sessionResult.rows[0];
    const quizResult = await pool.query('SELECT * FROM quizzes WHERE id = $1', [quizId]);
    return res.status(200).json({
      quiz: quizResult.rows[0],
      session: { id: session.id, access_code: session.access_code, started_at: session.started_at },
    });
  } catch (err) {
    console.error('Erreur start quiz:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * POST /api/v1/quizzes/:id/questions – Ajouter une question – Jour 9
 * Max 30 questions par quiz. Timer par question : 5s à 120s.
 * Types : qcm-unique, qcm-multiple, vrai-faux, ouverte (pas de notation, exclue du classement).
 */
async function addQuestion(req, res) {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ message: 'Les administrateurs ne peuvent pas modifier le contenu des quiz' });
    }
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });
    if (check.quiz.state === 'actif') {
      return res.status(400).json({ message: 'Impossible d\'ajouter une question à un quiz actif' });
    }

    const countResult = await pool.query('SELECT COUNT(*) AS c FROM questions WHERE quiz_id = $1', [quizId]);
    if (parseInt(countResult.rows[0].c, 10) >= MAX_QUESTIONS_PER_QUIZ) {
      return res.status(400).json({ message: `Maximum ${MAX_QUESTIONS_PER_QUIZ} questions par quiz` });
    }

    const { type, question, options, correct_answer, points, time_limit_seconds, media_type, media_url } = req.body;
    if (!type || !QUESTION_TYPES.includes(type)) {
      return res.status(400).json({ message: 'Type invalide (qcm-unique, qcm-multiple, vrai-faux, ouverte)' });
    }
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ message: 'Énoncé requis' });
    }

    let timeLimit = time_limit_seconds != null ? parseInt(time_limit_seconds, 10) : 30;
    if (Number.isNaN(timeLimit) || timeLimit < MIN_TIME_PER_QUESTION || timeLimit > MAX_TIME_PER_QUESTION) {
      timeLimit = 30;
    }

    const positionResult = await pool.query('SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM questions WHERE quiz_id = $1', [quizId]);
    const position = positionResult.rows[0].next_pos;

    let opts = options;
    let correctVal = correct_answer;
    let pts = 1;

    if (type === 'ouverte') {
      opts = null;
      correctVal = null;
      pts = 0;
    } else if (type === 'qcm-unique' || type === 'qcm-multiple') {
      if (type === 'qcm-unique') {
        if (!Array.isArray(opts) || opts.length < 2 || opts.length > 5) {
          return res.status(400).json({ message: 'Entre 2 et 5 options requises pour un QCM à réponse unique' });
        }
        if (correctVal === undefined || (typeof correctVal !== 'string' && typeof correctVal !== 'number')) {
          return res.status(400).json({ message: 'Réponse correcte (une seule) requise pour QCM simple' });
        }
      }
      if (type === 'qcm-multiple') {
        if (!Array.isArray(opts) || opts.length !== 5 || opts.some((o) => !o || String(o).trim() === '')) {
          return res.status(400).json({ message: 'Le QCM à réponses multiples doit avoir exactement 5 options (toutes renseignées)' });
        }
        if (!Array.isArray(correctVal) || correctVal.length < 1 || correctVal.length > 5) {
          return res.status(400).json({ message: 'Le QCM multiple doit avoir entre 1 et 5 bonnes réponses' });
        }
      }
      pts = typeof points === 'number' && points >= 0 ? points : 1;
    } else if (type === 'vrai-faux') {
      if (correctVal !== true && correctVal !== false && correctVal !== 'true' && correctVal !== 'false') {
        return res.status(400).json({ message: 'Réponse correcte (vrai/faux) requise' });
      }
      correctVal = correctVal === true || correctVal === 'true';
      pts = typeof points === 'number' && points >= 0 ? points : 1;
    }

    const mediaTypeVal = (media_type === 'image' || media_type === 'video') ? media_type : null;
    const mediaUrlVal = (media_url && typeof media_url === 'string' && media_url.trim()) ? media_url.trim() : null;

    const result = await pool.query(
      `INSERT INTO questions (quiz_id, position, type, question, options, correct_answer, points, time_limit_seconds, media_type, media_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [quizId, position, type, question.trim(), opts ? JSON.stringify(opts) : null, correctVal !== undefined && correctVal !== null ? JSON.stringify(correctVal) : null, pts, timeLimit, mediaTypeVal, mediaUrlVal]
    );
    return res.status(201).json({ question: result.rows[0] });
  } catch (err) {
    console.error('Erreur addQuestion:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * PUT /api/v1/quizzes/:id/questions/:qid – Modifier une question – Jour 10
 * time_limit_seconds : 5 à 120.
 */
async function updateQuestion(req, res) {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ message: 'Les administrateurs ne peuvent pas modifier le contenu des quiz' });
    }
    const quizId = parseInt(req.params.id, 10);
    const qid = parseInt(req.params.qid, 10);
    if (Number.isNaN(quizId) || Number.isNaN(qid)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });
    if (check.quiz.state === 'actif') {
      return res.status(400).json({ message: 'Impossible de modifier un quiz actif' });
    }

    const qResult = await pool.query('SELECT * FROM questions WHERE id = $1 AND quiz_id = $2', [qid, quizId]);
    if (qResult.rows.length === 0) return res.status(404).json({ message: 'Question non trouvée' });

    const { type, question, options, correct_answer, points, time_limit_seconds, media_type, media_url } = req.body;
    const row = qResult.rows[0];
    const type_ = type && QUESTION_TYPES.includes(type) ? type : row.type;
    const question_ = question !== undefined ? String(question).trim() : row.question;
    const options_ = options !== undefined ? options : row.options;
    const correct_ = correct_answer !== undefined ? correct_answer : row.correct_answer;
    let points_ = typeof points === 'number' && points >= 0 ? points : row.points;
    if (type_ === 'ouverte') points_ = 0;

    if (type_ === 'qcm-multiple' && (options !== undefined || correct_answer !== undefined)) {
      const opts = Array.isArray(options_) ? options_ : [];
      if (opts.length !== 5 || opts.some((o) => !o || String(o).trim() === '')) {
        return res.status(400).json({ message: 'Le QCM à réponses multiples doit avoir exactement 5 options (toutes renseignées)' });
      }
      const correctArr = Array.isArray(correct_) ? correct_ : [];
      if (correctArr.length < 1 || correctArr.length > 5) {
        return res.status(400).json({ message: 'Le QCM multiple doit avoir entre 1 et 5 bonnes réponses' });
      }
    }

    let timeLimit = row.time_limit_seconds;
    if (time_limit_seconds !== undefined) {
      const t = parseInt(time_limit_seconds, 10);
      timeLimit = Number.isNaN(t) ? 30 : Math.max(MIN_TIME_PER_QUESTION, Math.min(MAX_TIME_PER_QUESTION, t));
    }

    const mediaTypeVal = media_type !== undefined
      ? ((media_type === 'image' || media_type === 'video') ? media_type : null)
      : row.media_type;
    const mediaUrlVal = media_url !== undefined
      ? ((media_url && typeof media_url === 'string' && media_url.trim()) ? media_url.trim() : null)
      : row.media_url;

    const result = await pool.query(
      `UPDATE questions SET type = $1, question = $2, options = $3, correct_answer = $4, points = $5, time_limit_seconds = $6, media_type = $7, media_url = $8
       WHERE id = $9 AND quiz_id = $10 RETURNING *`,
      [type_, question_, options_ ? JSON.stringify(options_) : null, correct_ !== undefined && correct_ !== null ? JSON.stringify(correct_) : null, points_, timeLimit, mediaTypeVal, mediaUrlVal, qid, quizId]
    );
    return res.status(200).json({ question: result.rows[0] });
  } catch (err) {
    console.error('Erreur updateQuestion:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * DELETE /api/v1/quizzes/:id/questions/:qid – Supprimer une question – Jour 10
 */
async function deleteQuestion(req, res) {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({ message: 'Les administrateurs ne peuvent pas modifier le contenu des quiz' });
    }
    const quizId = parseInt(req.params.id, 10);
    const qid = parseInt(req.params.qid, 10);
    if (Number.isNaN(quizId) || Number.isNaN(qid)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });
    if (check.quiz.state === 'actif') {
      return res.status(400).json({ message: 'Impossible de modifier un quiz actif' });
    }
    const del = await pool.query('DELETE FROM questions WHERE id = $1 AND quiz_id = $2 RETURNING id', [qid, quizId]);
    if (del.rowCount === 0) return res.status(404).json({ message: 'Question non trouvée' });
    return res.status(204).send();
  } catch (err) {
    console.error('Erreur deleteQuestion:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/quizzes/:id/sessions – Liste des sessions du quiz (triées par id ordre croissant)
 */
async function listSessions(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });

    const sessionsResult = await pool.query(
      `SELECT qs.id, qs.access_code, qs.state, qs.started_at, qs.ended_at,
        (SELECT COUNT(*) FROM participants p WHERE p.session_id = qs.id) AS participant_count
       FROM quiz_sessions qs
       WHERE qs.quiz_id = $1
       ORDER BY qs.id ASC`,
      [quizId]
    );

    const sessions = sessionsResult.rows.map((row) => ({
      id: row.id,
      access_code: row.access_code,
      state: row.state,
      started_at: row.started_at,
      ended_at: row.ended_at,
      participant_count: parseInt(row.participant_count, 10) || 0,
    }));

    return res.status(200).json({
      quiz: { id: check.quiz.id, title: check.quiz.title, state: check.quiz.state },
      sessions,
    });
  } catch (err) {
    console.error('Erreur listSessions:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * DELETE /api/v1/quizzes/:id/sessions – Supprimer toutes les sessions du quiz
 * Interdit si le quiz est actif ou ouvert.
 */
async function deleteAllSessions(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    if (Number.isNaN(quizId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });

    if (check.quiz.state === 'actif' || check.quiz.state === 'ouvert') {
      return res.status(400).json({ message: 'Impossible de supprimer les sessions : le quiz est en cours ou ouvert. Terminez-le d\'abord.' });
    }

    await pool.query('DELETE FROM quiz_sessions WHERE quiz_id = $1', [quizId]);
    return res.status(200).json({ message: 'Toutes les sessions ont été supprimées.' });
  } catch (err) {
    console.error('Erreur deleteAllSessions:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * DELETE /api/v1/quizzes/:id/sessions/:sessionId – Supprimer une session
 * Interdit si le quiz est actif ou ouvert.
 */
async function deleteSession(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    const sessionId = parseInt(req.params.sessionId, 10);
    if (Number.isNaN(quizId) || Number.isNaN(sessionId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });

    if (check.quiz.state === 'actif' || check.quiz.state === 'ouvert') {
      return res.status(400).json({ message: 'Impossible de supprimer : le quiz est en cours ou ouvert. Terminez-le d\'abord.' });
    }

    const result = await pool.query('DELETE FROM quiz_sessions WHERE id = $1 AND quiz_id = $2 RETURNING id', [sessionId, quizId]);
    if (result.rowCount === 0) return res.status(404).json({ message: 'Session introuvable' });
    return res.status(200).json({ message: 'Session supprimée.' });
  } catch (err) {
    console.error('Erreur deleteSession:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/quizzes/:id/sessions/:sessionId/stats – Statistiques d'une session spécifique
 */
async function getSessionStats(req, res) {
  try {
    const quizId = parseInt(req.params.id, 10);
    const sessionId = parseInt(req.params.sessionId, 10);
    if (Number.isNaN(quizId) || Number.isNaN(sessionId)) return res.status(400).json({ message: 'ID invalide' });
    const check = await getQuizIfAllowed(quizId, req.user.id, req.user.role);
    if (check.error) return res.status(check.error).json({ message: check.message });

    const sessionRow = await pool.query(
      'SELECT id, access_code, state, started_at, ended_at FROM quiz_sessions WHERE id = $1 AND quiz_id = $2',
      [sessionId, quizId]
    );
    if (sessionRow.rows.length === 0) {
      return res.status(404).json({ message: 'Session introuvable' });
    }
    const session = sessionRow.rows[0];

    const sessionNumberResult = await pool.query(
      'SELECT COUNT(*) + 1 AS num FROM quiz_sessions WHERE quiz_id = $1 AND id < $2',
      [quizId, sessionId]
    );
    const sessionNumber = parseInt(sessionNumberResult.rows[0]?.num, 10) || 1;

    const quiz = check.quiz;
    const totalQuestions = await pool.query('SELECT COUNT(*) AS c FROM questions WHERE quiz_id = $1', [quizId]);
    const nQuestions = parseInt(totalQuestions.rows[0].c, 10);

    const totalParticipants = (
      await pool.query('SELECT COUNT(*) AS c FROM participants WHERE session_id = $1', [sessionId])
    ).rows[0].c;
    const totalParticipantsNum = parseInt(totalParticipants, 10);

    let participantsWithResponse = 0;
    if (nQuestions > 0) {
      const resp = await pool.query(
        `SELECT COUNT(DISTINCT r.participant_id) AS c
         FROM responses r
         INNER JOIN questions q ON q.id = r.question_id AND q.quiz_id = $1
         INNER JOIN participants p ON p.id = r.participant_id AND p.session_id = $2`,
        [quizId, sessionId]
      );
      participantsWithResponse = parseInt(resp.rows[0].c, 10);
    }

    const participationRate =
      totalParticipantsNum > 0 ? Math.round((participantsWithResponse / totalParticipantsNum) * 100) : 0;

    const correctResult = await pool.query(
      `SELECT COUNT(*) AS c FROM responses r
       INNER JOIN questions q ON q.id = r.question_id AND q.quiz_id = $1 AND q.type != 'ouverte'
       INNER JOIN participants p ON p.id = r.participant_id AND p.session_id = $2
       WHERE r.is_correct = true`,
      [quizId, sessionId]
    );
    const incorrectResult = await pool.query(
      `SELECT COUNT(*) AS c FROM responses r
       INNER JOIN questions q ON q.id = r.question_id AND q.quiz_id = $1 AND q.type != 'ouverte'
       INNER JOIN participants p ON p.id = r.participant_id AND p.session_id = $2
       WHERE r.is_correct = false`,
      [quizId, sessionId]
    );
    const correctCount = parseInt(correctResult.rows[0].c, 10);
    const incorrectCount = parseInt(incorrectResult.rows[0].c, 10);
    const totalAnswered = correctCount + incorrectCount;
    const correctPercent = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const incorrectPercent = totalAnswered > 0 ? Math.round((incorrectCount / totalAnswered) * 100) : 0;

    let questionStats = [];
    const perQuestion = await pool.query(
      `SELECT q.id, q.position, q.question, q.type,
        COUNT(*) FILTER (WHERE r.is_correct = true AND p.id IS NOT NULL) AS correct_count,
        COUNT(*) FILTER (WHERE r.is_correct = false AND p.id IS NOT NULL) AS incorrect_count,
        ROUND(AVG(r.response_time_seconds) FILTER (WHERE r.response_time_seconds IS NOT NULL AND p.id IS NOT NULL)::numeric, 2) AS avg_response_time_seconds
       FROM questions q
       LEFT JOIN responses r ON r.question_id = q.id
       LEFT JOIN participants p ON p.id = r.participant_id AND p.session_id = $2
       WHERE q.quiz_id = $1
       GROUP BY q.id, q.position, q.question, q.type
       ORDER BY q.position ASC`,
      [quizId, sessionId]
    );
    questionStats = perQuestion.rows.map((row) => {
      const correct = parseInt(row.correct_count, 10) || 0;
      const incorrect = parseInt(row.incorrect_count, 10) || 0;
      const noAnswer = Math.max(0, totalParticipantsNum - correct - incorrect);
      return {
        question_id: row.id,
        position: row.position,
        label: `question${row.position}`,
        question_text: row.question,
        correct_count: correct,
        incorrect_count: incorrect,
        no_answer_count: noAnswer,
        avg_response_time_seconds: row.avg_response_time_seconds != null ? parseFloat(row.avg_response_time_seconds) : null,
      };
    });

    let ranking = [];
    if (quiz.ranking_enabled) {
      const rankingResult = await pool.query(
        `SELECT p.pseudo, s.total_score
         FROM participants p
         JOIN scores s ON s.participant_id = p.id
         WHERE p.session_id = $1
         ORDER BY s.total_score DESC, p.joined_at ASC`,
        [sessionId]
      );
      ranking = rankingResult.rows.map((r, i) => ({
        rank: i + 1,
        pseudo: r.pseudo,
        total_score: parseInt(r.total_score, 10),
      }));
    }

    return res.status(200).json({
      quiz: { id: quiz.id, title: quiz.title },
      session: {
        id: session.id,
        session_number: sessionNumber,
        access_code: session.access_code,
        state: session.state,
        started_at: session.started_at,
        ended_at: session.ended_at,
      },
      stats: {
        total_sessions: 1,
        total_participants: totalParticipantsNum,
        participants_with_at_least_one_response: participantsWithResponse,
        participation_rate_percent: participationRate,
        total_answers_count: totalAnswered,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        correct_percent: correctPercent,
        incorrect_percent: incorrectPercent,
        question_stats: questionStats,
        ranking_enabled: !!quiz.ranking_enabled,
        ranking,
      },
    });
  } catch (err) {
    console.error('Erreur getSessionStats:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = {
  list,
  create,
  getById,
  getStats,
  getLiveState,
  getSession,
  listSessions,
  deleteAllSessions,
  deleteSession,
  getSessionStats,
  update,
  remove,
  start,
  endQuiz,
  openQuiz,
  launchQuiz,
  nextQuestion,
  addQuestion,
  updateQuestion,
  deleteQuestion,
};
