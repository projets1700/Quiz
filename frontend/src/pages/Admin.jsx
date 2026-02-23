/**
 * Page Admin : droits selon les rôles verrouillés.
 * - Créer / désactiver des comptes créateurs
 * - Promouvoir ou rétrograder un créateur
 * - Consulter toutes les statistiques globales
 * - Supprimer un quiz uniquement s'il n'est pas actif
 * Restrictions : ne peut pas modifier le contenu d'un quiz.
 */
import { useState, useEffect } from 'react';
import {
  getUsers,
  createCreator,
  deactivateCreator,
  activateCreator,
  promoteCreator,
  demoteAdmin,
  getGlobalStats,
  getAllQuizzes,
  deleteQuizAdmin,
} from '../services/adminService';
import { getUser, clearSession } from '../utils/sessionStorage';
import './Admin.css';

const MAX_ADMINS = 5;

function Admin() {
  const [user, setUser] = useState(null);
  const [usersData, setUsersData] = useState(null);
  const [stats, setStats] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('stats');
  const [createForm, setCreateForm] = useState({ email: '', password: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setUser(getUser() || null);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, statsRes, quizzesRes] = await Promise.all([
        getUsers(),
        getGlobalStats(),
        getAllQuizzes(),
      ]);
      setUsersData(usersRes);
      setStats(statsRes);
      setQuizzes(quizzesRes);
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      loadData();
    }
  }, [user?.role]);

  const handleLogout = () => {
    if (!window.confirm('Voulez-vous vraiment vous déconnecter ?')) return;
    clearSession();
    setUser(null);
    window.location.href = '/';
  };

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleCreateCreator = async (e) => {
    e.preventDefault();
    if (!createForm.email || !createForm.password) return;
    setCreating(true);
    setError('');
    try {
      await createCreator(createForm.email, createForm.password);
      showSuccess('Compte créateur créé');
      setCreateForm({ email: '', password: '' });
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur création');
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (u) => {
    if (!window.confirm(`Désactiver le compte de ${u.email} ? Il ne pourra plus se connecter.`)) return;
    try {
      await deactivateCreator(u.id);
      showSuccess('Compte désactivé');
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur');
    }
  };

  const handleActivate = async (u) => {
    try {
      await activateCreator(u.id);
      showSuccess('Compte réactivé');
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur');
    }
  };

  const handlePromote = async (u) => {
    try {
      await promoteCreator(u.id);
      showSuccess('Créateur promu administrateur');
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur');
    }
  };

  const handleDemote = async (u) => {
    try {
      await demoteAdmin(u.id);
      showSuccess('Administrateur rétrogradé en créateur');
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur');
    }
  };

  const handleDeleteQuiz = async (q) => {
    if (q.state === 'actif' || q.state === 'ouvert') {
      setError('Impossible de supprimer un quiz actif ou ouvert');
      return;
    }
    if (!window.confirm(`Supprimer le quiz « ${q.title } » ?`)) return;
    try {
      await deleteQuizAdmin(q.id);
      showSuccess('Quiz supprimé');
      loadData();
    } catch (err) {
      setError(err.message || 'Erreur suppression');
    }
  };

  if (loading && !usersData) {
    return (
      <div className="admin-page">
        <header className="admin-header">
          <h1>Administration</h1>
        </header>
        <div className="admin-loading">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Administration</h1>
        <nav className="admin-header-nav">
          <span className="admin-user-info">Admin : {user?.email}</span>
          <button type="button" onClick={handleLogout} className="admin-btn-logout admin-btn-danger">
            Déconnexion
          </button>
        </nav>
      </header>

      <main className="admin-main">
        {error && <div className="admin-error">{error}</div>}
        {success && <div className="admin-success">{success}</div>}

        <nav className="admin-tabs">
          <button
            type="button"
            className={activeTab === 'stats' ? 'admin-tab active' : 'admin-tab'}
            onClick={() => setActiveTab('stats')}
          >
            Statistiques
          </button>
          <button
            type="button"
            className={activeTab === 'creators' ? 'admin-tab active' : 'admin-tab'}
            onClick={() => setActiveTab('creators')}
          >
            Comptes créateurs
          </button>
          <button
            type="button"
            className={activeTab === 'admins' ? 'admin-tab active' : 'admin-tab'}
            onClick={() => setActiveTab('admins')}
          >
            Administrateurs
          </button>
          <button
            type="button"
            className={activeTab === 'quizzes' ? 'admin-tab active' : 'admin-tab'}
            onClick={() => setActiveTab('quizzes')}
          >
            Quiz (suppression)
          </button>
        </nav>

        {activeTab === 'stats' && stats && (
          <section className="admin-section admin-section--stats">
            <h2>Statistiques globales</h2>
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <span className="admin-stat-value">{stats.totalQuizzes}</span>
                <span className="admin-stat-label">Quiz créés</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-value">{stats.totalQuestions}</span>
                <span className="admin-stat-label">Questions</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-value">{stats.totalSessions}</span>
                <span className="admin-stat-label">Sessions</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-value">{stats.totalParticipants}</span>
                <span className="admin-stat-label">Participants</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-value">{stats.activeQuizzes}</span>
                <span className="admin-stat-label">Quiz actifs</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-value">{stats.creatorCount}</span>
                <span className="admin-stat-label">Créateurs actifs</span>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-value">{stats.adminCount}</span>
                <span className="admin-stat-label">Administrateurs</span>
              </div>
            </div>

            {stats.quizStats && stats.quizStats.length > 0 && (
              <>
                <h3 className="admin-stats-subtitle">Statistiques globales par quiz et par créateur</h3>
                <div className="admin-stats-table-wrap">
                  <table className="admin-stats-table">
                    <thead>
                      <tr>
                        <th>Créateur</th>
                        <th>Quiz</th>
                        <th>Participants</th>
                        <th>Taux participation</th>
                        <th>Bonnes réponses</th>
                        <th>Mauvaises réponses</th>
                        <th>Sessions</th>
                        <th>Questions</th>
                        <th>État</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...stats.quizStats]
                        .sort((a, b) => (a.creator_email || '').localeCompare(b.creator_email || ''))
                        .map((qs) => (
                          <tr key={qs.quiz_id}>
                            <td>{qs.creator_email}</td>
                            <td>{qs.quiz_title}</td>
                            <td>{qs.total_participants}</td>
                            <td>{qs.participation_rate} %</td>
                            <td>{qs.correct_percent} %</td>
                            <td>{qs.incorrect_percent} %</td>
                            <td>{qs.session_count}</td>
                            <td>{qs.question_count}</td>
                            <td>{qs.quiz_state}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === 'creators' && usersData && (
          <section className="admin-section">
            <h2>Gestion des comptes créateurs</h2>
            <p className="admin-section-note">Créer, désactiver ou réactiver des comptes créateurs. Promouvoir un créateur en admin (max {MAX_ADMINS}).</p>

            <form onSubmit={handleCreateCreator} className="admin-create-form">
              <input
                type="email"
                placeholder="Email du créateur"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Mot de passe (min 8 caractères)"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                minLength={8}
                required
              />
              <span className="admin-btn-create-wrap">
              <button type="submit" className="admin-btn-create" disabled={creating || !createForm.email || !createForm.password}>
                {creating ? 'Création…' : 'Créer un compte créateur'}
              </button>
            </span>
            </form>

            <ul className="admin-user-list">
              {usersData.creators.map((u) => (
                <li key={u.id} className={`admin-user-item ${u.disabled ? 'disabled' : ''}`}>
                  <span className="admin-user-email">{u.email}</span>
                  <span className="admin-user-meta">
                    {u.disabled ? 'Désactivé' : 'Actif'} • {u.quiz_count ?? 0} quiz
                  </span>
                  <div className="admin-user-actions">
                    {u.disabled ? (
                      <button type="button" onClick={() => handleActivate(u)} className="admin-btn-small">
                        Réactiver
                      </button>
                    ) : (
                      <button type="button" onClick={() => handleDeactivate(u)} className="admin-btn-small admin-btn-danger">
                        Désactiver
                      </button>
                    )}
                    {usersData.adminCount < MAX_ADMINS && (
                      <span className="admin-btn-promote-wrap">
                        <button type="button" onClick={() => handlePromote(u)} className="admin-btn-small admin-btn-promote">
                          Promouvoir admin
                        </button>
                      </span>
                    )}
                  </div>
                </li>
              ))}
              {usersData.creators.length === 0 && <li className="admin-empty">Aucun créateur</li>}
            </ul>
          </section>
        )}

        {activeTab === 'admins' && usersData && (
          <section className="admin-section">
            <h2>Administrateurs ({usersData.adminCount}/{MAX_ADMINS})</h2>
            <p className="admin-section-note">Rétrograder un admin en créateur (sauf vous-même).</p>
            <ul className="admin-user-list">
              {usersData.admins.map((u) => (
                <li key={u.id} className="admin-user-item">
                  <span className="admin-user-email">{u.email}</span>
                  <span className="admin-user-meta">Admin</span>
                  <div className="admin-user-actions">
                    {u.id !== user?.id && (
                      <button type="button" onClick={() => handleDemote(u)} className="admin-btn-small">
                        Rétrograder en créateur
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {activeTab === 'quizzes' && (
          <section className="admin-section">
            <h2>Suppression de quiz</h2>
            <p className="admin-section-note">Les quiz actifs ou ouverts ne peuvent pas être supprimés.</p>
            <ul className="admin-quiz-list">
              {quizzes.map((q) => (
                <li key={q.id} className="admin-quiz-item">
                  <div className="admin-quiz-info">
                    <span className="admin-quiz-title">{q.title}</span>
                    <span className="admin-quiz-meta">
                      {q.creator_email} • {q.question_count} questions • {q.state}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuiz(q)}
                    disabled={q.state === 'actif' || q.state === 'ouvert'}
                    className="admin-btn-small admin-btn-danger"
                    title={q.state === 'actif' || q.state === 'ouvert' ? 'Quiz actif ou ouvert : suppression impossible' : 'Supprimer'}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
              {quizzes.length === 0 && <li className="admin-empty">Aucun quiz</li>}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

export default Admin;
