/**
 * Middleware d'authentification participant (Jours 19–20)
 * Vérifie le token session participant (X-Participant-Token ou Authorization: Bearer)
 * et attache req.participant + req.session pour les routes suivantes.
 * Chaque ligne est commentée pour expliquer son rôle.
 */

// Import du pool PostgreSQL pour interroger la table participants
const { pool } = require('../config/db');

/**
 * Middleware : vérifie que la requête contient un token participant valide
 * @param {object} req - Requête Express
 * @param {object} res - Réponse Express
 * @param {function} next - Passe au middleware suivant si token valide
 */
async function participantAuth(req, res, next) {
  // Récupération du token : soit header X-Participant-Token, soit Authorization: Bearer <token>
  const token =
    req.headers['x-participant-token'] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  // Refus si aucun token fourni
  if (!token) {
    return res.status(401).json({ message: 'Token participant manquant' });
  }

  try {
    // Recherche du participant par session_token et jointure avec la session (pour quiz_id, state, etc.)
    const result = await pool.query(
      `SELECT p.*, qs.id AS qs_id, qs.quiz_id AS qs_quiz_id, qs.state AS session_state,
              qs.current_question_position, qs.current_question_started_at, qs.ended_at
       FROM participants p
       JOIN quiz_sessions qs ON qs.id = p.session_id
       WHERE p.session_token = $1`,
      [token]
    );
    // Token inconnu ou session supprimée
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Token participant invalide ou expiré' });
    }
    const row = result.rows[0];
    req.participant = row;
    // Session : id et quiz_id viennent de quiz_sessions (qs) pour charger les bonnes questions
    req.session = {
      id: row.session_id,
      quiz_id: row.qs_quiz_id != null ? row.qs_quiz_id : row.quiz_id,
      state: row.session_state,
      current_question_position: parseInt(row.current_question_position, 10),
      current_question_started_at: row.current_question_started_at,
      ended_at: row.ended_at,
    };
    next();
  } catch (err) {
    console.error('participantAuth:', err);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

module.exports = { participantAuth };
