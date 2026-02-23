-- =========================
-- Script schéma Quiz – avec choix ordre des questions (fixe ou aléatoire)
-- À exécuter dans DBeaver (nouvelle base) ou utiliser la section MIGRATION en bas si les tables existent déjà.
-- =========================

-- =========================
-- ENUMS / CONTRAINTES
-- Types énumérés pour rôles, états des quiz et types de questions.
-- =========================

-- Rôle utilisateur : admin (accès total) ou creator (création/gestion de ses quiz)
CREATE TYPE user_role AS ENUM ('admin', 'creator');
-- État d'un quiz : brouillon → prêt → actif (en cours) → terminé
CREATE TYPE quiz_state AS ENUM ('brouillon', 'pret', 'actif', 'termine');
-- Type de question : QCM 1 réponse, QCM multiples (5 options, 1–5 bonnes), vrai/faux, ouverte (sans notation)
CREATE TYPE question_type AS ENUM ('qcm-unique', 'qcm-multiple', 'vrai-faux', 'ouverte');

-- Ordre d'affichage des questions : 'ordered' = selon la position, 'random' = aléatoire au lancement
CREATE TYPE question_display_mode AS ENUM ('ordered', 'random');

-- =========================
-- USERS (COMPTES INTERNES)
-- =========================

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'creator',
  verified BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- =========================
-- INSCRIPTIONS EN ATTENTE (compte créé seulement après confirmation email)
-- =========================
CREATE TABLE pending_registrations (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pending_registrations_token ON pending_registrations(token);
CREATE INDEX idx_pending_registrations_email ON pending_registrations(email);

-- =========================
-- QUIZZES (CONTENU)
-- =========================

CREATE TABLE quizzes (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  creator_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state quiz_state NOT NULL DEFAULT 'brouillon',
  question_display_mode question_display_mode NOT NULL DEFAULT 'ordered',
  ranking_enabled BOOLEAN NOT NULL DEFAULT true,
  speed_bonus_enabled BOOLEAN NOT NULL DEFAULT false,
  speed_bonus_seconds INT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quizzes_creator ON quizzes(creator_id);

-- =========================
-- TRIGGER POUR updated_at
-- =========================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_quizzes ON quizzes;
CREATE TRIGGER trg_update_quizzes
BEFORE UPDATE ON quizzes
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();

-- =========================
-- QUIZ SESSIONS (EXECUTION)
-- =========================

CREATE TABLE quiz_sessions (
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
);

CREATE INDEX idx_sessions_quiz ON quiz_sessions(quiz_id);

-- =========================
-- PARTICIPANTS
-- =========================

CREATE TABLE participants (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  pseudo VARCHAR(50) NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  disconnected_at TIMESTAMP
);

CREATE INDEX idx_participants_session ON participants(session_id);

-- =========================
-- QUESTIONS
-- =========================

CREATE TABLE questions (
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
);

CREATE UNIQUE INDEX idx_questions_quiz_position ON questions(quiz_id, position);

-- =========================
-- RESPONSES
-- =========================

CREATE TABLE responses (
  id SERIAL PRIMARY KEY,
  participant_id INT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  question_id INT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer JSONB,
  is_correct BOOLEAN,
  answered_at TIMESTAMP DEFAULT NOW(),
  response_time_seconds NUMERIC(10,2),
  UNIQUE (participant_id, question_id)
);

-- =========================
-- SCORES
-- =========================

CREATE TABLE scores (
  participant_id INT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
  session_id INT NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
  total_score INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scores_session ON scores(session_id);

-- =============================================================================
-- MIGRATION : si les tables existent déjà (ancienne version du schéma),
-- exécuter uniquement le bloc ci-dessous pour ajouter les colonnes manquantes.
-- =============================================================================

-- Création du type question_display_mode s'il n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_display_mode') THEN
    CREATE TYPE question_display_mode AS ENUM ('ordered', 'random');
  END IF;
END
$$;

-- Colonnes ajoutées sur quizzes : mode affichage questions, classement, bonus rapidité, updated_at
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS question_display_mode question_display_mode NOT NULL DEFAULT 'ordered';
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS ranking_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS speed_bonus_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS speed_bonus_seconds INTEGER;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS total_duration_seconds INT;

-- Colonnes sur quiz_sessions : ordre des questions, fin de session, position et timer question courante
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS question_order JSONB;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS current_question_position INT NOT NULL DEFAULT 1;
ALTER TABLE quiz_sessions ADD COLUMN IF NOT EXISTS current_question_started_at TIMESTAMP;

-- Colonnes sur questions : limite de temps par question (5–120 s), date de création
ALTER TABLE questions ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS pending_registrations (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_token ON pending_registrations(token);
CREATE INDEX IF NOT EXISTS idx_pending_registrations_email ON pending_registrations(email);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
