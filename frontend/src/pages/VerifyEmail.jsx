/**
 * Page de vérification email (Jour 7)
 * Affichée quand l'utilisateur clique sur le lien reçu par email (?token=xxx).
 * Appelle l'API verify-email puis affiche un message de succès ou d'erreur.
 * Chaque ligne est commentée pour expliquer son rôle.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyEmail } from '../services/authService';
import './Auth.css';

function VerifyEmail() {
  // useSearchParams : accès aux paramètres d'URL (ex: ?token=abc123)
  const [searchParams] = useSearchParams();

  // État : null = en cours, 'success' = vérifié, 'error' = échec
  const [status, setStatus] = useState(null);

  // Message détaillé en cas d'erreur (ex: "Token expiré")
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Récupération du token depuis l'URL (?token=xxx)
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Lien invalide : token manquant');
      return;
    }

    // Appel API GET /api/v1/auth/verify-email?token=xxx
    verifyEmail(token)
      .then((data) => {
        setStatus('success');
        setMessage(data.message || 'Email vérifié. Vous pouvez vous connecter.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'Erreur lors de la vérification');
      });
  }, [searchParams]);

  // Affichage pendant le chargement (requête en cours)
  if (status === null) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p>Vérification de votre email en cours...</p>
        </div>
      </div>
    );
  }

  // Affichage du résultat (succès ou erreur)
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{status === 'success' ? 'Email vérifié' : 'Erreur'}</h1>
        <div className={status === 'success' ? 'auth-success' : 'auth-error'}>
          {message}
        </div>
        <p className="auth-footer">
          <Link to="/login">Aller à la page de connexion</Link>
        </p>
      </div>
    </div>
  );
}

export default VerifyEmail;
