/**
 * Gère la racine / : admin → /admin, créateur → /home, non connecté → Accueil.
 */
import { Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getMe } from '../services/authService';
import { getToken, getUser, setUser } from '../utils/sessionStorage';
import Accueil from '../pages/Accueil';

export default function RootWithAdminRedirect() {
  const token = getToken();
  const [checking, setChecking] = useState(!!token);
  const [role, setRole] = useState(null);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    const storedUser = getUser();
    if (storedUser) {
      if (storedUser?.role) {
        setRole(storedUser.role);
        setChecking(false);
        return;
      }
    }
    getMe(token)
      .then((data) => {
        if (!cancelled) {
          setUser(data.user);
          setRole(data.user?.role || null);
        }
      })
      .catch(() => { /* erreur */ })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, [token]);

  if (!token) {
    return <Accueil />;
  }
  if (checking) {
    return <div className="app-loading">Chargement…</div>;
  }
  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }
  if (role === 'creator') {
    return <Navigate to="/home" replace />;
  }
  return <Accueil />;
}
