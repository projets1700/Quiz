/**
 * Réinitialise toutes les statistiques à 0 :
 * - Supprime toutes les sessions (quiz_sessions)
 * - Supprime les participants, réponses et scores associés (CASCADE)
 */

const { pool } = require('../config/db');

async function resetStats() {
  let client;
  try {
    client = await pool.connect();
    console.log('Réinitialisation des statistiques...');

    await client.query('TRUNCATE quiz_sessions CASCADE');
    console.log('Toutes les sessions, participants, réponses et scores ont été supprimés.');

    console.log('Statistiques réinitialisées à 0.');
  } catch (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  } finally {
    client?.release();
    await pool.end();
  }
}

resetStats();
