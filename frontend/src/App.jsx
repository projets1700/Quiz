/**
 * Composant racine de l'application (Jours 7 à 14)
 * Définit toutes les routes : accueil, auth, participant (code + jeu), quiz (liste, création, édition).
 * Les routes /quizzes* sont protégées par ProtectedRoute (token JWT requis).
 * Lazy loading des pages lourdes pour accélérer le premier chargement.
 */

import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import CreatorProtectedRoute from './components/CreatorProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import RootWithAdminRedirect from './components/RootWithAdminRedirect';
import AnimatedBackground from './components/AnimatedBackground';
import Register from './pages/Register';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import ConfirmEmail from './pages/ConfirmEmail';
import './App.css';

const Home = lazy(() => import('./pages/Home'));
const QuizList = lazy(() => import('./pages/QuizList'));
const CreateQuiz = lazy(() => import('./pages/CreateQuiz'));
const EditQuiz = lazy(() => import('./pages/EditQuiz'));
const QuizStats = lazy(() => import('./pages/QuizStats'));
const QuizSessions = lazy(() => import('./pages/QuizSessions'));
const SessionStats = lazy(() => import('./pages/SessionStats'));
const QuizLive = lazy(() => import('./pages/QuizLive'));
const QuizRepertoire = lazy(() => import('./pages/QuizRepertoire'));
const EnterCode = lazy(() => import('./pages/EnterCode'));
const PlayQuiz = lazy(() => import('./pages/PlayQuiz'));
const Admin = lazy(() => import('./pages/Admin'));

function App() {
  return (
    <div className="app-shell">
      <AnimatedBackground />
      <div className="app-content">
    <Suspense fallback={<div className="app-loading">Chargement…</div>}>
    <Routes>
      {/* Page d'accueil (publique) : Connexion + bouton Jouer → /join */}
      <Route path="/" element={<RootWithAdminRedirect />} />
      {/* Page Home : réservée aux créateurs (admin redirigé vers /admin) */}
      <Route path="/home" element={<CreatorProtectedRoute><Home /></CreatorProtectedRoute>} />
      {/* Inscription (email + mot de passe → email de confirmation) */}
      <Route path="/register" element={<Register />} />
      {/* Connexion (email + mot de passe → token + redirection) */}
      <Route path="/login" element={<Login />} />
      {/* Administration : réservé aux comptes avec rôle admin en base */}
      <Route path="/admin" element={<AdminProtectedRoute><Admin /></AdminProtectedRoute>} />
      {/* Ancienne page de vérification email (lien direct) */}
      <Route path="/verify-email" element={<VerifyEmail />} />
      {/* Page de confirmation : token dans l'URL, boutons Oui/Non pour créer le compte ou annuler */}
      <Route path="/confirm-email" element={<ConfirmEmail />} />

      {/* Participant : saisie du code + pseudo, puis redirection vers /play */}
      <Route path="/join" element={<EnterCode />} />
      {/* Jeu : affichage des questions, timer, envoi des réponses, classement final */}
      <Route path="/play" element={<PlayQuiz />} />

      {/* Routes créateur : réservées aux créateurs (admin redirigé vers /admin) */}
      <Route path="/quizzes" element={<CreatorProtectedRoute><QuizList /></CreatorProtectedRoute>} />
      <Route path="/quizzes/new" element={<CreatorProtectedRoute><CreateQuiz /></CreatorProtectedRoute>} />
      <Route path="/quizzes/:id/edit" element={<CreatorProtectedRoute><EditQuiz /></CreatorProtectedRoute>} />
      <Route path="/quizzes/:id/stats" element={<CreatorProtectedRoute><QuizStats /></CreatorProtectedRoute>} />
      <Route path="/quizzes/:id/sessions" element={<CreatorProtectedRoute><QuizSessions /></CreatorProtectedRoute>} />
      <Route path="/quizzes/:id/sessions/:sessionId/stats" element={<CreatorProtectedRoute><SessionStats /></CreatorProtectedRoute>} />
      <Route path="/quizzes/:id/live" element={<CreatorProtectedRoute><QuizLive /></CreatorProtectedRoute>} />
      <Route path="/quizzes/:id/repertoire" element={<CreatorProtectedRoute><QuizRepertoire /></CreatorProtectedRoute>} />

      {/* Toute autre URL → redirection vers la home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
      </div>
    </div>
  );
}

export default App;
