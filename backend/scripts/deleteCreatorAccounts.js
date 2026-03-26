/**
 * Supprime tous les comptes avec le rôle « creator » et les données liées (quiz, sessions, etc.).
 * Les comptes « admin » sont conservés.
 *
 * Usage : depuis backend/
 *   node scripts/deleteCreatorAccounts.js
 *   node scripts/deleteCreatorAccounts.js --yes   (sans confirmation)
 */

require('dotenv').config();
const readline = require('readline');
const { pool } = require('../config/db');

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^oui|yes|y|o$/i.test(answer.trim()));
    });
  });
}

async function main() {
  const skipConfirm = process.argv.includes('--yes');
  const creators = await pool.query(
    "SELECT id, email, created_at FROM users WHERE role = 'creator' ORDER BY id"
  );

  if (creators.rows.length === 0) {
    console.log('Aucun compte créateur à supprimer.');
    await pool.end();
    process.exit(0);
  }

  console.log('Comptes créateurs à supprimer :');
  creators.rows.forEach((u) => console.log(`  - ${u.email} (id ${u.id})`));

  if (!skipConfirm) {
    const ok = await confirm('\nConfirmer la suppression ? (oui/non) : ');
    if (!ok) {
      console.log('Annulé.');
      await pool.end();
      process.exit(0);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Quiz d’un créateur → CASCADE : questions, quiz_sessions, participants, scores, responses
    const delQuizzes = await client.query(
      `DELETE FROM quizzes WHERE creator_id IN (SELECT id FROM users WHERE role = 'creator')`
    );
    console.log(`Quiz supprimés : ${delQuizzes.rowCount}`);

    await client.query(
      `DELETE FROM password_reset_tokens WHERE user_id IN (SELECT id FROM users WHERE role = 'creator')`
    );

    try {
      await client.query(
        `DELETE FROM verification_tokens WHERE user_id IN (SELECT id FROM users WHERE role = 'creator')`
      );
    } catch (e) {
      if (!/relation "verification_tokens" does not exist/i.test(e.message)) throw e;
    }

    const delUsers = await client.query(`DELETE FROM users WHERE role = 'creator'`);
    console.log(`Comptes créateurs supprimés : ${delUsers.rowCount}`);

    await client.query('COMMIT');
    console.log('Terminé. Les comptes admin sont inchangés.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur :', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
