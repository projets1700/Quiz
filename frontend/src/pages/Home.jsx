/**
 * Page Home : visible uniquement après connexion. Pas de bouton pour jouer à un quiz.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getUser, clearSession } from '../utils/sessionStorage';
import './Home.css';

function Home() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getUser() || null);
  }, []);

  const handleLogout = () => {
    if (!window.confirm('Voulez-vous vraiment vous déconnecter ?')) return;
    clearSession();
    setUser(null);
    window.location.href = '/';
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <nav className="home-header-nav">
          <span className="home-user-info">Connecté : {user?.email}</span>
          <button type="button" onClick={handleLogout} className="home-btn-logout home-btn-danger">
            Déconnexion
          </button>
        </nav>
      </header>
      <main className="home-main">
        <Link to="/quizzes" className="home-btn-quizzes">Mes Quiz</Link>
      </main>
    </div>
  );
}

export default Home;
