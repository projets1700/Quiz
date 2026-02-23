/**
 * Route protégée admin : redirige vers /login si pas de token,
 * vers /home si l'utilisateur n'est pas admin.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMe } from '../services/authService';
import { getToken, getUser, setUser } from '../utils/sessionStorage';

export default function AdminProtectedRoute({ children }) {
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
    return <div className="app-loading">Vérification des droits…</div>;
  }
  if (!isAdmin) {
    return <Navigate to="/home" state={{ message: 'Accès réservé aux administrateurs' }} replace />;
  }
  return children;
}
