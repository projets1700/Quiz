/**
 * Page de réinitialisation du mot de passe (lien reçu par email après 3 échecs de connexion).
 */

import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { getResetPasswordStatus, resetPassword } from '../services/authService';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('invalid');
      setMessage('Lien invalide : token manquant.');
      return;
    }
    let cancelled = false;
    getResetPasswordStatus(token)
      .then((data) => {
        if (cancelled) return;
        if (data.valid) {
          setState('form');
          return;
        }
        if (data.expired) {
          setState('expired');
          setMessage(data.message || 'Ce lien a expiré.');
          return;
        }
        setState('invalid');
        setMessage(data.message || 'Lien invalide ou déjà utilisé.');
      })
      .catch(() => {
        if (!cancelled) {
          setState('invalid');
          setMessage('Erreur lors de la vérification du lien.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setMessage('');
    if (password.length < 8) {
      setMessage('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== password2) {
      setMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    resetPassword(token, password)
      .then(() => {
        setState('done');
        setMessage('Mot de passe mis à jour. Redirection vers la connexion…');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      })
      .catch((err) => {
        setMessage(err.message || 'Erreur');
      })
      .finally(() => setSubmitting(false));
  };

  if (state === 'loading') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Vérification du lien…</h1>
          <p className="auth-subtitle">Patientez un instant.</p>
        </div>
      </div>
    );
  }

  if (state === 'invalid' || state === 'expired') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>{state === 'expired' ? 'Lien expiré' : 'Lien invalide'}</h1>
          <div className="auth-error">{message}</div>
          <p className="auth-footer">
            <Link to="/login">Se connecter</Link> · <Link to="/">Accueil</Link>
          </p>
        </div>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Mot de passe modifié</h1>
          <div className="auth-success">{message}</div>
          <p className="auth-footer">
            <Link to="/login">Connexion</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Nouveau mot de passe</h1>
        <p className="auth-subtitle">Choisissez un mot de passe d’au moins 8 caractères.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="reset-pw">Nouveau mot de passe</label>
          <input
            id="reset-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            disabled={submitting}
          />
          <label htmlFor="reset-pw2">Confirmer le mot de passe</label>
          <input
            id="reset-pw2"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
            disabled={submitting}
          />
          {message && <div className="auth-error">{message}</div>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
          </button>
        </form>
        <p className="auth-footer">
          <Link to="/login">Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}

export default ResetPassword;
