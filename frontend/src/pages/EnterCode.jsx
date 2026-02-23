/**
 * Page Participant – Entrée par code (Jour 15)
 * Formulaire code + pseudo → join → stocke token, redirige vers /play.
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { join, setParticipantToken } from '../services/participantService';
import './Auth.css';
import './EnterCode.css';

function EnterCode() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Pré-remplir le code si l'URL contient ?code=XXX (lien du QR code ou partage)
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl && typeof codeFromUrl === 'string') {
      setCode(codeFromUrl.trim().toUpperCase());
    }
  }, [searchParams]);

  /** Soumission : POST /participant/join, stockage du token, redirection vers /play */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!code.trim() || !pseudo.trim()) {
      setError('Code et pseudo requis');
      return;
    }
    setLoading(true);
    try {
      const data = await join(code.trim(), pseudo.trim());
      setParticipantToken(data.session_token);
      navigate('/play', { replace: true });
    } catch (e) {
      setError(e.message || 'Erreur lors de l\'entrée');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page enter-code-page">
      <div className="auth-card enter-code-card">
        <h1>Rejoindre un quiz</h1>
        <p className="auth-subtitle">Entrez le code affiché par l'animateur</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="code">Code du quiz</label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex: ABC123"
            maxLength={10}
            autoComplete="off"
            disabled={loading}
          />
          <label htmlFor="pseudo">Votre pseudo</label>
          <input
            id="pseudo"
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Votre nom ou pseudo"
            maxLength={50}
            disabled={loading}
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Entrée en cours...' : 'Entrer'}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/">Retour à l'accueil</Link>
        </p>
      </div>
    </div>
  );
}

export default EnterCode;
