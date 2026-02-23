/**
 * Page édition quiz (Jours 9, 10, 12, 13)
 * Formulaire titre/description/état, liste des questions, ajout d'une question (QCM simple, multiple, Vrai/Faux).
 * Modifier / supprimer questions. Blocage si quiz actif.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getQuiz,
  updateQuiz,
  addQuestion,
  updateQuestion,
  deleteQuestion,
} from '../services/quizService';
import './QuizForm.css';
import './EditQuiz.css';

const QUESTION_TYPES = [
  { value: 'qcm-unique', label: 'QCM réponse unique' },
  { value: 'qcm-multiple', label: 'QCM réponses multiples' },
  { value: 'vrai-faux', label: 'Vrai / Faux' },
  { value: 'ouverte', label: 'Question ouverte (informatif, pas notée)' },
];
const STATE_LABELS = { brouillon: 'Brouillon', pret: 'Prêt', actif: 'Actif', termine: 'Terminé' };
const QUESTION_TYPE_LABELS = { 'qcm-unique': 'QCM unique', 'qcm-multiple': 'QCM multiple', 'vrai-faux': 'Vrai/Faux', ouverte: 'Ouverte' };
const MAX_QUESTIONS = 30;
const MIN_TIME = 5;
const MAX_TIME = 120;
const MIN_POINTS = 1;
const MAX_POINTS = 100;

function EditQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(null);

  // Champs du formulaire quiz (titre, description, état, classement, bonus rapidité)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState('brouillon');
  const [rankingEnabled, setRankingEnabled] = useState(true);
  const [speedBonusEnabled, setSpeedBonusEnabled] = useState(false);
  const [speedBonusPoints, setSpeedBonusPoints] = useState(10);
  const [speedBonusStepSeconds, setSpeedBonusStepSeconds] = useState(3);
  const [speedBonusPointsPerStep, setSpeedBonusPointsPerStep] = useState(1);

  // Formulaire d'ajout de question (type, énoncé, options, bonne(s) réponse(s), temps)
  const [newType, setNewType] = useState('qcm-unique');
  const [newQuestion, setNewQuestion] = useState('');
  const [newOptions, setNewOptions] = useState(['', '']);
  const [newCorrectSingle, setNewCorrectSingle] = useState(0);
  const [newCorrectMultiple, setNewCorrectMultiple] = useState([]);
  const [newCorrectVf, setNewCorrectVf] = useState(true);
  const [newTimeLimit, setNewTimeLimit] = useState(30);
  const [newPoints, setNewPoints] = useState(1);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState(null);

  // Blocage des modifications si le quiz est en cours (actif)
  const isLocked = quiz?.state === 'actif';

  // Nombre de questions existantes pour ce quiz (pour la règle des 1 question minimum)
  const questionCount = quiz?.questions?.length ?? 0;
  const canLeaveDraft = questionCount >= 1;

  // Chargement du quiz et des questions au montage
  useEffect(() => {
    let cancelled = false;
    getQuiz(id)
      .then((q) => {
        if (!cancelled) {
          setQuiz(q);
          setTitle(q.title || '');
          setDescription(q.description || '');
          setState(q.state || 'brouillon');
          setRankingEnabled(q.ranking_enabled !== false);
          setSpeedBonusEnabled(!!q.speed_bonus_enabled);
          setSpeedBonusPoints(q.speed_bonus_points ?? 10);
          setSpeedBonusStepSeconds(q.speed_bonus_step_seconds ?? 3);
          setSpeedBonusPointsPerStep(q.speed_bonus_points_per_step ?? 1);
        }
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // Pour QCM multiple : forcer 5 options ; pour les autres types : au moins 2
  useEffect(() => {
    if (newType === 'qcm-multiple') {
      setNewOptions((prev) => {
        const a = [...prev];
        while (a.length < 5) a.push('');
        return a.slice(0, 5);
      });
    } else {
      setNewOptions((prev) => (prev.length >= 2 ? prev : ['', '']));
    }
  }, [newType]);

  const handleSaveQuiz = async (e) => {
    e.preventDefault();
    if (isLocked) return;
    setError('');
    setSaving(true);
    try {
      const updated = await updateQuiz(id, {
        title: title.trim(),
        description: description.trim() || null,
        state,
        ranking_enabled: rankingEnabled,
        speed_bonus_enabled: speedBonusEnabled,
        speed_bonus_points: speedBonusEnabled ? Math.max(0, Math.min(100, speedBonusPoints)) : undefined,
        speed_bonus_step_seconds: speedBonusEnabled ? Math.max(1, Math.min(120, speedBonusStepSeconds)) : undefined,
        speed_bonus_points_per_step: speedBonusEnabled ? Math.max(0, Math.min(100, speedBonusPointsPerStep)) : undefined,
      });
      setQuiz((prev) => (prev ? { ...prev, ...updated } : updated));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addOption = () => {
    if (newOptions.length >= 5) return;
    setNewOptions((prev) => [...prev, '']);
  };
  const removeOption = (idx) => {
    if (newType === 'qcm-multiple' || newOptions.length <= 2) return;
    setNewOptions((prev) => prev.filter((_, i) => i !== idx));
  };
  const setOption = (idx, val) => {
    setNewOptions((prev) => prev.map((o, i) => (i === idx ? val : o)));
  };
  const optionsForMultiple = newType === 'qcm-multiple'
    ? Array.from({ length: 5 }, (_, i) => newOptions[i] ?? '')
    : newOptions;

  const getNewQuestionBody = () => {
    const question = newQuestion.trim();
    if (!question) return null;
    const timeLimit = Math.max(MIN_TIME, Math.min(MAX_TIME, newTimeLimit));
    const points = Math.max(MIN_POINTS, Math.min(MAX_POINTS, newPoints));
    const media = { media_type: null, media_url: null };
    if (newType === 'ouverte') {
      return { type: 'ouverte', question, time_limit_seconds: timeLimit, ...media };
    }
    if (newType === 'qcm-unique') {
      const opts = newOptions.filter(Boolean);
      if (opts.length < 2) return null;
      return { type: 'qcm-unique', question, options: opts, correct_answer: opts[newCorrectSingle], points, time_limit_seconds: timeLimit, ...media };
    }
    if (newType === 'qcm-multiple') {
      const opts = optionsForMultiple.map((o) => String(o).trim()).filter(Boolean);
      if (opts.length !== 5) return null;
      if (newCorrectMultiple.length < 1 || newCorrectMultiple.length > 5) return null;
      const correctVals = newCorrectMultiple.map((i) => optionsForMultiple[i]).filter((v) => v && String(v).trim());
      if (correctVals.length < 1) return null;
      return { type: 'qcm-multiple', question, options: opts, correct_answer: correctVals, points, time_limit_seconds: timeLimit, ...media };
    }
    if (newType === 'vrai-faux') {
      return { type: 'vrai-faux', question, correct_answer: newCorrectVf, points, time_limit_seconds: timeLimit, ...media };
    }
    return null;
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    if (isLocked) return;
    if ((quiz?.questions?.length ?? 0) >= MAX_QUESTIONS) {
      setError(`Maximum ${MAX_QUESTIONS} questions par quiz`);
      return;
    }
    setError('');
    setAdding(true);
    try {
      const body = getNewQuestionBody();
      if (!body) {
        setError(
          newType === 'qcm-multiple'
            ? 'QCM multiple : 5 options (toutes remplies) et 1 à 5 bonnes réponses.'
            : 'Remplissez tous les champs (au moins 2 options pour un QCM).'
        );
        setAdding(false);
        return;
      }
      const q = await addQuestion(id, body);
      setQuiz((prev) => (prev ? { ...prev, questions: [...(prev.questions || []), q] } : { questions: [q] }));
      setNewQuestion('');
      setNewOptions(newType === 'qcm-multiple' ? ['', '', '', '', ''] : ['', '']);
      setNewCorrectSingle(0);
      setNewCorrectMultiple([]);
      setNewCorrectVf(true);
      setNewTimeLimit(30);
      setNewPoints(1);
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const startEditingQuestion = (q) => {
    if (isLocked) return;
    setEditingId(q.id);
    setNewType(q.type);
    setNewQuestion(q.question || '');
    const opts = Array.isArray(q.options) ? q.options : [];
    if (q.type === 'qcm-multiple') {
      setNewOptions(Array.from({ length: 5 }, (_, i) => opts[i] ?? ''));
      const correctArr = Array.isArray(q.correct_answer) ? q.correct_answer.map(String) : (q.correct_answer != null ? [String(q.correct_answer)] : []);
      setNewCorrectMultiple(opts.map((o, i) => (correctArr.some((c) => String(o) === c) ? i : -1)).filter((i) => i >= 0));
    } else {
      setNewOptions(opts.length >= 2 ? opts : opts.length ? [...opts, ''] : ['', '']);
      const correctVal = q.correct_answer;
      const idx = opts.findIndex((o) => o === correctVal || String(o) === String(correctVal));
      setNewCorrectSingle(idx >= 0 ? idx : 0);
    }
    setNewCorrectVf(q.correct_answer === true || q.correct_answer === 'true');
    setNewTimeLimit(q.time_limit_seconds ?? 30);
    setNewPoints(Math.max(MIN_POINTS, Math.min(MAX_POINTS, q.points ?? 1)));
    setError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewType('qcm-unique');
    setNewQuestion('');
    setNewOptions(['', '']);
    setNewCorrectSingle(0);
    setNewCorrectMultiple([]);
    setNewCorrectVf(true);
    setNewTimeLimit(30);
    setNewPoints(1);
    setError('');
  };

  const handleSaveEditQuestion = async (e) => {
    e.preventDefault();
    if (isLocked || !editingId) return;
    setError('');
    setActioning(editingId);
    try {
      const body = getNewQuestionBody();
      if (!body) {
        setError(
          newType === 'qcm-multiple'
            ? 'QCM multiple : 5 options (toutes remplies) et 1 à 5 bonnes réponses.'
            : 'Remplissez tous les champs (au moins 2 options pour un QCM).'
        );
        setActioning(null);
        return;
      }
      const updated = await updateQuestion(id, editingId, body);
      setQuiz((prev) =>
        prev
          ? { ...prev, questions: (prev.questions || []).map((qu) => (qu.id === editingId ? { ...qu, ...updated } : qu)) }
          : prev
      );
      cancelEdit();
    } catch (e) {
      setError(e.message);
    } finally {
      setActioning(null);
    }
  };

  const handleDeleteQuestion = async (qid) => {
    if (isLocked) return;
    if (!window.confirm('Supprimer cette question ?')) return;
    if (editingId === qid) cancelEdit();
    setActioning(qid);
    try {
      await deleteQuestion(id, qid);
      setQuiz((prev) => (prev ? { ...prev, questions: (prev.questions || []).filter((qu) => qu.id !== qid) } : prev));
    } catch (e) {
      setError(e.message);
    } finally {
      setActioning(null);
    }
  };

  if (loading) return <div className="quiz-form-page"><div className="quiz-form-loading">Chargement…</div></div>;
  if (error && !quiz) return <div className="quiz-form-page"><div className="quiz-form-error">{error}</div><Link to="/quizzes">Retour</Link></div>;

  return (
    <div className="quiz-form-page">
      <header className="quiz-form-header quiz-form-header--edit">
        <h1>Éditer : {quiz?.title}</h1>
        <nav>
          <button
            type="submit"
            form="edit-quiz-form"
            disabled={isLocked || saving}
            className="quiz-form-btn-save"
            title="Enregistrer"
            aria-label="Enregistrer les modifications"
          >
            <svg className="quiz-form-save-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </button>
          <Link to="/quizzes" className="quiz-form-btn-mes-quiz">Mes quiz</Link>
        </nav>
      </header>
      <main className="quiz-form-main edit-quiz-main">
        {isLocked && <div className="edit-quiz-banner">Quiz actif – modifications et suppressions bloquées.</div>}
        {error && <div className="quiz-form-error">{error}</div>}

        <form id="edit-quiz-form" onSubmit={handleSaveQuiz} className="quiz-form-card">
          <h2 className="edit-quiz-info-title">Informations du quiz</h2>
          <div className="quiz-form-row">
            <label>Titre</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isLocked} required />
          </div>
          <div className="quiz-form-row">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={isLocked} rows={2} />
          </div>
          <div className="quiz-form-row quiz-form-row-state">
            <label>État</label>
            <select value={state} onChange={(e) => setState(e.target.value)} disabled={isLocked}>
              {Object.entries(STATE_LABELS).map(([k, v]) => (
                <option key={k} value={k} disabled={!canLeaveDraft && k !== 'brouillon'}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          {!canLeaveDraft && (
            <p className="edit-quiz-help">
              Un quiz doit contenir au moins 1 question pour pouvoir être lancé (quitter l&apos;état &quot;brouillon&quot;).
            </p>
          )}
          <label className="quiz-form-check">
            <input type="checkbox" checked={rankingEnabled} onChange={(e) => setRankingEnabled(e.target.checked)} disabled={isLocked} />
            Classement
          </label>
          <label className="quiz-form-check">
            <input type="checkbox" checked={speedBonusEnabled} onChange={(e) => setSpeedBonusEnabled(e.target.checked)} disabled={isLocked} />
            Bonus de rapidité
          </label>
          {speedBonusEnabled && (
            <>
              <div className="quiz-form-row quiz-form-row-bonus">
                <label>Points de bonus max</label>
                <input type="number" min={0} max={100} value={speedBonusPoints} onChange={(e) => setSpeedBonusPoints(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} disabled={isLocked} />
              </div>
              <div className="quiz-form-row quiz-form-row-bonus">
                <label>Seconde</label>
                <input type="number" min={1} max={120} value={speedBonusStepSeconds} onChange={(e) => setSpeedBonusStepSeconds(Math.max(1, Math.min(120, Number(e.target.value) || 3)))} disabled={isLocked} />
              </div>
              <div className="quiz-form-row quiz-form-row-bonus">
                <label>Points en moins par palier</label>
                <input type="number" min={0} max={100} value={speedBonusPointsPerStep} onChange={(e) => setSpeedBonusPointsPerStep(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} disabled={isLocked} />
              </div>
            </>
          )}
          <button type="submit" disabled={isLocked || saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </form>

        <section className="edit-quiz-questions">
          <div className="edit-quiz-questions-head">
            <h2>Questions ({quiz?.questions?.length ?? 0} / {MAX_QUESTIONS})</h2>
          </div>
          <ul className="edit-quiz-list">
            {(quiz?.questions || []).map((q) => (
              <li key={q.id} className="edit-quiz-question-item">
                <span className="edit-quiz-q-type">{QUESTION_TYPE_LABELS[q.type] ?? q.type}</span>
                {q.type !== 'ouverte' && (
                  <span className="edit-quiz-q-points">{q.points ?? 1} pt{(q.points ?? 1) !== 1 ? 's' : ''}</span>
                )}
                <span className="edit-quiz-q-text">{q.question}</span>
                {!isLocked && (
                  <>
                    <button type="button" className="btn-edit-q btn-icon" onClick={() => startEditingQuestion(q)} disabled={actioning === q.id} title="Modifier" aria-label="Modifier la question">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </button>
                    <button type="button" className="btn-delete-q btn-icon" onClick={() => handleDeleteQuestion(q.id)} disabled={actioning === q.id} title="Supprimer" aria-label="Supprimer la question">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          {!isLocked && ((quiz?.questions?.length ?? 0) < MAX_QUESTIONS || editingId) && (
            <form onSubmit={editingId ? handleSaveEditQuestion : handleAddQuestion} className="quiz-form-card add-question-form">
            <h3>{editingId ? 'Modifier la question' : 'Ajouter une question'}</h3>
            <label>Type</label>
            <select value={newType} onChange={(e) => setNewType(e.target.value)}>
              {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <label>Énoncé</label>
            <input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Énoncé de la question" required />
            {newType !== 'ouverte' && (
              <>
                <label>Points attribués à la question ({MIN_POINTS}–{MAX_POINTS})</label>
                <input type="number" min={MIN_POINTS} max={MAX_POINTS} value={newPoints} onChange={(e) => setNewPoints(Math.max(MIN_POINTS, Math.min(MAX_POINTS, Number(e.target.value) || 1)))} placeholder="Ex. 5" />
              </>
            )}
            <label>Temps par question (secondes, {MIN_TIME}–{MAX_TIME})</label>
            <input type="number" min={MIN_TIME} max={MAX_TIME} value={newTimeLimit} onChange={(e) => setNewTimeLimit(Number(e.target.value) || 30)} />

            {(newType === 'qcm-unique' || newType === 'qcm-multiple') && (
              <>
                <label>{newType === 'qcm-multiple' ? 'Options (5 obligatoires)' : 'Options (2 à 5)'}</label>
                {(newType === 'qcm-multiple' ? optionsForMultiple : newOptions).map((opt, idx) => (
                  <div key={idx} className="add-q-option-row">
                    <input
                      value={newType === 'qcm-multiple' ? optionsForMultiple[idx] : opt}
                      onChange={(e) => setOption(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                    />
                    {newType === 'qcm-unique' && <input type="radio" name="correctSingle" checked={newCorrectSingle === idx} onChange={() => setNewCorrectSingle(idx)} />}
                    {newType === 'qcm-multiple' && <input type="checkbox" checked={newCorrectMultiple.includes(idx)} onChange={() => setNewCorrectMultiple((prev) => prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx])} />}
                    {newType === 'qcm-unique' && newOptions.length > 2 && <button type="button" onClick={() => removeOption(idx)}>−</button>}
                  </div>
                ))}
                {newType === 'qcm-unique' && newOptions.length < 5 && <button type="button" onClick={addOption}>+ Option</button>}
                {newType === 'qcm-unique' && <span className="add-q-hint">Cochez la réponse correcte.</span>}
                {newType === 'qcm-multiple' && <span className="add-q-hint">Cochez de 1 à 5 bonnes réponses.</span>}
              </>
            )}

            {newType === 'vrai-faux' && (
              <>
                <label>Réponse correcte</label>
                <select value={newCorrectVf ? 'true' : 'false'} onChange={(e) => setNewCorrectVf(e.target.value === 'true')}>
                  <option value="true">Vrai</option>
                  <option value="false">Faux</option>
                </select>
              </>
            )}

            {newType === 'ouverte' && <p className="add-q-hint">Pas de notation automatique, exclue du classement. Affichée à titre informatif.</p>}

            <div className="add-q-actions">
              <button type="submit" disabled={adding || actioning}>
                {editingId ? 'Enregistrer les modifications' : 'Ajouter la question'}
              </button>
              {editingId && (
                <button type="button" className="btn-cancel-edit-q" onClick={cancelEdit} disabled={adding || actioning}>
                  Annuler
                </button>
              )}
            </div>
          </form>
          )}
          {!isLocked && (quiz?.questions?.length ?? 0) >= MAX_QUESTIONS && (
            <p className="edit-quiz-max">Maximum {MAX_QUESTIONS} questions atteint.</p>
          )}
        </section>
      </main>
    </div>
  );
}

export default EditQuiz;
