/**
 * Configuration du pool de connexions PostgreSQL
 * Utilisé par toutes les routes qui accèdent à la base de données.
 */

// Charge les variables d'environnement depuis .env (dotenv) pour ne pas exposer les identifiants en code
const { Pool } = require('pg');
require('dotenv').config();

// Création d'un pool de connexions : réutilise les connexions au lieu d'en ouvrir une nouvelle à chaque requête
// Améliore les performances sous charge (ex: 200 participants simultanés)
// Le client pg exige que password soit une chaîne (SASL SCRAM) ; on force le type pour éviter une erreur si .env manque
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'frispirit_app',
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD ?? ''),  // Toujours une string (obligatoire pour pg)
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,  // 15 s (DB distante ou PostgreSQL lent au démarrage)
});

// Export du pool pour l'utiliser dans les contrôleurs (ex: pool.query(...))
module.exports = { pool };
