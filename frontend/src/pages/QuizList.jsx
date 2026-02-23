/**
 * Page liste des quiz du créateur (Jour 12)
 * Boutons éditer / lancer. Affichage selon état (brouillon, prêt, actif, terminé).
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getQuizzes, openQuiz, endQuiz, deleteQuiz, getQuizLiveState } from '../services/quizService';
import './QuizList.css';

const STATE_LABELS = { brouillon: 'Brouillon', pret: 'Prêt', ouvert: 'Ouvert', actif: 'Actif', termine: 'Terminé' };
const STATE_CLASS = { brouillon: 'state-draft', pret: 'state-ready', ouvert: 'state-open', actif: 'state-active', termine: 'state-done' };

function QuizList() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioning, setActioning] = useState(null);
  const [liveStates, setLiveStates] = useState({});

  // Chargement de la liste des quiz au montage (GET /api/v1/quizzes)
  useEffect(() => {
    let cancelled = false;
    getQuizzes()
      .then((list) => { if (!cancelled) setQuizzes(list); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /** Ouvrir le quiz : crée/récupère la session puis redirige vers la page de suivi (code + QR + lancer) */
  const handleOpen = async (id, questionCount) => {
    setError('');
    const count = questionCount != null ? parseInt(questionCount, 10) : 0;
    if (count < 1) {
      setError('Un quiz doit contenir au moins 1 question');
      return;
    }
    setActioning(id);
    try {
      const quiz = quizzes.find((q) => q.id === id);
      if (quiz?.state === 'ouvert' || quiz?.state === 'actif') {
        navigate(`/quizzes/${id}/live`);
      } else {
        await openQuiz(id);
        getQuizzes().then((list) => setQuizzes(list)).catch(() => {});
        navigate(`/quizzes/${id}/live`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setActioning(null);
    }
  };

  /** Terminer le quiz manuellement (POST end) : Actif ou Ouvert → Terminé */
  const handleEndQuiz = async (id) => {
    if (!window.confirm('Terminer ce quiz maintenant ?')) return;
    setError('');
    setActioning(id);
    try {
      const data = await endQuiz(id);
      setQuizzes((prev) => prev.map((q) => (q.id === id ? { ...q, state: data.quiz?.state ?? 'termine' } : q)));
    } catch (e) {
      setError(e.message);
    } finally {
      setActioning(null);
    }
  };

  // Rafraîchir automatiquement la liste tant qu'il existe au moins un quiz en cours (actif ou ouvert)
  useEffect(() => {
    const hasActiveOrOpen = quizzes.some((q) => q.state === 'actif' || q.state === 'ouvert');
    if (!hasActiveOrOpen) return undefined;
    let cancelled = false;
    const interval = setInterval(() => {
      getQuizzes()
        .then((list) => { if (!cancelled) setQuizzes(list); })
        .catch(() => {});
    }, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [quizzes]);

  // Suivi en temps réel : pour chaque quiz actif, récupérer question courante, réponses, timer
  useEffect(() => {
    const activeIds = quizzes.filter((q) => q.state === 'actif').map((q) => q.id);
    if (activeIds.length === 0) return undefined;
    let cancelled = false;
    const fetchLive = () => {
      Promise.all(
        activeIds.map((id) =>
          getQuizLiveState(id)
            .then((data) => ({ id, data }))
            .catch(() => null)
        )
      ).then((results) => {
        if (cancelled) return;
        const map = {};
        results.forEach((item) => {
          if (item && item.data && item.data.session) {
            map[item.id] = item.data;
          }
        });
        setLiveStates(map);
      });
    };
    fetchLive();
    const interval = setInterval(fetchLive, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [quizzes]);

  /** Envoyer le quiz à la corbeille (suppression, interdit si actif) */
  const handleDelete = async (id, state) => {
    if (state === 'actif') return;
    if (!window.confirm('Envoyer ce quiz à la corbeille ?')) return;
    setError('');
    setActioning(id);
    try {
      await deleteQuiz(id);
      setQuizzes((prev) => prev.filter((q) => q.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setActioning(null);
    }
  };

  if (loading) return <div className="quiz-list-page"><div className="quiz-list-loading">Chargement…</div></div>;
  return (
    <div className="quiz-list-page">
      <header className="quiz-list-header">
        <h1>Mes quiz</h1>
        <nav>
          <Link to="/home">Home</Link>
          <Link to="/quizzes/new" className="btn-new">Nouveau quiz</Link>
        </nav>
      </header>
      <main className="quiz-list-main">
        {error && <div className="quiz-list-error">{error}</div>}
        {quizzes.length === 0 ? (
          <p className="quiz-list-empty">Aucun quiz. <Link to="/quizzes/new">Créer un quiz</Link></p>
        ) : (
          <ul className="quiz-list">
            {quizzes.map((q) => (
              <li key={q.id} className="quiz-list-item">
                <div className="quiz-list-item-head">
                  <div className="quiz-list-item-head-left">
                    <span className="quiz-list-item-title">{q.title}</span>
                    <span className={`quiz-list-state ${STATE_CLASS[q.state] || ''}`} title={q.state === 'actif' ? 'Quiz en cours – cliquez sur Terminer pour afficher les scores aux participants' : undefined}>
                      {STATE_LABELS[q.state] || q.state}
                    </span>
                    {(q.state === 'brouillon' || q.state === 'pret' || q.state === 'termine') && (
                      <Link
                        to={`/quizzes/${q.id}/edit`}
                        className="quiz-list-btn-settings"
                        title="Paramètres"
                        aria-label="Paramètres du quiz"
                      >
                        <svg className="quiz-list-settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                      </Link>
                    )}
                  </div>
                  {q.state !== 'actif' && q.state !== 'ouvert' && (
                      <button
                      type="button"
                      className="quiz-list-trash"
                      onClick={() => handleDelete(q.id, q.state)}
                      disabled={actioning === q.id}
                      title="Envoyer à la corbeille"
                      aria-label="Envoyer le quiz à la corbeille"
                    >
                      <svg className="quiz-list-trash-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  )}
                </div>
                {q.description && <p className="quiz-list-item-desc">{q.description}</p>}
                <p className="quiz-list-item-meta">
                  {q.question_count ?? 0} question(s)
                  {q.state === 'actif' && liveStates[q.id]?.session && (
                    <>
                      {' – '}
                      <span>
                        Question {liveStates[q.id].session.current_question_position}
                        {' / '}
                        {liveStates[q.id].session.total_questions}
                      </span>
                      {' – '}
                      <span>
                        Réponses {liveStates[q.id].session.responses}
                        {' / '}
                        {liveStates[q.id].session.participants}
                      </span>
                      {typeof liveStates[q.id].session.remaining_seconds === 'number' && (
                        <>
                          {' – '}
                          <span>
                            Temps restant {liveStates[q.id].session.remaining_seconds}s
                          </span>
                        </>
                      )}
                    </>
                  )}
                </p>
                <div className="quiz-list-item-actions">
                  <div className="quiz-list-item-actions-left">
                    {q.state === 'actif' && (
                      <span className="quiz-list-locked">Quiz en cours</span>
                    )}
                    <Link
                      to={`/quizzes/${q.id}/sessions`}
                      className="quiz-list-btn-session"
                      title="Sessions"
                      aria-label="Voir les sessions du quiz"
                    >
                      Session
                    </Link>
                    {q.state === 'actif' && (
                      <Link
                        to={`/quizzes/${q.id}/live`}
                        className="quiz-list-btn-stats"
                        title="Suivi en temps réel"
                        aria-label="Voir le suivi en temps réel"
                      >
                        👁 Suivi
                      </Link>
                    )}
                  </div>
                  <div className="quiz-list-item-actions-end">
                    {(q.state === 'brouillon' || q.state === 'pret' || q.state === 'termine' || q.state === 'ouvert') && (
                      <button type="button" className="btn-open" onClick={() => handleOpen(q.id, q.question_count)} disabled={actioning === q.id}>
                        {actioning === q.id ? '…' : 'Ouvrir'}
                      </button>
                    )}
                    {(q.state === 'actif' || q.state === 'ouvert') && (
                      <button type="button" className="btn-end" onClick={() => handleEndQuiz(q.id)} disabled={actioning === q.id}>
                        {actioning === q.id ? 'En cours…' : 'Terminer'}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

export default QuizList;
