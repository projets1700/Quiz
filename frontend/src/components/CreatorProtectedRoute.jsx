/**
 * Route protégée créateur : redirige vers /login si pas de token,
 * vers /admin si l'utilisateur est admin (les admins ne peuvent accéder qu'à /admin).
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMe } from '../services/authService';
import { getToken, getUser, setUser } from '../utils/sessionStorage';

export default function CreatorProtectedRoute({ children }) {
  const token = getToken();
  const location = useLocation();
  const [ checking, setChecking ] = useState(true);
  const [ isAdmin, setIsAdmin ] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    const storedUser = getUser();
    if (storedUser) {
      const user = storedUser;
      if (user?.role === 'admin') {
        setIsAdmin(true);
        setChecking(false);
        return;
      }
      if (user?.role && user.role !== 'admin') {
        setIsAdmin(false);
        setChecking(false);
        return;
      }
    }
    getMe(token)
      .then((data) => {
        if (!cancelled) {
          setUser(data.user);
          setIsAdmin(data.user?.role === 'admin');
        }
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  if (!token) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (checking) {
    return <div className="app-loading">Chargement…</div>;
  }
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
