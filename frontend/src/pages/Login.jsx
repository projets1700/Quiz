/**
 * Page de connexion (Jour 7)
 * Formulaire React : email + mot de passe, appel à l'API /login, stockage du JWT.
 * Chaque ligne est commentée pour expliquer son rôle.
 */

import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { login } from '../services/authService';
import { setToken, setUser } from '../utils/sessionStorage';
import './Auth.css';

function Login() {
  // État local du formulaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Message d'erreur renvoyé par l'API (ex: identifiants incorrects, compte non vérifié)
  const [error, setError] = useState('');

  // État de chargement pendant l'appel API
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // useLocation : permet de lire les données passées lors d'une redirection (ex: message après inscription)
  const location = useLocation();

  // Message de succès et lien de vérification passés depuis la page inscription
  const successMessage = location.state?.message;
  const verifyUrl = location.state?.verifyUrl;
  // Redirection après token expiré (401)
  const searchParams = new URLSearchParams(location.search);
  const sessionExpired = searchParams.get('expired') === '1';

  /**
   * Soumission du formulaire : appel API login, stockage du JWT, redirection vers tableau de bord (ou page d'accueil)
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Appel au service auth : POST /api/v1/auth/login
      const data = await login(email, password);

      // Stockage dans sessionStorage (par onglet) : permet plusieurs sessions simultanées
      setToken(data.token);
      setUser(data.user);

      // Redirection : admin → /admin uniquement ; créateur → /home
      if (data.user?.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Connexion</h1>
        <p className="auth-subtitle">Accès créateurs et administrateurs</p>

        {sessionExpired && (
          <div className="auth-info auth-session-expired">
            Votre session a expiré. Veuillez vous reconnecter.
          </div>
        )}
        {successMessage && <div className="auth-success">{successMessage}</div>}
        {verifyUrl && (
          <div className="auth-success auth-verify-box">
            <a href={verifyUrl} target="_blank" rel="noopener noreferrer" className="auth-verify-link">
              Vérifier mon email
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@entreprise.com"
            required
            autoComplete="email"
            disabled={loading}
          />

          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            required
            autoComplete="current-password"
            disabled={loading}
          />

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="auth-footer">
          Pas encore de compte ? <Link to="/register">S'inscrire</Link>
        </p>
        <p className="auth-footer">
          <Link to="/">Retour à l'accueil</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
