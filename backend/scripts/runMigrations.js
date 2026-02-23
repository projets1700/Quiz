/**
 * Crée les tables manquantes au démarrage (quiz_sessions, participants, scores, responses).
 * À exécuter si vous n'avez pas lancé tout le script_quiz.sql.
 * Chaque bloc de migration est commenté pour expliquer son rôle.
 */

// Pool de connexions PostgreSQL (config/db.js)
const { pool } = require('../config/db');

/**
 * Exécute une requête SQL de migration ; en cas d'erreur, log et retourne false (sans faire échouer le démarrage).
 * @param {object} client - Client pg (connexion dédiée)
 * @param {string} sql - Requête SQL à exécuter
 * @returns {Promise<boolean>} true si OK, false en cas d'erreur
 */
async function runOne(client, sql) {
  try {
    await client.query(sql);
    return true;
  } catch (err) {
    console.warn('Migration:', err.message);
    return false;
  }
}

/**
 * Applique les migrations : types ENUM, tables quiz_sessions, questions, participants, scores, responses.
 * Utilise un client dédié (pool.connect()) pour enchaîner les requêtes dans la même connexion.
 */
async function runMigrations() {
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.warn('Migrations: connexion DB impossible', err.message);
    return;
  }

  try {
    // Création des types ENUM s'ils n'existent pas (évite erreur si script_quiz.sql déjà exécuté)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quiz_state') THEN
          CREATE TYPE quiz_state AS ENUM ('brouillon', 'pret', 'ouvert', 'actif', 'termine');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_display_mode') THEN
          CREATE TYPE question_display_mode AS ENUM ('ordered', 'random');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_type') THEN
          CREATE TYPE question_type AS ENUM ('qcm-unique', 'qcm-multiple', 'vrai-faux', 'ouverte');
        END IF;
      END $$
    `);

    // Index sur quizzes pour la liste des quiz par créateur (évite scan complet)
    await runOne(client, 'CREATE INDEX IF NOT EXISTS idx_quizzes_creator ON quizzes(creator_id)');
    // Durée totale du quiz en secondes (optionnelle) : le quiz se termine aussi quand ce délai est dépassé
    await runOne(client, 'ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS total_duration_seconds INT');

    // Table des sessions de quiz (une session = un quiz lancé avec un code d'accès)
    await client.query(`
      CREATE TABLE IF NOT EXISTS quiz_sessions (
        id SERIAL PRIMARY KEY,
        quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        host_id INT NOT NULL REFERENCES users(id),
        access_code VARCHAR(10) UNIQUE NOT NULL,
        state quiz_state NOT NULL DEFAULT 'actif',
        started_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP,
        question_order JSONB,
        current_question_position INT NOT NULL DEFAULT 1,
        current_question_started_at TIMESTAMP
      )
    `);
    await runOne(client, 'CREATE INDEX IF NOT EXISTS idx_sessions_quiz ON quiz_sessions(quiz_id)');

    // Ajouter 'ouvert' à l'enum quiz_state si la base existait avant (nouveau flux Ouvrir → Lancé)
    await runOne(client, "ALTER TYPE quiz_state ADD VALUE IF NOT EXISTS 'ouvert'");

    // Supprimer la contrainte CHECK explicite sur quizzes.state si elle existe (elle peut limiter aux anciennes valeurs)
    await runOne(client, 'ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_state_check');

    // Points min/max selon le temps de réponse (barème entre 1 et N points selon rapidité)
    await runOne(client, 'ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS time_based_scoring BOOLEAN DEFAULT false');
    await runOne(client, 'ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS scoring_min_points INT DEFAULT 1');
    await runOne(client, 'ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS scoring_max_points INT DEFAULT 5');
    await runOne(client, 'ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS speed_bonus_points INT DEFAULT 1');
    await runOne(client, 'ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS speed_bonus_step_seconds INT DEFAULT 3');
    await runOne(client, 'ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS speed_bonus_points_per_step INT DEFAULT 1');

    // Table des questions (liées à un quiz, avec type, options, bonne(s) réponse(s))
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        position INT NOT NULL,
        type question_type NOT NULL,
        question TEXT NOT NULL,
        options JSONB,
        correct_answer JSONB,
        points INT NOT NULL DEFAULT 1,
        time_limit_seconds INT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await runOne(client, 'CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_quiz_position ON questions(quiz_id, position)');

    // Table des participants (un par pseudo + session ; session_token pour les appels API)
    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id SERIAL PRIMARY KEY,
        session_id INT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
        pseudo VARCHAR(50) NOT NULL,
        session_token TEXT UNIQUE NOT NULL,
        joined_at TIMESTAMP DEFAULT NOW(),
        disconnected_at TIMESTAMP
      )
    `);
    await runOne(client, 'CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id)');

    // Table des scores (un enregistrement par participant, total_score mis à jour à chaque bonne réponse)
    await client.query(`
      CREATE TABLE IF NOT EXISTS scores (
        participant_id INT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
        session_id INT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
        total_score INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await runOne(client, 'CREATE INDEX IF NOT EXISTS idx_scores_session ON scores(session_id)');
    // Colonnes / nettoyage si la table scores existait avec un ancien schéma
    await runOne(
      client,
      'ALTER TABLE scores ADD COLUMN IF NOT EXISTS session_id INT REFERENCES quiz_sessions(id) ON DELETE CASCADE'
    );
    await runOne(
      client,
      'ALTER TABLE scores ADD COLUMN IF NOT EXISTS total_score INT NOT NULL DEFAULT 0'
    );
    // Si une ancienne colonne "score" existe encore, recopier les valeurs puis la supprimer
    await runOne(
      client,
      'UPDATE scores SET total_score = score WHERE total_score IS NULL AND score IS NOT NULL'
    );
    await runOne(client, 'ALTER TABLE scores DROP COLUMN IF EXISTS score');
    await runOne(client, 'CREATE INDEX IF NOT EXISTS idx_scores_session ON scores(session_id)');

    // Table des réponses (une ligne par participant + question ; answer en JSON, is_correct pour le scoring)
    await client.query(`
      CREATE TABLE IF NOT EXISTS responses (
        id SERIAL PRIMARY KEY,
        participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
        question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        answer JSONB,
        is_correct BOOLEAN,
        answered_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (participant_id, question_id)
      )
    `);
    await runOne(client, 'CREATE INDEX IF NOT EXISTS idx_responses_participant ON responses(participant_id)');
    await runOne(client, 'CREATE INDEX IF NOT EXISTS idx_responses_question ON responses(question_id)');

    // Colonne session_id si la table participants existait sans elle (ancienne création)
    await runOne(client, 'ALTER TABLE participants ADD COLUMN IF NOT EXISTS session_id INT REFERENCES quiz_sessions(id) ON DELETE CASCADE');
    await runOne(client, 'CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id)');
    // Colonne quiz_id si la table participants l'exige (NOT NULL ailleurs)
    await runOne(client, 'ALTER TABLE participants ADD COLUMN IF NOT EXISTS quiz_id INT REFERENCES quizzes(id) ON DELETE CASCADE');

    // Colonne disabled pour désactiver un compte créateur (admin)
    await runOne(client, 'ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT false');

    // Colonne is_correct si la table responses existait sans elle (ancienne création)
    await runOne(client, 'ALTER TABLE responses ADD COLUMN IF NOT EXISTS is_correct BOOLEAN');
    // Durée de réponse en secondes (pour statistiques "durée moyenne par question")
    await runOne(client, 'ALTER TABLE responses ADD COLUMN IF NOT EXISTS response_time_seconds NUMERIC(10,2)');

    // Image ou vidéo avant une question (URL)
    await runOne(client, 'ALTER TABLE questions ADD COLUMN IF NOT EXISTS media_type VARCHAR(10)');
    await runOne(client, 'ALTER TABLE questions ADD COLUMN IF NOT EXISTS media_url TEXT');

    console.log('Migrations (tables manquantes) appliquées.');
  } catch (err) {
    console.warn('Migrations:', err.message);
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
