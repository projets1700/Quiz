import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getQuiz, getQuizLiveState, nextQuestion, launchQuiz } from '../services/quizService';
const STATE_LABELS = { brouillon: 'Brouillon', pret: 'Prêt', ouvert: 'Ouvert', actif: 'Lancé', termine: 'Terminé' };

function QuizLive() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actioning, setActioning] = useState(false);
  const [displayRemainingSeconds, setDisplayRemainingSeconds] = useState(null);
  const displayRemainingSecondsRef = useRef(null);

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
    let cancelledPoll = false;
    const interval = setInterval(() => {
      getQuizLiveState(id)
        .then((l) => {
          if (!cancelledPoll) setLive(l);
        })
        .catch(() => {});
    }, 3000);
    return () => {
      cancelled = true;
      cancelledPoll = true;
      clearInterval(interval);
    };
  }, [id]);

  // Synchroniser le temps restant depuis le serveur (toutes les 3 s ou après changement de question)
  useEffect(() => {
    const r = live?.session?.remaining_seconds;
    if (typeof r === 'number') {
      displayRemainingSecondsRef.current = r;
      setDisplayRemainingSeconds(r);
    } else {
      displayRemainingSecondsRef.current = null;
      setDisplayRemainingSeconds(null);
    }
  }, [live?.session?.remaining_seconds, live?.session?.question?.id]);

  // Décompte chaque seconde quand une question est en cours
  useEffect(() => {
    const session = live?.session;
    if (!session?.question || live?.quiz_state !== 'actif') return;
    const interval = setInterval(() => {
      const prev = displayRemainingSecondsRef.current;
      if (prev === null || prev === undefined) return;
      const next = prev > 0 ? prev - 1 : 0;
      displayRemainingSecondsRef.current = next;
      setDisplayRemainingSeconds(next);
    }, 1000);
    return () => clearInterval(interval);
  }, [id, live?.quiz_state, live?.session?.question?.id]);

  if (loading) {
    return (
      <div className="quiz-live-page">
        <div className="quiz-live-loading-wrap">
          <div className="quiz-live-loading-spinner" aria-hidden />
          <p className="quiz-live-loading-text">Chargement du suivi…</p>
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
            <button type="button" className="quiz-live-btn-back quiz-live-btn-back-inline" onClick={() => navigate('/quizzes')}>Retour à Mes quiz</button>
          </div>
        </main>
      </div>
    );
  }

  const session = live?.session || null;
  const quizState = live?.quiz_state || quiz?.state || 'brouillon';
  const rankingEnabled = live?.ranking_enabled ?? quiz?.ranking_enabled ?? true;
  const quizId = id;

  const handleLaunch = async () => {
    if (!quizId || !live || live.quiz_state !== 'ouvert') return;
    setError('');
    setActioning(true);
    try {
      await launchQuiz(quizId);
      const l = await getQuizLiveState(quizId);
      setLive(l);
    } catch (e) {
      setError(e.message);
    } finally {
      setActioning(false);
    }
  };

  const handleNextQuestion = async () => {
    if (!quizId || !session || session.state !== 'actif') return;
    setError('');
    setActioning(true);
    try {
      await nextQuestion(quizId);
      const l = await getQuizLiveState(quizId);
      setLive(l);
    } catch (e) {
      setError(e.message);
    } finally {
      setActioning(false);
    }
  };

  return (
    <div className="quiz-live-page">
      <header className="quiz-live-header">
        <button type="button" className="quiz-live-btn-back" onClick={() => navigate('/quizzes')}>← Mes quiz</button>
        <h1 className="quiz-live-header-title">
          {session ? (quizState === 'termine' ? 'Quiz terminé – Données de la session' : 'Suivi en direct') : 'Suivi en direct'}
        </h1>
        <div className="quiz-live-header-right">
          {session && live.quiz_state === 'ouvert' && (
            <button
              type="button"
              className="quiz-live-launch-btn quiz-live-launch-btn-header"
              onClick={handleLaunch}
              disabled={actioning}
            >
              {actioning ? 'Démarrage…' : 'Lancer le quiz'}
            </button>
          )}
          <span className={`quiz-live-state-badge ${quizState === 'ouvert' ? 'quiz-live-state-ouvert' : ''}`}>
            {STATE_LABELS[quizState] || quizState}
          </span>
        </div>
      </header>
      <main className="quiz-live-main">
        {!session && (
          <div className="quiz-live-empty">
            <div className="quiz-live-empty-icon">📋</div>
            <h2 className="quiz-live-empty-title">Aucune session active</h2>
            <p className="quiz-live-empty-text">
              Cliquez sur « Ouvrir » puis « Lancé » depuis la page Mes quiz pour afficher le code et le QR.
            </p>
          </div>
        )}

        {session && (
          <>
            <div className="quiz-live-top-row">
              <section className="quiz-live-hero quiz-live-section-code">
                {session.access_code ? (
                  <div className="quiz-live-code-card">
                    <p className="quiz-live-code-label">Code d'accès</p>
                    <p className="quiz-live-code-value">{session.access_code}</p>
                    {typeof window !== 'undefined' && (
                      <div className="quiz-live-qr-wrap">
                        <QRCodeSVG
                          value={`${window.location.origin}/join?code=${encodeURIComponent(session.access_code)}`}
                          size={200}
                          level="M"
                          includeMargin
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="quiz-live-placeholder">
                    Aucun code. Utilisez « Ouvrir » depuis Mes quiz.
                  </p>
                )}
              </section>

              <div className="quiz-live-right-column">
                <section className="quiz-live-card quiz-live-card-participants">
                  <h3 className="quiz-live-card-title">
                    <span className="quiz-live-card-icon">👥</span>
                    Participants
                    <span className="quiz-live-card-count">{session.participants}</span>
                  </h3>
                  {session.participants_list && session.participants_list.length > 0 ? (
                    <ul className="quiz-live-participants">
                      {session.participants_list.map((p) => (
                        <li key={p.id} className="quiz-live-participant-chip">{p.pseudo}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="quiz-live-placeholder">Aucun participant connecté.</p>
                  )}
                </section>

                <section className="quiz-live-card quiz-live-card-question">
              <h3 className="quiz-live-card-title">
                  <span className="quiz-live-card-icon">❓</span>
                  {quizState === 'termine' ? 'Dernière question / Résumé' : 'Question en cours'}
              </h3>
              {session.question ? (
                  <>
                    <div className="quiz-live-question-meta">
                      <span>Question {session.current_question_position}/{session.total_questions}</span>
                      <span className="quiz-live-question-type">
                        {session.question.type === 'ouverte' ? 'Ouverte' : 'QCM'}
                      </span>
                    </div>
                    <p className="quiz-live-question-text">{session.question.question}</p>
                    <div className="quiz-live-question-stats">
                      <span>Réponses {session.responses}/{session.participants}</span>
                      {quizState !== 'termine' && (typeof displayRemainingSeconds === 'number' || typeof session.remaining_seconds === 'number') && (
                        <span className="quiz-live-timer">{(displayRemainingSeconds ?? session.remaining_seconds)}s</span>
                      )}
                    </div>
                    {quizState === 'actif' && (
                      <button
                        type="button"
                        className="quiz-live-next-btn"
                        onClick={handleNextQuestion}
                        disabled={actioning || session.state !== 'actif'}
                      >
                        {actioning ? '…' : 'Question suivante'}
                      </button>
                    )}
                    {quizState === 'termine' && (
                      <p className="quiz-live-placeholder quiz-live-termine-hint">Session terminée. Classement et participants ci-dessous.</p>
                    )}
                  </>
              ) : (
                <p className="quiz-live-placeholder">{quizState === 'termine' ? 'Aucune question enregistrée.' : 'Aucune question en cours.'}</p>
              )}
                </section>
              </div>
            </div>

            {rankingEnabled && session.scores_ranking && session.scores_ranking.length > 0 && (
              <section className="quiz-live-card quiz-live-scores">
                <h3 className="quiz-live-card-title">
                  <span className="quiz-live-card-icon">🏆</span>
                  {quizState === 'termine' ? 'Classement final' : 'Scores en temps réel'}
                </h3>
                <p className="quiz-live-scores-hint">{quizState === 'termine' ? 'Classement à l\'issue du quiz' : 'Mis à jour automatiquement'}</p>
                {session.scores_ranking.length >= 3 ? (
                  <>
                    <div className="quiz-live-podium">
                      {[1, 0, 2].map((i) => {
                        const r = session.scores_ranking[i];
                        if (!r) return null;
                        const pos = { 1: 'second', 0: 'first', 2: 'third' }[i];
                        return (
                          <div key={r.rank} className={`quiz-live-podium-item quiz-live-podium-${pos}`}>
                            <span className="quiz-live-podium-rank">#{r.rank}</span>
                            <span className="quiz-live-podium-name">{r.pseudo}</span>
                            <span className="quiz-live-podium-score">{r.total_score} pt{r.total_score !== 1 ? 's' : ''}</span>
                          </div>
                        );
                      })}
                    </div>
                    {session.scores_ranking.length > 3 && (
                      <ol className="quiz-live-scores-list">
                        {session.scores_ranking.slice(3).map((r) => (
                          <li key={r.rank} className="quiz-live-scores-item">
                            <span className="quiz-live-scores-rank">#{r.rank}</span>
                            <span className="quiz-live-scores-name">{r.pseudo}</span>
                            <span className="quiz-live-scores-score">{r.total_score} pt{r.total_score !== 1 ? 's' : ''}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                ) : (
                  <ol className="quiz-live-scores-list">
                    {session.scores_ranking.map((r) => (
                      <li key={r.rank} className="quiz-live-scores-item">
                        <span className="quiz-live-scores-rank">#{r.rank}</span>
                        <span className="quiz-live-scores-name">{r.pseudo}</span>
                        <span className="quiz-live-scores-score">{r.total_score} pt{r.total_score !== 1 ? 's' : ''}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}

            {session.questions_with_responses && session.questions_with_responses.length > 0 && (
              <section className="quiz-live-card quiz-live-repertoire">
                <h3 className="quiz-live-card-title">
                  <span className="quiz-live-card-icon">📋</span>
                  Répertoire des réponses
                </h3>
                <p className="quiz-live-repertoire-hint">
                  Cliquez ci-dessous pour ouvrir la page détaillée des questions et réponses.
                </p>
                <button
                  type="button"
                  className="quiz-live-next-btn"
                  onClick={() => navigate(`/quizzes/${id}/repertoire`)}
                >
                  Ouvrir le répertoire des réponses
                </button>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default QuizLive;

