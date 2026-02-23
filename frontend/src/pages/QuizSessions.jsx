/**
 * Page Sessions d'un quiz : tableau des sessions triées par numéro ordre croissant.
 * Chaque session a un lien vers ses statistiques.
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getQuizSessions, deleteAllSessions, deleteSession } from '../services/quizService';
import './QuizSessions.css';

const STATE_LABELS = { ouvert: 'Ouvert', actif: 'Actif', termine: 'Terminé' };

function formatDate(d) {
  if (!d) return '–';
  const date = new Date(d);
  return date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function QuizSessions() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState(null);

  const loadSessions = useCallback(() => {
    setLoading(true);
    setError('');
    getQuizSessions(id)
      .then((res) => setData(res))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Supprimer cette session ? Cette action est irréversible.')) return;
    setDeletingSessionId(sessionId);
    try {
      await deleteSession(id, sessionId);
      loadSessions();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingSessionId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Supprimer toutes les sessions de ce quiz ? Cette action est irréversible.')) return;
    setDeleting(true);
    try {
      await deleteAllSessions(id);
      loadSessions();
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="quiz-sessions-page"><div className="quiz-sessions-loading">Chargement des sessions…</div></div>;
  if (error) return <div className="quiz-sessions-page"><div className="quiz-sessions-error">{error}</div><Link to="/quizzes">Retour aux quiz</Link></div>;
  if (!data) return null;

  const { quiz, sessions } = data;
  const canDelete = quiz.state !== 'actif' && quiz.state !== 'ouvert';

  return (
    <div className="quiz-sessions-page">
      <header className="quiz-sessions-header">
        <h1>Sessions : {quiz.title}</h1>
        <nav>
          <Link to="/quizzes">Mes quiz</Link>
          <Link to={`/quizzes/${id}/stats`} className="quiz-sessions-btn-stats">Statistiques Globales</Link>
        </nav>
      </header>
      <main className="quiz-sessions-main">
        <section className="quiz-sessions-section">
          <div className="quiz-sessions-section-header">
            <h2>Liste des sessions</h2>
            {sessions.length > 0 && canDelete && (
              <button
                type="button"
                className="quiz-sessions-btn-delete-all"
                onClick={handleDeleteAll}
                disabled={deleting}
              >
                {deleting ? 'Suppression…' : 'Supprimer toutes les sessions'}
              </button>
            )}
          </div>
          {sessions.length === 0 ? (
            <p className="quiz-sessions-empty">Aucune session pour ce quiz.</p>
          ) : (
            <>
              <div className="quiz-sessions-table-wrap">
                <table className="quiz-sessions-table">
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Code</th>
                      <th>État</th>
                      <th>Début</th>
                      <th>Fin</th>
                      <th>Participants</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, idx) => (
                      <tr key={s.id}>
                        <td>{idx + 1}</td>
                        <td><code className="quiz-sessions-code">{s.access_code}</code></td>
                        <td><span className={`quiz-sessions-state quiz-sessions-state--${s.state}`}>{STATE_LABELS[s.state] || s.state}</span></td>
                        <td>{formatDate(s.started_at)}</td>
                        <td>{formatDate(s.ended_at)}</td>
                        <td>{s.participant_count}</td>
                        <td>
                          <div className="quiz-sessions-row-actions">
                            <Link
                              to={`/quizzes/${id}/sessions/${s.id}/stats`}
                              className="quiz-sessions-btn-stats-icon"
                              title="Statistiques de la session"
                              aria-label={`Voir les statistiques de la session ${idx + 1}`}
                            >
                              <svg className="quiz-sessions-stats-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <line x1="18" y1="20" x2="18" y2="10" />
                                <line x1="12" y1="20" x2="12" y2="4" />
                                <line x1="6" y1="20" x2="6" y2="14" />
                              </svg>
                            </Link>
                            {canDelete && (
                              <button
                                type="button"
                                className="quiz-sessions-btn-delete"
                                onClick={() => handleDeleteSession(s.id)}
                                disabled={deletingSessionId === s.id}
                                title="Supprimer la session"
                                aria-label={`Supprimer la session ${idx + 1}`}
                              >
                                <svg className="quiz-sessions-delete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <line x1="10" y1="11" x2="10" y2="17" />
                                  <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="quiz-sessions-cards">
                {sessions.map((s, idx) => (
                  <div key={s.id} className="quiz-sessions-card">
                    <div className="quiz-sessions-card-row">
                      <span className="quiz-sessions-card-label">Session</span>
                      <span>{idx + 1}</span>
                    </div>
                    <div className="quiz-sessions-card-row">
                      <span className="quiz-sessions-card-label">Code</span>
                      <code className="quiz-sessions-code">{s.access_code}</code>
                    </div>
                    <div className="quiz-sessions-card-row">
                      <span className="quiz-sessions-card-label">État</span>
                      <span className={`quiz-sessions-state quiz-sessions-state--${s.state}`}>{STATE_LABELS[s.state] || s.state}</span>
                    </div>
                    <div className="quiz-sessions-card-row">
                      <span className="quiz-sessions-card-label">Participants</span>
                      <span>{s.participant_count}</span>
                    </div>
                    <div className="quiz-sessions-card-actions">
                      <Link
                        to={`/quizzes/${id}/sessions/${s.id}/stats`}
                        className="quiz-sessions-btn-stats-icon"
                        title="Statistiques"
                        aria-label={`Statistiques session ${idx + 1}`}
                      >
                        <svg className="quiz-sessions-stats-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="18" y1="20" x2="18" y2="10" />
                          <line x1="12" y1="20" x2="12" y2="4" />
                          <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                        Statistiques
                      </Link>
                      {canDelete && (
                        <button
                          type="button"
                          className="quiz-sessions-btn-delete"
                          onClick={() => handleDeleteSession(s.id)}
                          disabled={deletingSessionId === s.id}
                          title="Supprimer la session"
                          aria-label={`Supprimer la session ${idx + 1}`}
                        >
                          <svg className="quiz-sessions-delete-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default QuizSessions;
