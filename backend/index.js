/**
 * Point d'entrée du serveur backend (API REST)
 * Jours 2–6 : initialisation Express, CORS, routes auth, écoute du port.
 * Chaque ligne est commentée pour expliquer son rôle.
 */

// Charge les variables d'environnement depuis le fichier .env (DB_*, JWT_*, etc.)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const quizRoutes = require('./routes/quizRoutes');
const participantRoutes = require('./routes/participantRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Création de l'application Express
const app = express();

// Port d'écoute : variable d'environnement ou 3000 par défaut (dev)
const PORT = process.env.PORT || 3000;

// ========== Middlewares globaux ==========

// CORS : autorise les requêtes depuis le frontend (localhost ou IP du PC pour test téléphone)
const allowedOrigins = (process.env.APP_URL || 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // requêtes sans Origin (ex: Postman)
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // En dev : autoriser les origines en http depuis le réseau local (192.168.x.x, 10.x.x.x)
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true,
}));

// Parse le body des requêtes en JSON (req.body sera un objet pour POST /login, etc.)
app.use(express.json());

// Fichiers uploadés (images, vidéos) accessibles via /uploads/media/...
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== Routes ==========

// Montage des routes d'auth sous le préfixe /api/v1/auth (versioning API)
// Ex: POST /api/v1/auth/register, POST /api/v1/auth/login, GET /api/v1/auth/me
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/quizzes', quizRoutes);
app.use('/api/v1/participant', participantRoutes);
app.use('/api/v1/admin', adminRoutes);

// Route de santé : permet de vérifier que le serveur répond (sans auth)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API Quiz MVP' });
});

// Gestion des routes non trouvées (404)
app.use((req, res) => {
  res.status(404).json({ message: 'Route non trouvée' });
});

// Gestion des erreurs globales (évite que le serveur crash si une erreur non gérée est levée)
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);
  res.status(500).json({ message: 'Erreur serveur interne' });
});

// Démarrage : écouter sur toutes les interfaces (0.0.0.0) pour accès depuis le téléphone
const { runMigrations } = require('./scripts/runMigrations');
const os = require('os');

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  const ip = getLocalIP();
  if (ip) console.log(`→ Pour tester sur téléphone : http://${ip}:5173 (même WiFi, frontend Vite)`);
  console.log('Routes auth : /api/v1/auth/register, /login, /verify-email, /me');
  runMigrations().then(() => {
    console.log('Migrations terminées.');
  }).catch((err) => {
    console.warn('Migrations (arrière-plan):', err.message);
  });
});
