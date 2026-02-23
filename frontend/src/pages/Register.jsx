/**
 * Page d'inscription (Jour 7)
 * Formulaire React : email + mot de passe, appel à l'API /register.
 * Chaque ligne est commentée pour expliquer son rôle.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../services/authService';
import './Auth.css';

function Register() {
  // État local du formulaire : email et mot de passe saisis par l'utilisateur
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // État pour afficher un message d'erreur renvoyé par l'API (ex: email déjà utilisé)
  const [error, setError] = useState('');

  // État pour désactiver le bouton pendant l'envoi (évite double soumission)
  const [loading, setLoading] = useState(false);

  // Hook React Router : permet de rediriger l'utilisateur après inscription réussie
  const navigate = useNavigate();

  // État de succès après inscription : affiche le lien de vérification si renvoyé par l'API
  const [successData, setSuccessData] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessData(null);
    setLoading(true);

    try {
      const data = await register(email, password);

      // Succès : aucun compte créé tant que l'utilisateur n'a pas cliqué sur le lien dans l'email.
      // En mode mock l'API peut renvoyer confirmUrl pour afficher le lien sur la page.
      setSuccessData({
        message: data.message,
        confirmUrl: data.confirmUrl || null,
      });
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  // Affichage du succès : email envoyé, compte créé seulement après clic sur le lien
  if (successData) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Email envoyé</h1>
          <p className="auth-subtitle">{successData.message}</p>
          <div className="auth-success auth-verify-box">
            <p>Cliquez sur le lien dans l&apos;email pour créer votre compte (lien valide 24 h).</p>
            {successData.confirmUrl && (
              <p>
                <a href={successData.confirmUrl} target="_blank" rel="noopener noreferrer" className="auth-verify-link">
                  Lien de confirmation (mode dev)
                </a>
              </p>
            )}
          </div>
          <p className="auth-footer">
            Après avoir confirmé, vous pourrez vous connecter.{' '}
            <Link to="/login">Page de connexion</Link> · <Link to="/">Accueil</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Inscription</h1>
        <p className="auth-subtitle">Créateur de quiz – email professionnel requis</p>

        <form onSubmit={handleSubmit}>
          {/* Champ email : valeur contrôlée par React (email) ; onChange met à jour l'état à chaque frappe */}
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

          {/* Champ mot de passe : type password masque les caractères ; minLength rappel côté client */}
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 caractères"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={loading}
          />

          {/* Affichage conditionnel du message d'erreur renvoyé par l'API */}
          {error && <div className="auth-error">{error}</div>}

          {/* Bouton de soumission : désactivé pendant le chargement pour éviter double envoi */}
          <button type="submit" disabled={loading}>
            {loading ? 'Inscription en cours...' : "S'inscrire"}
          </button>
        </form>

        <p className="auth-footer">
          Déjà un compte ? <Link to="/login">Se connecter</Link>
        </p>
        <p className="auth-footer">
          <Link to="/">Retour à l'accueil</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
