/**
 * Route protégée : redirige vers /login si pas de token (Jours 12–14).
 * Utilisé pour /quizzes, /quizzes/new, /quizzes/:id/edit.
 * Préserve la route demandée dans state.from pour rediriger après connexion si besoin.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../utils/sessionStorage';

export default function ProtectedRoute({ children }) {
  const token = getToken();
  const location = useLocation();
  // Pas de token : redirection vers login en sauvegardant la page d'origine
  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}
