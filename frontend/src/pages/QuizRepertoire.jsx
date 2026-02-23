import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getQuiz, getQuizLiveState } from '../services/quizService';
import './QuizLive.css';

function QuizRepertoire() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [q, l] = await Promise.all([
          getQuiz(id),
          getQuizLiveState(id),
        ]);
        if (cancelled) return;
        setQuiz(q);
        setLive(l);
        setError('');
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="quiz-live-page">
        <div className="quiz-live-loading-wrap">
          <div className="quiz-live-loading-spinner" aria-hidden />
          <p className="quiz-live-loading-text">Chargement du répertoire…</p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="quiz-live-page">
        <header className="quiz-live-header">
          <button type="button" className="quiz-live-btn-back" onClick={() => navigate('/quizzes')}>← Retour à Mes quiz</button>
        </header>
        <main className="quiz-live-main">
          <div className="quiz-live-error-card">
            <span className="quiz-live-error-icon" aria-hidden>⚠</span>
            <p className="quiz-live-error">{error}</p>
            <Link to="/quizzes" className="quiz-live-btn-back quiz-live-btn-back-inline">Retour à Mes quiz</Link>
          </div>
        </main>
      </div>
    );
  }

  const session = live?.session || null;
  const title = quiz?.title || `Quiz ${id}`;

  return (
    <div className="quiz-live-page">
      <header className="quiz-live-header">
        <button type="button" className="quiz-live-btn-back" onClick={() => navigate(-1)}>← Retour au live</button>
        <div className="quiz-live-header-right">
          <span className="quiz-live-state-badge">
            Répertoire des réponses
          </span>
        </div>
      </header>
      <main className="quiz-live-main">
        {!session && (
          <div className="quiz-live-empty">
            <div className="quiz-live-empty-icon">📋</div>
            <h2 className="quiz-live-empty-title">Aucune session pour ce quiz</h2>
            <p className="quiz-live-empty-text">
              Lancez d&apos;abord une session depuis « Mes quiz », puis revenez sur cette page.
            </p>
          </div>
        )}

        {session && (
          <>
            <section className="quiz-live-hero quiz-live-section-code">
              <h1 className="quiz-live-hero-title">Répertoire des réponses – {title}</h1>
              {session.access_code && (
                <p className="quiz-live-meta">
                  Code de session : <span className="quiz-live-code">{session.access_code}</span>
                </p>
              )}
            </section>

            {session.questions_with_responses && session.questions_with_responses.length > 0 ? (
              <section className="quiz-live-card quiz-live-repertoire">
                <h3 className="quiz-live-card-title">
                  <span className="quiz-live-card-icon">📋</span>
                  Questions et réponses des participants
                </h3>
                <p className="quiz-live-repertoire-hint">
                  Vue détaillée de chaque question du quiz et des réponses données par les participants.
                </p>
                <div className="quiz-live-repertoire-list">
                  {session.questions_with_responses.map((q) => (
                    <div key={q.id} className="quiz-live-repertoire-item">
                      <h4 className="quiz-live-repertoire-question">
                        Question {q.position} {q.type === 'ouverte' ? '(ouverte)' : ''}
                      </h4>
                      <p className="quiz-live-repertoire-question-text">{q.question}</p>
                      {q.responses.length > 0 ? (
                        <ul className="quiz-live-repertoire-answers">
                          {q.responses.map((r, idx) => (
                            <li key={idx} className="quiz-live-repertoire-answer">
                              <span className="quiz-live-repertoire-pseudo">{r.pseudo}</span>
                              <span className="quiz-live-repertoire-answer-value"> : {r.answer}</span>
                              {q.type !== 'ouverte' && r.is_correct != null && (
                                <span className={`quiz-live-repertoire-result ${r.is_correct ? 'correct' : 'incorrect'}`} aria-hidden>
                                  {r.is_correct ? ' ✓' : ' ✗'}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="quiz-live-placeholder">Aucune réponse enregistrée pour cette question.</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <p className="quiz-live-placeholder">
                Aucune réponse n&apos;a encore été enregistrée pour cette session.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default QuizRepertoire;

