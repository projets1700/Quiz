/**
 * Page Participant – Jeu en cours (Jours 16–21)
 * Timer côté serveur (GET state), affichage question, envoi réponse, classement en fin.
 * Restauration après refresh via token (Jour 20).
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getParticipantToken,
  getState,
  respond,
  getRanking,
  clearParticipantSession,
} from '../services/participantService';
import './PlayQuiz.css';

function PlayQuiz() {
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [ranking, setRanking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [selectedMultiple, setSelectedMultiple] = useState([]);
  const [openAnswer, setOpenAnswer] = useState('');
  /** Feedback entre les questions : correct/incorrect + points (style Kahoot) */
  const [feedbackResult, setFeedbackResult] = useState(null);
  /** Nombre de bonnes réponses cumulées (boost flammes "je suis chaud") */
  const [goodAnswersCount, setGoodAnswersCount] = useState(0);
  const hasReceivedQuestionRef = useRef(false);
  const fetchedWhenTimerZeroRef = useRef(null);
  /** Dernière question à laquelle le joueur a répondu (pour afficher la page score si chrono dépassé sans réponse) */
  const lastAnsweredPositionRef = useRef(0);

  const applyState = (s, prev) => s;

  useEffect(() => {
    if (state && state.question) {
      setSubmitted(false);
      setSelectedAnswer(null);
      setSelectedMultiple([]);
      setOpenAnswer('');
      setFeedbackResult(null);
    }
  }, [state && state.question && state.question.id]);

  // On laisse l'écran de feedback affiché jusqu'à l'arrivée de la prochaine question ou la fin du quiz
  useEffect(() => {
    if (!feedbackResult) return;
    // Rien à faire ici pour le moment : l'effet existe pour pouvoir évoluer (analytics, sons, etc.)
  }, [feedbackResult]);

  // Au montage : vérifier le token participant, charger l'état (question courante ou finished)
  useEffect(() => {
    if (!getParticipantToken()) {
      navigate('/join', { replace: true });
      return;
    }
    let cancelled = false;
    let safetyTimeoutId = null;
    const clearSafetyTimeout = () => {
      if (safetyTimeoutId) {
        clearTimeout(safetyTimeoutId);
        safetyTimeoutId = null;
      }
    };
    const loadState = (retryCount = 0) => {
      const maxRetriesNoQuestion = 3;
      const maxRetriesFinished = 2;
      getState()
        .then((s) => {
          if (cancelled) return;
          clearSafetyTimeout();
          if (import.meta.env.DEV) console.log('[PlayQuiz] getState', { finished: s.finished, hasQuestion: !!s.question, pos: s.current_question_position, total_questions: s.total_questions });
          if (s.question) hasReceivedQuestionRef.current = true;
          const totalQ = s.total_questions ?? 0;
          const finishedWithoutQuestion = s.finished && !s.question && totalQ > 0;
          const activeWithoutQuestion = !s.finished && totalQ > 0 && !s.question;
          if (finishedWithoutQuestion && retryCount < maxRetriesFinished) {
            return new Promise((r) => setTimeout(r, 500)).then(() => loadState(retryCount + 1));
          }
          if (activeWithoutQuestion && retryCount < maxRetriesNoQuestion) {
            return new Promise((r) => setTimeout(r, 400)).then(() => getState()).then((s2) => {
              if (cancelled) return;
              clearSafetyTimeout();
              if (s2.question) hasReceivedQuestionRef.current = true;
              setState((prev) => applyState(s2, prev));
              setLoading(false);
              setError('');
            });
          }
          setState((prev) => applyState(s, prev));
          setLoading(false);
          setError('');
          if (s.finished && s.ranking_enabled) {
            return getRanking().then((r) => { if (!cancelled) setRanking(r); });
          }
        })
        .catch((e) => {
          if (!cancelled) {
            clearSafetyTimeout();
            const msg = e.name === 'AbortError' ? 'Le serveur ne répond pas. Vérifiez que le backend est démarré (npm run dev dans backend/).' : (e.message || 'Erreur réseau');
            setError(msg);
            setLoading(false);
            if (e.message && e.message.includes('expiré')) clearParticipantSession();
          }
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    loadState();
    safetyTimeoutId = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setError((e) => (e ? e : 'Chargement trop long. Vérifiez que le backend est démarré (npm run dev dans backend/) et réessayez.'));
      }
    }, 15000);
    return () => { cancelled = true; clearSafetyTimeout(); };
  }, [navigate]);

  // En attente du démarrage ou chargement question : poll getState toutes les 2 s
  useEffect(() => {
    if (!state || state.finished || state.question || !getParticipantToken()) return;
    if ((state.total_questions ?? 0) === 0 && !state.waiting_for_start) return;
    const t = setInterval(() => {
      getState()
        .then((s) => {
          if (s.question) hasReceivedQuestionRef.current = true;
          setState((prev) => applyState(s, prev));
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, [state?.question, state?.finished, state?.total_questions, state?.waiting_for_start]);

  // Quand le chrono atteint 0 sans réponse : afficher l'écran de feedback avec 0 pt pour cette question
  useEffect(() => {
    if (!state?.question || state.finished || !state.current_question_position) return;
    if (remainingSeconds == null || remainingSeconds > 0) return;
    const P = Number(state.current_question_position);
    if (P <= 0) return;
    // Si le joueur a déjà répondu pour cette question (ou qu'on a déjà affiché un feedback), on ne refait rien
    if (lastAnsweredPositionRef.current >= P) return;
    lastAnsweredPositionRef.current = P;
    setFeedbackResult({
      is_correct: false,
      points_earned: 0,
      total_score: undefined,
      correct_answer: null,
      is_ouverte: state.question.type === 'ouverte',
      question_id: state.question.id,
    });
  }, [remainingSeconds, state?.question?.id, state?.current_question_position, state?.finished]);

  // Timer affiché : remaining_seconds du serveur (calcul PostgreSQL, pas de décalage d'horloge), décompte local chaque seconde
  useEffect(() => {
    if (!state || state.finished || !state.question) {
      setRemainingSeconds(null);
      return;
    }
    const rawRem = state.remaining_seconds;
    const serverRemaining =
      typeof rawRem === 'number' && Number.isFinite(rawRem) && rawRem >= 0
        ? rawRem
        : (typeof rawRem === 'string' ? parseInt(rawRem, 10) : NaN);
    const useServer = !Number.isNaN(serverRemaining) && serverRemaining >= 0;

    const duration = Math.max(5, Math.min(120, parseInt(state.question_duration_seconds, 10) || 30));
    const rawStarted = state.question_started_at;
    const startedAt = rawStarted ? new Date(rawStarted).getTime() : Date.now();

    if (useServer) {
      setRemainingSeconds(serverRemaining);
      const interval = setInterval(() => {
        setRemainingSeconds((prev) => (prev != null && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
    // Fallback si le serveur n'envoie pas remaining_seconds (décompte côté client)
    const tick = () => {
      const elapsed = (Date.now() - startedAt) / 1000;
      setRemainingSeconds(Math.max(0, Math.ceil(duration - elapsed)));
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [state?.current_question_position, state?.question_started_at, state?.question_duration_seconds, state?.remaining_seconds, state?.question?.id]);

  // Dès que le quiz passe en "terminé", on masque l'écran de feedback pour afficher directement le podium
  useEffect(() => {
    if (state && state.finished) {
      setFeedbackResult(null);
    }
  }, [state && state.finished]);

  // Poll toutes les 2 s quand une question est affichée : si tout le monde a répondu, le serveur avance et on reçoit la question suivante (chrono s’arrête côté client)
  useEffect(() => {
    if (!state?.question || state.finished || !getParticipantToken()) return;
    const currentPos = state.current_question_position;
    const currentQuestionId = state.question?.id;
    const t = setInterval(() => {
      getState()
        .then((s) => {
          if (s.finished || (s.current_question_position !== currentPos) || (s.question?.id !== currentQuestionId)) {
            if (s.question) hasReceivedQuestionRef.current = true;
            setState((prev) => applyState(s, prev));
            if (s.finished && s.ranking_enabled) getRanking().then(setRanking).catch(() => {});
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, [state?.question?.id, state?.current_question_position, state?.finished]);

  // Quand le timer atteint 0 : getState pour la question suivante. Si le serveur n'a pas avancé, on repoll toutes les 2 s (max 15 fois).
  useEffect(() => {
    if (!state?.question || state.finished || remainingSeconds !== 0) return;
    const pos = state.current_question_position;
    if (fetchedWhenTimerZeroRef.current === pos) return;

    let cancelled = false;
    let attempt = 0;
    let timeoutId = null;
    const maxAttempts = 15;

    const fetchNext = () => {
      if (cancelled || attempt >= maxAttempts) return;
      attempt += 1;
      getState()
        .then((s) => {
          if (cancelled) return;
          const advanced = s.finished || (s.current_question_position != null && s.current_question_position !== pos);
          if (advanced) {
            fetchedWhenTimerZeroRef.current = pos;
            if (s.question) hasReceivedQuestionRef.current = true;
            setState((prev) => applyState(s, prev));
            if (s.finished && s.ranking_enabled) getRanking().then(setRanking).catch(() => {});
            return;
          }
          setState((prev) => applyState(s, prev));
          if (!cancelled && attempt < maxAttempts) timeoutId = setTimeout(fetchNext, 2000);
        })
        .catch(() => {
          if (!cancelled && attempt < maxAttempts) timeoutId = setTimeout(fetchNext, 2000);
        });
    };

    fetchedWhenTimerZeroRef.current = pos;
    fetchNext();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [state?.question, state?.finished, state?.current_question_position, remainingSeconds]);

  useEffect(() => {
    if (state && state.finished && state.ranking_enabled && !ranking) {
      getRanking().then(setRanking).catch(() => {});
    }
  }, [state && state.finished, state && state.ranking_enabled, ranking]);

  /** Envoi de la réponse (POST respond) : selon le type de question (qcm-unique, qcm-multiple, vrai-faux, ouverte) */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!state || !state.question || submitted) return;
    let answer = null;
    if (state.question.type === 'qcm-unique') answer = selectedAnswer;
    else if (state.question.type === 'qcm-multiple') answer = selectedMultiple;
    else if (state.question.type === 'vrai-faux') answer = selectedAnswer === true || selectedAnswer === 'true';
    else if (state.question.type === 'ouverte') answer = openAnswer != null ? String(openAnswer).trim() : '';
    if (answer === null && state.question.type !== 'ouverte') return;
    setError('');
    try {
      const data = await respond(state.question.id, answer);
      setSubmitted(true);
      lastAnsweredPositionRef.current = state.question.position;
      const isOuv = state.question.type === 'ouverte';
      if (data.is_correct && !isOuv) setGoodAnswersCount((prev) => prev + 1);
      setFeedbackResult({
        is_correct: data.is_correct,
        points_earned: data.points_earned ?? 0,
        speed_bonus_earned: data.speed_bonus_earned ?? 0,
        total_score: data.total_score ?? 0,
        correct_answer: data.correct_answer,
        is_ouverte: isOuv,
        question_id: state.question.id,
      });
      try {
        const nextState = await getState();
        setState(nextState);
        if (nextState.finished && nextState.ranking_enabled) {
          getRanking().then(setRanking).catch(() => {});
        }
      } catch (_) {}
    } catch (e) {
      setError(e.message);
    }
  };

  const handleLeave = () => {
    clearParticipantSession();
    navigate('/', { replace: true });
  };

  const handleJoinAnother = () => {
    clearParticipantSession();
    navigate('/join', { replace: true });
  };

  if (loading) {
    return <div className="play-quiz-page"><div className="play-quiz-loading">Chargement…</div></div>;
  }
  if (error && !state) {
    return (
      <div className="play-quiz-page">
        <div className="play-quiz-error">{error}</div>
        <div className="play-quiz-finished-actions" style={{ marginTop: '1rem', gap: '0.5rem' }}>
          <button
            type="button"
            className="play-quiz-btn-join-another"
            onClick={() => {
              setError('');
              setLoading(true);
              getState()
                .then((s) => { setState(s); setLoading(false); })
                .catch((e) => { setError(e.message); setLoading(false); });
            }}
          >
            Réessayer
          </button>
          <button type="button" onClick={() => navigate('/join')}>Rejoindre avec un autre code</button>
        </div>
      </div>
    );
  }

  const q = state && state.question;
  /* Écran feedback entre deux questions (style Kahoot) – avant "Quiz terminé" pour afficher le feedback après la dernière question */
  if (feedbackResult) {
    const { is_correct, points_earned, speed_bonus_earned, correct_answer, is_ouverte } = feedbackResult;
    const screenClass = is_ouverte ? 'neutral' : is_correct ? 'correct' : 'incorrect';
    return (
      <div className={`play-quiz-feedback-screen ${screenClass}`}>
        <div className="play-quiz-feedback-icon" aria-hidden="true">
          {is_ouverte ? '✏️' : is_correct ? '✅' : '❌'}
        </div>
        <h2 className="play-quiz-feedback-title">
          {is_ouverte ? 'Réponse enregistrée' : is_correct ? 'Bonne réponse !' : 'Mauvaise Réponse'}
        </h2>
        {!is_ouverte && points_earned > 0 && (
          <p className="play-quiz-feedback-points">+{points_earned} pt{points_earned !== 1 ? 's' : ''}</p>
        )}
        {!is_ouverte && speed_bonus_earned > 0 && (
          <p className="play-quiz-feedback-bonus">Vous avez obtenu {speed_bonus_earned} point{speed_bonus_earned !== 1 ? 's' : ''} de bonus</p>
        )}
        {!is_ouverte && is_correct && goodAnswersCount > 0 && (
          <div className="play-quiz-boost-flames" aria-hidden="true">
            <span className="play-quiz-boost-count">{goodAnswersCount} bonne{goodAnswersCount !== 1 ? 's' : ''} réponse{goodAnswersCount !== 1 ? 's' : ''}</span>
            <span className="play-quiz-boost-fire">🔥</span>
            {goodAnswersCount >= 2 && <span className="play-quiz-boost-hot">Je suis chaud !</span>}
          </div>
        )}
        {!is_ouverte && !is_correct && correct_answer != null && correct_answer !== '' && (
          <p className="play-quiz-feedback-answer">
            Bonne réponse : {Array.isArray(correct_answer)
              ? correct_answer.join(', ')
              : correct_answer === true || correct_answer === 'true'
                ? 'Vrai'
                : correct_answer === false || correct_answer === 'false'
                  ? 'Faux'
                  : String(correct_answer)}
          </p>
        )}
        <p className="play-quiz-feedback-next">
          {state && state.finished ? 'Quiz terminé !' : 'Prochaine question…'}
        </p>
      </div>
    );
  }

  if (state && state.finished) {
    const neverGotQuestion = !hasReceivedQuestionRef.current;
    const noQuestionsInQuiz = (state.total_questions ?? 0) === 0;
    if (neverGotQuestion || noQuestionsInQuiz) {
      return (
        <div className="play-quiz-page">
          <div className="play-quiz-finished play-quiz-rejoin-prompt">
            <h1>Rejoindre un quiz</h1>
            <p className="play-quiz-rejoin-text">
              {noQuestionsInQuiz
                ? 'Cette session n\'a pas de questions ou est invalide.'
                : 'Vous avez rejoint une session déjà terminée ou vous utilisez un ancien code.'}
              <br />
              <strong>Pour jouer :</strong> cliquez ci-dessous puis entrez le code affiché par l&apos;animateur <strong>juste après</strong> qu&apos;il ait cliqué sur &quot;Lancer&quot;.
            </p>
            <div className="play-quiz-finished-actions">
              <button type="button" className="play-quiz-btn-join-another" onClick={handleJoinAnother}>Rejoindre un quiz</button>
              <button type="button" className="play-quiz-leave" onClick={handleLeave}>Retour à l&apos;accueil</button>
            </div>
          </div>
        </div>
      );
    }
    const myRank = ranking?.ranking?.find((r) => r.is_me);
    const myResult = ranking?.my_result;
    const top3 = ranking?.ranking?.slice(0, 3) ?? [];
    const rankOrdinal = myResult?.rank != null ? (myResult.rank === 1 ? '1er' : `${myResult.rank}e`) : null;
    const isTop3 = myResult?.rank != null && myResult.rank <= 3;
    const encouragementMsg = myResult?.rank === 1
      ? 'Bravo, vous êtes premier !'
      : isTop3
        ? 'Vous êtes sur le podium !'
        : myResult?.rank != null
          ? 'Bien joué ! Continuez comme ça.'
          : 'Merci d\'avoir joué !';
    const fireworkPositions = [
      { left: '15%', top: '18%' },
      { left: '88%', top: '22%' },
      { left: '50%', top: '12%' },
      { left: '22%', top: '72%' },
      { left: '78%', top: '68%' },
      { left: '50%', top: '88%' },
      { left: '35%', top: '35%' },
      { left: '65%', top: '55%' },
      { left: '10%', top: '60%' },
      { left: '92%', top: '75%' },
    ];
    const particleCount = 14;
    return (
      <div className="play-quiz-page play-quiz-finished-page">
        <div className="play-quiz-fireworks" aria-hidden="true">
          {fireworkPositions.map((pos, i) => (
            <div
              key={i}
              className="play-quiz-firework"
              style={{
                left: pos.left,
                top: pos.top,
                animationDelay: `${i * 0.28}s`,
              }}
            >
              {Array.from({ length: particleCount }, (_, j) => (
                <span key={j} className="play-quiz-firework-particle" style={{ '--angle': `${(360 / particleCount) * j}deg` }} />
              ))}
            </div>
          ))}
        </div>
        <div className="play-quiz-finished">
          <h1 className="play-quiz-finished-title">Quiz terminé</h1>
          {myResult && (
            <div className="play-quiz-my-result">
              <p className="play-quiz-my-score">
                Vous êtes {rankOrdinal}. Vous avez obtenu {myResult.total_score} point{myResult.total_score !== 1 ? 's' : ''}.
              </p>
              {myResult.rank > 1 && myResult.points_to_next_rank != null && myResult.points_to_next_rank > 0 && (
                <p className="play-quiz-points-to-next">
                  Il vous manque {myResult.points_to_next_rank} point{myResult.points_to_next_rank !== 1 ? 's' : ''} pour atteindre la {myResult.rank - 1 === 1 ? '1re' : `${myResult.rank - 1}e`} place.
                </p>
              )}
              <p className="play-quiz-encouragement">{encouragementMsg}</p>
            </div>
          )}
          {!myResult && myRank && <p className="play-quiz-my-score">Votre score : {myRank.total_score} pt{myRank.total_score !== 1 ? 's' : ''}</p>}
          {!myResult && <p className="play-quiz-encouragement">Merci d&apos;avoir joué !</p>}
          {state.ranking_enabled && ranking && ranking.ranking_enabled && ranking.ranking.length > 0 && (
            <div className="play-quiz-ranking">
              <h2>Classement final</h2>
              {top3.length > 0 && (
                <div className="play-quiz-podium play-quiz-podium-animated">
                  {top3[1] && <div className="play-quiz-podium-item second"><span className="play-quiz-podium-rank">2</span><span className="play-quiz-podium-name">{top3[1].pseudo}</span><span className="play-quiz-podium-score">{top3[1].total_score} pts</span></div>}
                  {top3[0] && <div className="play-quiz-podium-item first"><span className="play-quiz-podium-rank">1</span><span className="play-quiz-podium-name">{top3[0].pseudo}</span><span className="play-quiz-podium-score">{top3[0].total_score} pts</span></div>}
                  {top3[2] && <div className="play-quiz-podium-item third"><span className="play-quiz-podium-rank">3</span><span className="play-quiz-podium-name">{top3[2].pseudo}</span><span className="play-quiz-podium-score">{top3[2].total_score} pts</span></div>}
                </div>
              )}
              <ol className="play-quiz-ranking-list">
                {ranking.ranking.map((r) => (
                  <li key={r.rank} className={r.is_me ? 'play-quiz-me' : ''}>
                    {r.rank}. {r.pseudo} – {r.total_score} pt{r.total_score !== 1 ? 's' : ''}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="play-quiz-finished-actions">
            <button type="button" className="play-quiz-btn-join-another" onClick={handleJoinAnother}>Rejoindre un autre quiz</button>
            <button type="button" className="play-quiz-leave" onClick={handleLeave}>Retour à l'accueil</button>
          </div>
        </div>
      </div>
    );
  }

  if (state && state.waiting_for_start) {
    return (
      <div className="play-quiz-waiting-screen">
        <header className="play-quiz-header">
          <span />
          <button type="button" className="play-quiz-btn-leave" onClick={handleLeave} title="Quitter le quiz">Quitter</button>
        </header>
        <div className="play-quiz-waiting-bg-shapes" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="play-quiz-waiting-shape" />)}
        </div>
        <div className="play-quiz-waiting-content">
          <div className="play-quiz-waiting-icon" aria-hidden="true">🎮</div>
          <h1 className="play-quiz-waiting-title">Prêt à jouer ?</h1>
          <p className="play-quiz-waiting-subtitle">Vous êtes connecté au quiz</p>
          <div className="play-quiz-waiting-box">
            <p className="play-quiz-waiting-hint">
              En attente du lancement par l&apos;animateur…<br />
              <strong>Il va cliquer sur «&nbsp;Lancé&nbsp;»</strong> pour démarrer la première question.
            </p>
          </div>
          {state.participants && state.participants.length > 0 && (
            <div className="play-quiz-waiting-players">
              <h2 className="play-quiz-waiting-players-title">Joueurs connectés ({state.participants.length})</h2>
              <ul className="play-quiz-waiting-players-list">
                {state.participants.map((p, i) => (
                  <li key={p.pseudo ? `${p.pseudo}-${i}` : i} className="play-quiz-waiting-player">{p.pseudo || 'Anonyme'}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!q) {
    const isLoadingQuestion = state && !state.finished && (state.total_questions ?? 0) > 0;
    return (
      <div className="play-quiz-page">
        <div className="play-quiz-loading">
          {isLoadingQuestion ? 'Chargement de la question…' : 'En attente de la prochaine question…'}
        </div>
        {isLoadingQuestion && (
          <>
            <p style={{ marginTop: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>
              Si rien ne s&apos;affiche, le backend est-il démarré ? (npm run dev dans <code>backend/</code>)
            </p>
            <button
              type="button"
              className="play-quiz-btn-join-another"
              style={{ marginTop: '1rem' }}
              onClick={() => {
                setLoading(true);
                setError('');
                getState()
                  .then((s) => {
                    setState((prev) => applyState(s, prev));
                    setLoading(false);
                  })
                  .catch((e) => { setError(e.message); setLoading(false); });
              }}
            >
              Réessayer
            </button>
          </>
        )}
      </div>
    );
  }

  const duration = Math.max(5, Math.min(120, parseInt(state.question_duration_seconds, 10) || 30));
  const timerClass = remainingSeconds != null
    ? remainingSeconds > duration * 0.4
      ? 'play-quiz-timer-ok'
      : remainingSeconds > duration * 0.2
        ? 'play-quiz-timer-warn'
        : 'play-quiz-timer-urgent'
    : '';

  return (
    <div className="play-quiz-page">
      <div className="play-quiz-progress-wrap">
        <div className="play-quiz-progress-bar" style={{ width: `${((state.current_question_position || 1) / (state.total_questions || 1)) * 100}%` }} />
        <span className="play-quiz-progress-text">Question {state.current_question_position} / {state.total_questions}</span>
      </div>
      <header className="play-quiz-header">
        {goodAnswersCount > 0 && (
          <div className="play-quiz-boost-badge" aria-hidden="true">
            <span className="play-quiz-boost-fire">🔥</span>
            <span className="play-quiz-boost-count">{goodAnswersCount}</span>
            {goodAnswersCount >= 2 && <span className="play-quiz-boost-hot">Je suis chaud !</span>}
          </div>
        )}
        <span className={`play-quiz-timer ${timerClass}`}>{remainingSeconds != null ? remainingSeconds : '–'} s</span>
        <button type="button" className="play-quiz-btn-leave" onClick={handleLeave} title="Quitter le quiz">Quitter</button>
      </header>
      <main className="play-quiz-main">
        {q.media_type && q.media_url && (
          <div className="play-quiz-media">
            {q.media_type === 'image' ? (
              <img src={q.media_url} alt="" className="play-quiz-media-img" />
            ) : (
              <div className="play-quiz-media-video-wrap">
                <iframe
                  src={q.media_url}
                  title="Vidéo"
                  className="play-quiz-media-video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        )}
        <h2 className="play-quiz-question-text">{q.question ?? 'Question'}</h2>
        <form onSubmit={handleSubmit} className="play-quiz-form">
          {q.type === 'qcm-unique' && q.options && (
            <ul className="play-quiz-options">
              {q.options.map((opt, i) => (
                <li key={i}>
                  <label>
                    <input
                      type="radio"
                      name="choice"
                      checked={selectedAnswer === opt}
                      onChange={() => setSelectedAnswer(opt)}
                      disabled={submitted}
                    />
                    {opt}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {q.type === 'qcm-multiple' && q.options && (
            <ul className="play-quiz-options">
              {q.options.map((opt, i) => (
                <li key={i}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedMultiple.includes(opt)}
                      onChange={() => setSelectedMultiple((prev) => prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt])}
                      disabled={submitted}
                    />
                    {opt}
                  </label>
                </li>
              ))}
            </ul>
          )}
          {q.type === 'vrai-faux' && (
            <ul className="play-quiz-options">
              <li>
                <label>
                  <input type="radio" name="vf" checked={selectedAnswer === true} onChange={() => setSelectedAnswer(true)} disabled={submitted} />
                  Vrai
                </label>
              </li>
              <li>
                <label>
                  <input type="radio" name="vf" checked={selectedAnswer === false} onChange={() => setSelectedAnswer(false)} disabled={submitted} />
                  Faux
                </label>
              </li>
            </ul>
          )}
          {q.type === 'ouverte' && (
            <div className="play-quiz-open-wrap">
              <textarea
                className="play-quiz-open-input"
                value={openAnswer}
                onChange={(e) => setOpenAnswer(e.target.value)}
                placeholder="Votre réponse..."
                rows={4}
                disabled={submitted}
              />
            </div>
          )}
          {submitted && <p className="play-quiz-submitted-feedback">Réponse enregistrée !</p>}
          {error && <div className="play-quiz-error">{error}</div>}
          <button type="submit" disabled={submitted}>Validé</button>
        </form>
      </main>
    </div>
  );
}

export default PlayQuiz;
