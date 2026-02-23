/**
 * Contrôleur Participant (Jours 15–21)
 * Rejoindre par code, état courant (timer serveur), envoi réponse, classement.
 * Chaque fonction et bloc logique est commenté pour expliquer son rôle.
 */

// Génération du token participant (randomBytes)
const crypto = require('crypto');
const { pool } = require('../config/db');

/**
 * POST /api/v1/participant/join – Rejoindre une session par code (Jour 15)
 * Body: { code, pseudo }
 * Crée un participant, un score à 0, et retourne le session_token pour les appels suivants.
 */
async function join(req, res) {
  try {
    const { code, pseudo } = req.body;
    if (!code || !pseudo || typeof pseudo !== 'string' || !pseudo.trim()) {
      return res.status(400).json({ message: 'Code et pseudo requis' });
    }
    // Recherche d'une session ouverte ou active avec ce code (participant peut rejoindre en « ouvert » puis voir la page d'attente)
    const sessionResult = await pool.query(
      `SELECT qs.*, q.title AS quiz_title, q.ranking_enabled
       FROM quiz_sessions qs
       JOIN quizzes q ON q.id = qs.quiz_id
       WHERE qs.access_code = $1 AND qs.state IN ('ouvert', 'actif')`,
      [String(code).toUpperCase().trim()]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: 'Code invalide ou session non ouverte' });
    }
    const session = sessionResult.rows[0];
    // Token unique pour ce participant (envoyé dans X-Participant-Token ou Authorization)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const participantResult = await pool.query(
      `INSERT INTO participants (session_id, quiz_id, pseudo, session_token)
       VALUES ($1, $2, $3, $4)
       RETURNING id, session_id, pseudo, session_token, joined_at`,
      [session.id, session.quiz_id, pseudo.trim().slice(0, 50), sessionToken]
    );
    // Initialisation du score à 0 pour ce participant (ON CONFLICT au cas où contrainte unique)
    await pool.query(
      `INSERT INTO scores (participant_id, session_id, total_score)
       VALUES ($1, $2, 0)
       ON CONFLICT (participant_id) DO NOTHING`,
      [participantResult.rows[0].id, session.id]
    );
    const participant = participantResult.rows[0];
    return res.status(201).json({
      session_token: participant.session_token,
      session_id: session.id,
      quiz_title: session.quiz_title,
      ranking_enabled: session.ranking_enabled,
      total_questions: await getQuestionCount(session.quiz_id),
    });
  } catch (err) {
    console.error('join:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/** Retourne le nombre de questions du quiz (pour la réponse join). */
async function getQuestionCount(quizId) {
  const r = await pool.query('SELECT COUNT(*) AS c FROM questions WHERE quiz_id = $1', [quizId]);
  return parseInt(r.rows[0].c, 10);
}

/**
 * Initialise le timer au premier getState.
 * La question ne change plus automatiquement : seul le créateur déclenche le passage à la question suivante.
 * Le quiz passe en « terminé » soit quand le créateur clique sur « Terminer », soit via une action dédiée côté créateur.
 */
async function advanceSessionIfNeeded(sessionId, quizId) {
  const sessionRow = await pool.query(
    'SELECT current_question_position, current_question_started_at, state FROM quiz_sessions WHERE id = $1',
    [sessionId]
  );
  if (sessionRow.rows.length === 0) return null;
  if (String(sessionRow.rows[0].state || '').trim() !== 'actif') return null;

  let pos = parseInt(sessionRow.rows[0].current_question_position, 10);
  let startedAt = sessionRow.rows[0].current_question_started_at;

  if (startedAt == null) {
    await pool.query(
      'UPDATE quiz_sessions SET current_question_started_at = NOW(), started_at = COALESCE(started_at, NOW()) WHERE id = $1',
      [sessionId]
    );
    startedAt = new Date();
  }

  const questions = await pool.query(
    'SELECT id, position, time_limit_seconds FROM questions WHERE quiz_id = $1 ORDER BY position ASC',
    [quizId]
  );
  if (questions.rows.length === 0) return null;

  const currentQ = questions.rows.find((q) => Number(q.position) === pos) || questions.rows[pos - 1];
  if (!currentQ) return null;

  const participantCount = await pool.query(
    'SELECT COUNT(*) AS c FROM participants WHERE session_id = $1',
    [sessionId]
  );
  const responseCount = await pool.query(
    `SELECT COUNT(*) AS c FROM responses r
     INNER JOIN participants p ON p.id = r.participant_id AND p.session_id = $1
     WHERE r.question_id = $2`,
    [sessionId, currentQ.id]
  );
  const numParticipants = parseInt(participantCount.rows[0]?.c, 10) || 0;
  const numResponses = parseInt(responseCount.rows[0]?.c, 10) || 0;
  const allResponded = numParticipants > 0 && numResponses >= numParticipants;

  const rawLimit = currentQ.time_limit_seconds != null ? Number(currentQ.time_limit_seconds) : 30;
  const duration = Math.max(5, Math.min(120, Number.isFinite(rawLimit) ? rawLimit : 30));

  const elapsedRow = await pool.query(
    'SELECT EXTRACT(EPOCH FROM (NOW() - current_question_started_at)) AS elapsed FROM quiz_sessions WHERE id = $1',
    [sessionId]
  );
  const elapsed = Math.max(0, Number(elapsedRow.rows[0]?.elapsed) || 0);
  const tolerance = 1;
  const timeUp = elapsed >= duration - tolerance;

  // On ne change plus de question automatiquement ici (passage manuel par le créateur).
  // On se contente d'initialiser le timer et de calculer timeUp/allResponded pour d'éventuels usages futurs.
  return null;
}

/**
 * GET /api/v1/participant/state – État courant (question, timer) – Jours 16, 20
 * Le serveur avance automatiquement la question si le temps est écoulé.
 */
async function getState(req, res) {
  try {
    const { session, participant } = req;
    const sessionId = session.id;
    const quizId = session.quiz_id;

    const sessionRow = await pool.query(
      'SELECT current_question_position, current_question_started_at, state, started_at FROM quiz_sessions WHERE id = $1',
      [sessionId]
    );
    if (!sessionRow.rows[0]) {
      return res.status(404).json({ message: 'Session introuvable' });
    }
    const sessionState = String(sessionRow.rows[0].state || '').trim();

    if (sessionState === 'ouvert') {
      const countResult = await pool.query('SELECT COUNT(*) AS c FROM questions WHERE quiz_id = $1', [quizId]);
      const totalQuestions = parseInt(countResult.rows[0].c, 10);
      const participantsRows = await pool.query(
        'SELECT pseudo FROM participants WHERE session_id = $1 ORDER BY joined_at ASC',
        [sessionId]
      );
      const participants = (participantsRows.rows || []).map((r) => ({ pseudo: r.pseudo || '' }));
      return res.status(200).json({
        waiting_for_start: true,
        total_questions: totalQuestions,
        finished: false,
        participant_id: participant.id,
        session_id: sessionId,
        participants,
      });
    }

    await advanceSessionIfNeeded(sessionId, quizId);
    const sessionRow2 = await pool.query(
      'SELECT current_question_position, current_question_started_at, state, started_at FROM quiz_sessions WHERE id = $1',
      [sessionId]
    );
    const currentPos = parseInt(sessionRow2.rows[0].current_question_position, 10) || 1;
    const startedAt = sessionRow2.rows[0].current_question_started_at;

    const questions = await pool.query(
      'SELECT id, position, type, question, options, time_limit_seconds, media_type, media_url FROM questions WHERE quiz_id = $1 ORDER BY position ASC',
      [quizId]
    );
    const totalQuestions = questions.rows.length;
    const stateStr = String(sessionRow2.rows[0].state || '').trim();
    // Terminé quand la dernière question est dépassée (auto) ou quand le créateur a cliqué sur « Terminer » (state === 'termine')
    const finished = stateStr === 'termine';
    // Si actif et position au-delà de la dernière question : afficher la dernière question en attendant la fin par le créateur
    const effectivePos = stateStr === 'actif' && currentPos > totalQuestions && totalQuestions > 0
      ? totalQuestions
      : currentPos;
    console.log('[getState]', { sessionId, quizId, sessionState: stateStr, totalQuestions, currentPos: effectivePos, finished });

    if (finished) {
      const rankingEnabled = await getRankingEnabled(quizId);
      return res.status(200).json({
        finished: true,
        total_questions: totalQuestions,
        ranking_enabled: rankingEnabled,
        participant_id: participant.id,
        session_id: sessionId,
      });
    }

    const currentPosNum = Number(effectivePos);
    let currentQuestion = questions.rows.find((q) => Number(q.position) === currentPosNum);
    if (!currentQuestion && currentPosNum >= 1 && currentPosNum <= totalQuestions) {
      currentQuestion = questions.rows[currentPosNum - 1];
      if (currentQuestion) {
        await pool.query(
          'UPDATE quiz_sessions SET current_question_position = $1, current_question_started_at = COALESCE(current_question_started_at, NOW()) WHERE id = $2',
          [currentQuestion.position, sessionId]
        );
      }
    }
    let questionStartedAt = startedAt;
    if (!currentQuestion && totalQuestions > 0) {
      currentQuestion = questions.rows[0];
      await pool.query(
        'UPDATE quiz_sessions SET current_question_position = $1, current_question_started_at = COALESCE(current_question_started_at, NOW()) WHERE id = $2',
        [currentQuestion.position, sessionId]
      );
      const updated = await pool.query('SELECT current_question_started_at FROM quiz_sessions WHERE id = $1', [sessionId]);
      questionStartedAt = updated.rows[0]?.current_question_started_at ?? startedAt;
    }
    if (totalQuestions > 0 && !currentQuestion) currentQuestion = questions.rows[0];
    const rawLimit = currentQuestion?.time_limit_seconds != null ? Number(currentQuestion.time_limit_seconds) : 30;
    const durationSec = Math.max(5, Math.min(120, Number.isFinite(rawLimit) ? rawLimit : 30));
    const needOptionsArray = currentQuestion && ['qcm-unique', 'qcm-multiple'].includes(String(currentQuestion.type));
    let optionsVal = currentQuestion?.options;
    if (needOptionsArray && optionsVal != null && !Array.isArray(optionsVal)) {
      if (typeof optionsVal === 'string') {
        try {
          optionsVal = JSON.parse(optionsVal);
        } catch (_) {
          optionsVal = [];
        }
      }
      if (!Array.isArray(optionsVal)) optionsVal = [];
    }
    const questionPayload = currentQuestion
      ? {
          id: Number(currentQuestion.id),
          position: Number(currentQuestion.position),
          type: String(currentQuestion.type || 'qcm-unique'),
          question: currentQuestion.question != null ? String(currentQuestion.question) : '',
          options: needOptionsArray ? (Array.isArray(optionsVal) ? optionsVal : []) : (currentQuestion.options || null),
          media_type: currentQuestion.media_type || null,
          media_url: currentQuestion.media_url || null,
        }
      : null;

    const startedAtVal = questionStartedAt ?? startedAt ?? new Date();
    const durationFinal = Math.max(5, Math.min(120, Math.floor(Number(durationSec)) || 30));

    // Calcul du temps écoulé côté PostgreSQL pour éviter tout décalage timezone (Node vs DB)
    let elapsedServer = 0;
    if (startedAtVal != null) {
      const elapsedRow = await pool.query(
        'SELECT EXTRACT(EPOCH FROM (NOW() - current_question_started_at)) AS elapsed FROM quiz_sessions WHERE id = $1',
        [sessionId]
      );
      const rawElapsed = elapsedRow.rows[0]?.elapsed;
      elapsedServer = Math.max(0, Number(rawElapsed) || 0);
    }
    const remainingSecondsServer = Math.max(0, Math.ceil(durationFinal - elapsedServer));

    // Si on est sur la dernière question, que le temps est écoulé et que le quiz est encore actif,
    // on termine automatiquement le quiz pour tous (affichage direct de la page "Quiz terminé" + podium).
    if (stateStr === 'actif' && currentQuestion && totalQuestions > 0) {
      const lastPosition = totalQuestions;
      const isLastQuestion = Number(currentQuestion.position) === lastPosition;
      if (isLastQuestion && remainingSecondsServer <= 0) {
        await pool.query(
          "UPDATE quiz_sessions SET state = 'termine', ended_at = NOW() WHERE quiz_id = $1 AND state = 'actif'",
          [quizId]
        );
        await pool.query("UPDATE quizzes SET state = 'termine' WHERE id = $1", [quizId]);
        const rankingEnabled = await getRankingEnabled(quizId);
        return res.status(200).json({
          finished: true,
          total_questions: totalQuestions,
          ranking_enabled: rankingEnabled,
          participant_id: participant.id,
          session_id: sessionId,
        });
      }
    }

    const payload = {
      finished: false,
      current_question_position: currentQuestion ? Number(currentQuestion.position) : Number(effectivePos),
      question_started_at: startedAtVal != null ? new Date(startedAtVal).toISOString() : new Date().toISOString(),
      question_duration_seconds: durationFinal,
      remaining_seconds: remainingSecondsServer,
      question: questionPayload,
      total_questions: Number(totalQuestions),
      participant_id: participant.id,
      session_id: sessionId,
    };
    console.log('[getState] payload question', { sessionId, position: currentQuestion ? Number(currentQuestion.position) : effectivePos, duration_sec: durationFinal, elapsed_sec: Math.round(elapsedServer * 10) / 10, remaining_sec: remainingSecondsServer });
    return res.status(200).json(payload);
  } catch (err) {
    console.error('getState:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

async function getRankingEnabled(quizId) {
  const r = await pool.query('SELECT ranking_enabled FROM quizzes WHERE id = $1', [quizId]);
  return r.rows.length > 0 && r.rows[0].ranking_enabled;
}

/**
 * POST /api/v1/participant/respond – Enregistrer une réponse et mettre à jour le score (Jour 17)
 * Question ouverte : pas de notation, exclue du classement (is_correct = null, pas de points).
 * Bonus rapidité : +1 point si réponse correcte dans le délai configuré (configurable par quiz).
 */
async function respond(req, res) {
  try {
    const { question_id, answer } = req.body;
    const { session, participant } = req;
    if (!question_id) return res.status(400).json({ message: 'question_id requis' });

    const sessionRow = await pool.query(
      'SELECT current_question_position, current_question_started_at, state FROM quiz_sessions WHERE id = $1',
      [session.id]
    );
    if (sessionRow.rows[0].state === 'termine') {
      return res.status(400).json({ message: 'Le quiz est terminé' });
    }

    const questions = await pool.query(
      'SELECT id, position, type, correct_answer, points FROM questions WHERE quiz_id = $1 ORDER BY position',
      [session.quiz_id]
    );
    const currentPos = parseInt(sessionRow.rows[0].current_question_position, 10);
    const currentPosNum = Number(currentPos);
    const currentQ = questions.rows.find((q) => Number(q.position) === currentPosNum) || questions.rows[currentPosNum - 1];
    if (!currentQ || currentQ.id !== parseInt(question_id, 10)) {
      return res.status(400).json({ message: 'Cette question n\'est pas la question courante' });
    }

    // Une seule réponse par participant et par question
    const existing = await pool.query(
      'SELECT id FROM responses WHERE participant_id = $1 AND question_id = $2',
      [participant.id, question_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'Réponse déjà enregistrée' });
    }

    // Calcul de la correction selon le type de question (ouverte = pas de notation)
    let isCorrect = null;
    const type = currentQ.type;
    const correct = currentQ.correct_answer;
    const points = type === 'ouverte' ? 0 : (currentQ.points || 1);

    if (type === 'ouverte') {
      isCorrect = null;
    } else if (type === 'qcm-unique') {
      const userVal = typeof answer === 'string' ? answer : (answer != null ? String(answer) : null);
      const correctVal = correct != null ? String(correct) : null;
      isCorrect = userVal === correctVal;
    } else if (type === 'qcm-multiple') {
      // Comparaison des tableaux triés (ordre des réponses ne compte pas)
      const userArr = Array.isArray(answer) ? answer.map(String).sort() : [];
      const correctArr = (Array.isArray(correct) ? correct : [correct]).map(String).sort();
      isCorrect = userArr.length === correctArr.length && userArr.every((v, i) => v === correctArr[i]);
    } else if (type === 'vrai-faux') {
      const userBool = answer === true || answer === 'true';
      const correctBool = correct === true || correct === 'true';
      isCorrect = userBool === correctBool;
    }

    // Temps de réponse en secondes (depuis affichage de la question), calculé côté PostgreSQL pour cohérence
    const elapsedRow = await pool.query(
      'SELECT EXTRACT(EPOCH FROM (NOW() - current_question_started_at)) AS elapsed FROM quiz_sessions WHERE id = $1',
      [session.id]
    );
    const elapsedSec = elapsedRow.rows[0]?.elapsed != null ? Math.max(0, Number(elapsedRow.rows[0].elapsed)) : null;
    const responseTimeSeconds = elapsedSec != null ? Math.round(elapsedSec * 100) / 100 : null;

    await pool.query(
      `INSERT INTO responses (participant_id, question_id, answer, is_correct, response_time_seconds)
       VALUES ($1, $2, $3, $4, $5)`,
      [participant.id, question_id, JSON.stringify(answer), isCorrect, responseTimeSeconds]
    );

    let pointsEarned = 0;
    let speedBonusEarned = 0;
    if (type !== 'ouverte' && isCorrect === true) {
      const quizRow = await pool.query(
        'SELECT speed_bonus_enabled, speed_bonus_points, speed_bonus_step_seconds, speed_bonus_points_per_step FROM quizzes WHERE id = $1',
        [session.quiz_id]
      );
      const quiz = quizRow.rows[0];
      let addPoints = points;
      // Bonus de rapidité par paliers : points de la question + bonus (max si réponse immédiate, puis −X points toutes les Y secondes)
      const speedBonusEnabled = Boolean(quiz?.speed_bonus_enabled);
      const bonusMax = quiz?.speed_bonus_points != null ? Math.max(0, parseInt(quiz.speed_bonus_points, 10)) : 1;
      const stepSeconds = quiz?.speed_bonus_step_seconds != null ? Math.max(1, parseInt(quiz.speed_bonus_step_seconds, 10)) : 3;
      const pointsPerStep = quiz?.speed_bonus_points_per_step != null ? Math.max(0, parseInt(quiz.speed_bonus_points_per_step, 10)) : 1;
      if (speedBonusEnabled && responseTimeSeconds != null) {
        const steps = Math.floor(responseTimeSeconds / stepSeconds);
        speedBonusEarned = Math.max(0, bonusMax - steps * pointsPerStep);
        addPoints += speedBonusEarned;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('[respond] scoring', {
          quiz_id: session.quiz_id,
          speed_bonus_enabled: speedBonusEnabled,
          bonus_max: bonusMax,
          step_seconds: stepSeconds,
          points_per_step: pointsPerStep,
          response_time_seconds: responseTimeSeconds,
          speed_bonus_earned: speedBonusEarned,
          points_base: points,
          add_points: addPoints,
        });
      }
      pointsEarned = addPoints;
      await pool.query(
        `UPDATE scores SET total_score = total_score + $1
         WHERE participant_id = $2`,
        [addPoints, participant.id]
      );
    }

    const scoreRow = await pool.query('SELECT total_score FROM scores WHERE participant_id = $1', [participant.id]);
    const totalScore = scoreRow.rows[0] ? parseInt(scoreRow.rows[0].total_score, 10) : 0;

    // Si on est sur la dernière question et que tous les participants ont répondu, on termine automatiquement le quiz
    let autoFinished = false;
    if (questions.rows.length > 0) {
      const lastPosition = Math.max(...questions.rows.map((q) => Number(q.position) || 0));
      const isLastQuestion = Number(currentQ.position) === lastPosition;
      if (isLastQuestion) {
        const participantCount = await pool.query(
          'SELECT COUNT(*) AS c FROM participants WHERE session_id = $1',
          [session.id]
        );
        const responseCount = await pool.query(
          `SELECT COUNT(*) AS c FROM responses r
           INNER JOIN participants p ON p.id = r.participant_id AND p.session_id = $1
           WHERE r.question_id = $2`,
          [session.id, currentQ.id]
        );
        const numParticipants = parseInt(participantCount.rows[0]?.c, 10) || 0;
        const numResponses = parseInt(responseCount.rows[0]?.c, 10) || 0;
        if (numParticipants > 0 && numResponses >= numParticipants) {
          await pool.query(
            "UPDATE quiz_sessions SET state = 'termine', ended_at = NOW() WHERE quiz_id = $1 AND state = 'actif'",
            [session.quiz_id]
          );
          await pool.query("UPDATE quizzes SET state = 'termine' WHERE id = $1", [session.quiz_id]);
          autoFinished = true;
        }
      }
    }

    return res.status(200).json({
      recorded: true,
      is_correct: isCorrect,
      correct_answer: type === 'ouverte' ? null : correct,
      points_earned: pointsEarned,
      speed_bonus_earned: speedBonusEarned,
      total_score: totalScore,
      auto_finished: autoFinished,
    });
  } catch (err) {
    console.error('respond:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * GET /api/v1/participant/ranking – Classement de la session (Jour 18)
 */
async function getRanking(req, res) {
  try {
    const { session, participant } = req;
    const sessionRow = await pool.query(
      'SELECT state FROM quiz_sessions WHERE id = $1',
      [session.id]
    );
    const quizRow = await pool.query('SELECT ranking_enabled FROM quizzes WHERE id = $1', [session.quiz_id]);
    // Si le créateur a désactivé le classement, on renvoie un tableau vide
    if (quizRow.rows.length === 0 || !quizRow.rows[0].ranking_enabled) {
      return res.status(200).json({ ranking_enabled: false, ranking: [] });
    }

    const result = await pool.query(
      `SELECT p.id, p.pseudo, s.total_score
       FROM participants p
       JOIN scores s ON s.participant_id = p.id
       WHERE p.session_id = $1
       ORDER BY s.total_score DESC, p.joined_at ASC`,
      [session.id]
    );

    const ranking = result.rows.map((r, i) => ({
      rank: i + 1,
      pseudo: r.pseudo,
      total_score: parseInt(r.total_score, 10),
      is_me: r.id === participant.id,
    }));

    const myEntry = ranking.find((r) => r.is_me);
    let my_result = null;
    if (myEntry) {
      const myScore = myEntry.total_score;
      const myRank = myEntry.rank;
      const above = myRank > 1 ? ranking.find((r) => r.rank === myRank - 1) : null;
      const pointsToNext = above ? Math.max(0, above.total_score - myScore) : 0;
      my_result = {
        rank: myRank,
        total_score: myScore,
        points_to_next_rank: pointsToNext,
      };
    }

    return res.status(200).json({
      ranking_enabled: true,
      ranking,
      my_result,
    });
  } catch (err) {
    console.error('getRanking:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = {
  join,
  getState,
  respond,
  getRanking,
};
