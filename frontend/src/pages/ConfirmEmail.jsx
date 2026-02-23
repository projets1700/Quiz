/**
 * Page de confirmation d'inscription (lien reçu par email).
 * Affiche un texte de vérification et deux boutons : Oui (activer le compte → connexion) / Non (annuler → suppression des données).
 * Si le lien a plus de 24 h, même traitement qu'annulation : suppression du compte.
 */

import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { confirmEmailStatus, confirmEmailAction } from '../services/authService';
import './Auth.css';
import './ConfirmEmail.css';

function ConfirmEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // État : loading (vérif token), valid (afficher Oui/Non), expired, invalid, done (succès)
  const [state, setState] = useState('loading');
  const [message, setMessage] = useState('');
  const [actioning, setActioning] = useState(false);

  const token = searchParams.get('token');

  // Au montage : vérifier si le token est valide (confirm-email/status)
  useEffect(() => {
    if (!token) {
      setState('invalid');
      setMessage('Lien invalide : token manquant.');
      return;
    }
    let cancelled = false;
    confirmEmailStatus(token)
      .then((data) => {
        if (cancelled) return;
        if (data.valid) {
          setState('valid');
          return;
        }
        if (data.expired) {
          setState('expired');
          return confirmEmailAction(token, 'cancel').then(() => {
            if (!cancelled) setMessage('Lien expiré (24 h). Inscription annulée et données supprimées.');
          });
        }
        setState('invalid');
        setMessage(data.message || 'Lien invalide ou déjà utilisé.');
      })
      .catch(() => {
        if (!cancelled) {
          setState('invalid');
          setMessage('Erreur lors de la vérification.');
        }
      });
    return () => { cancelled = true; };
  }, [token]);

  /** Clic "Oui" : créer le compte (users) et supprimer la ligne pending, puis rediriger vers login */
  const handleConfirm = () => {
    if (!token || actioning) return;
    setActioning(true);
    confirmEmailAction(token, 'confirm')
      .then(() => {
        setState('done');
        setMessage('Compte activé. Redirection vers la connexion...');
        setTimeout(() => navigate('/login', { replace: true }), 1500);
      })
      .catch((err) => {
        setActioning(false);
        setMessage(err.message || 'Erreur');
      });
  };

  /** Clic "Non" : supprimer la ligne pending (aucun compte créé), rediriger vers register */
  const handleCancel = () => {
    if (!token || actioning) return;
    setActioning(true);
    confirmEmailAction(token, 'cancel')
      .then(() => {
        setState('done');
        setMessage('Compte annulé. Les données ont été supprimées.');
        setTimeout(() => navigate('/register', { replace: true }), 2000);
      })
      .catch((err) => {
        setActioning(false);
        setMessage(err.message || 'Erreur');
      });
  };

  if (state === 'loading') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Confirmation en cours...</h1>
          <p>Vérification du lien.</p>
        </div>
      </div>
    );
  }

  if (state === 'invalid' || (state === 'expired' && !message)) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Lien invalide</h1>
          <div className="auth-error">{message || 'Ce lien est invalide ou a déjà été utilisé.'}</div>
          <p className="auth-footer">
            <Link to="/register">S'inscrire</Link> · <Link to="/login">Se connecter</Link>
          </p>
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Lien expiré</h1>
          <div className="auth-error">{message}</div>
          <p className="auth-footer">
            <Link to="/register">Créer un nouveau compte</Link>
          </p>
        </div>
      </div>
    );
  }

  if (state === 'done') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Confirmation</h1>
          <div className="auth-success">{message}</div>
          <p className="auth-footer">
            <Link to="/">Accueil</Link>
          </p>
        </div>
      </div>
    );
  }

  if (state === 'valid') {
    return (
      <div className="auth-page">
        <div className="auth-card confirm-email-card">
          <h1>Vérification du mail</h1>
          <p className="confirm-email-text">
            Vous avez demandé la création d'un compte. Souhaitez-vous confirmer votre inscription ?
          </p>
          <p className="confirm-email-hint">
            <strong>Oui</strong> : votre compte sera activé et vous pourrez vous connecter.<br />
            <strong>Non</strong> : l'inscription sera annulée et vos données supprimées.
          </p>
          {message && <div className="auth-error">{message}</div>}
          <div className="confirm-email-buttons">
            <button type="button" className="confirm-btn confirm-btn-yes" onClick={handleConfirm} disabled={actioning}>
              Oui
            </button>
            <button type="button" className="confirm-btn confirm-btn-no" onClick={handleCancel} disabled={actioning}>
              Non
            </button>
          </div>
          <p className="auth-footer">
            <Link to="/">Retour à l'accueil</Link>
          </p>
        </div>
      </div>
    );
  }

  return null;
}

export default ConfirmEmail;
