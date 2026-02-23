/**
 * Page d'accueil (publique) : Connexion en haut à droite, bouton Jouer au centre → /join.
 */

import { Link } from 'react-router-dom';
import './Accueil.css';

function Accueil() {
  return (
    <div className="accueil-page">
      <header className="accueil-header">
        <h1 className="accueil-logo">Quiz MVP</h1>
        <nav className="accueil-header-nav">
          <Link to="/login" className="accueil-btn-login">Connexion</Link>
        </nav>
      </header>
      <main className="accueil-main">
        <Link to="/join" className="accueil-play-block" aria-label="Jouer à un quiz">
          <span className="accueil-play-circle">
            <svg className="accueil-play-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="6" width="18" height="12" rx="2.5" />
              <path d="M7 10v4M5 12h4M9 10v4" />
              <circle cx="15" cy="11" r="1.2" fill="currentColor" />
              <circle cx="19" cy="11" r="1.2" fill="currentColor" />
              <circle cx="15" cy="14" r="1.2" fill="currentColor" />
              <circle cx="19" cy="14" r="1.2" fill="currentColor" />
            </svg>
          </span>
          <span className="accueil-play-label">Jouer</span>
        </Link>
      </main>
    </div>
  );
}

export default Accueil;
