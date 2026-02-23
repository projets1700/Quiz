/**
 * Page création quiz (Jour 8)
 * Formulaire titre, description, état, classement → POST /api/v1/quizzes → redirection vers édition.
 * Les questions sont ajoutées sur la page EditQuiz.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createQuiz } from '../services/quizService';
import './QuizForm.css';

function CreateQuiz() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState('brouillon');
  const [rankingEnabled, setRankingEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  /** Soumission : création du quiz puis redirection vers /quizzes/:id/edit pour ajouter les questions */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Titre requis'); return; }
    setLoading(true);
    try {
      const quiz = await createQuiz({
        title: title.trim(),
        description: description.trim() || undefined,
        state,
        ranking_enabled: rankingEnabled,
      });
      navigate(`/quizzes/${quiz.id}/edit`, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="quiz-form-page">
      <header className="quiz-form-header">
        <h1>Nouveau quiz</h1>
        <Link to="/quizzes">Retour à la liste</Link>
      </header>
      <main className="quiz-form-main">
        <form onSubmit={handleSubmit} className="quiz-form-card">
          <label htmlFor="title">Titre</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du quiz" required disabled={loading} />
          <label htmlFor="description">Description</label>
          <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optionnel)" rows={3} disabled={loading} />
          <label htmlFor="state">État</label>
          <select id="state" value={state} onChange={(e) => setState(e.target.value)} disabled={loading}>
            <option value="brouillon">Brouillon</option>
            <option value="pret">Prêt</option>
          </select>
          <label className="quiz-form-check">
            <input type="checkbox" checked={rankingEnabled} onChange={(e) => setRankingEnabled(e.target.checked)} disabled={loading} />
            Classement
          </label>
          {error && <div className="quiz-form-error">{error}</div>}
          <button type="submit" disabled={loading}>{loading ? 'Création…' : 'Créer le quiz'}</button>
        </form>
      </main>
    </div>
  );
}

export default CreateQuiz;
