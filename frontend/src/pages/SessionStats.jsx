/**
 * Page Statistiques d'une session : représentation graphique (Participants, Temps moyen, Réussite).
 */

import { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
} from 'recharts';
import { getSessionStats } from '../services/quizService';
import './QuizStats.css';

const CHART_VIEWS = [
  { id: 'participants', label: 'Participant', icon: '👥' },
  { id: 'duree', label: 'Temps moyen', icon: '⌛' },
  { id: 'reussite', label: 'Réussite', icon: '✓' },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const fn = () => setIsMobile(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return isMobile;
}

function SessionStats() {
  const { id, sessionId } = useParams();
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartView, setChartView] = useState('reussite');

  const xAxisTickProps = useMemo(() => isMobile
    ? { fill: '#000', fontSize: 9, angle: -45, textAnchor: 'end' }
    : { fill: '#000', fontSize: 12 },
  [isMobile]);
  const chartMargin = useMemo(() => ({ top: 36, right: 40, left: 24, bottom: isMobile ? 55 : 12 }), [isMobile]);
  const reussiteXAxisTickProps = useMemo(() => ({ fill: '#000', fontSize: 10, angle: 0, textAnchor: 'middle' }), []);
  const reussiteChartMargin = useMemo(() => ({ top: 12, right: 30, left: 16, bottom: isMobile ? 90 : 70 }), [isMobile]);

  useEffect(() => {
    let cancelled = false;
    getSessionStats(id, sessionId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, sessionId]);

  if (loading) return <div className="quiz-stats-page"><div className="quiz-stats-loading">Chargement des statistiques…</div></div>;
  if (error) return <div className="quiz-stats-page"><div className="quiz-stats-error">{error}</div><Link to={`/quizzes/${id}/sessions`}>Retour aux sessions</Link></div>;
  if (!data) return null;

  const { quiz, session, stats } = data;
  const questionStats = stats.question_stats || [];
  const ranking = stats.ranking || [];
  const rankingEnabled = stats.ranking_enabled ?? quiz?.ranking_enabled ?? false;
  const reussiteData = questionStats.map((q, i) => ({
    name: String(q.position ?? i + 1),
    fullLabel: q.label || q.question_text || `Question ${q.position ?? i + 1}`,
    Réussite: q.correct_count,
    'Incorrect / Non répondu': (q.incorrect_count ?? 0) + (q.no_answer_count ?? 0),
  }));
  if (reussiteData.length === 0 && questionStats.length === 0 && (stats.correct_count > 0 || stats.incorrect_count > 0)) {
    reussiteData.push({ name: '1', fullLabel: 'Questions', Réussite: stats.correct_count, 'Incorrect / Non répondu': stats.incorrect_count });
  }

  const DUREE_MIN = 0;
  const DUREE_MAX = 120;
  const dureeTicks = Array.from({ length: DUREE_MAX / 5 + 1 }, (_, i) => i * 5);
  const dureeData = questionStats.map((q, i) => {
    const text = q.question_text || '';
    const raw = q.avg_response_time_seconds != null ? Number(q.avg_response_time_seconds) : 0;
    const clamped = Math.max(DUREE_MIN, Math.min(DUREE_MAX, raw));
    return {
      name: String(q.position ?? i + 1),
      fullQuestion: text || q.label || `Question ${q.position ?? i + 1}`,
      'Durée (s)': Number(clamped.toFixed(1)),
    };
  });

  return (
    <div className="quiz-stats-page">
      <header className="quiz-stats-header">
        <h1>Statistiques – Session {session.session_number ?? session.id}</h1>
        <nav>
          <Link to={`/quizzes/${id}/sessions`}>Sessions</Link>
          <Link to="/quizzes" className="quiz-stats-btn-mes-quiz">Mes quiz</Link>
        </nav>
      </header>
      <main className="quiz-stats-main">
        <section className="quiz-stats-section quiz-stats-graph-section">
          <h3 className="quiz-stats-graph-title">Représentation graphique – {quiz.title}</h3>
          <div className="quiz-stats-graph-buttons">
            {CHART_VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                className={`quiz-stats-graph-btn ${chartView === view.id ? 'active' : ''}`}
                onClick={() => setChartView(view.id)}
                aria-pressed={chartView === view.id}
              >
                <span className="quiz-stats-graph-btn-icon" aria-hidden>{view.icon}</span>
                {view.label}
              </button>
            ))}
          </div>

          <div className={`quiz-stats-chart-wrap ${chartView === 'reussite' ? 'quiz-stats-chart-wrap--reussite' : ''} ${chartView === 'duree' ? 'quiz-stats-chart-wrap--duree' : ''}`}>
            {chartView === 'participants' && (
              <p className="quiz-stats-number-in-chart">{stats.total_participants}</p>
            )}
            {chartView === 'reussite' && (
              <>
                <h4 className="quiz-stats-chart-heading">Taux de réussite</h4>
                <div className="quiz-stats-chart quiz-stats-chart--reussite">
                  <ResponsiveContainer width="100%" height={500}>
                    <BarChart
                      data={reussiteData}
                      margin={reussiteChartMargin}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.15)" strokeWidth={0.17} />
                      <XAxis dataKey="name" tick={reussiteXAxisTickProps} interval={0} axisLine={{ stroke: 'rgba(0,0,0,0.3)', strokeWidth: 0.17 }} tickLine={{ stroke: 'rgba(0,0,0,0.25)', strokeWidth: 0.17 }}>
                        <Label value="Questions" position="insideBottom" offset={-8} style={{ fill: '#000', fontSize: 11 }} />
                      </XAxis>
                      <YAxis tick={{ fill: '#000', fontSize: 12 }} axisLine={{ stroke: 'rgba(0,0,0,0.3)', strokeWidth: 0.17 }} tickLine={{ stroke: 'rgba(0,0,0,0.25)', strokeWidth: 0.17 }}>
                        <Label value="Nombre de réponses" angle={-90} position="insideLeft" offset={-5} style={{ fill: '#000', fontSize: 11 }} />
                      </YAxis>
                      <Tooltip
                        cursor={false}
                        contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value, name) => [value, name]}
                        labelFormatter={(label, payload) => (payload?.[0]?.payload?.fullLabel) ?? label}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        layout="vertical"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '0.75rem', color: '#000' }}
                        content={({ payload }) => (
                          <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {payload?.map((entry, i) => (
                              <li key={`legend-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, backgroundColor: entry.color }} />
                                <span style={{ color: '#000', fontSize: '0.75rem' }}>
                                  {(() => {
                                    const v = String(entry.value ?? '');
                                    const cleaned = v.replace(/^Catégorie:\s*/i, '').replace(/^Category:\s*/i, '');
                                    return cleaned || v;
                                  })()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      />
                      <Bar dataKey="Réussite" fill="#4caf50" name="Réussite" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Incorrect / Non répondu" fill="#c62828" name="Incorrect / Non répondu" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
            {chartView === 'duree' && (
              <>
                <h4 className="quiz-stats-chart-heading">Temps de réponse moyen par question (en secondes)</h4>
                <div className="quiz-stats-chart quiz-stats-chart--duree">
                  <ResponsiveContainer width="100%" height={480}>
                    <BarChart
                      data={dureeData}
                      margin={chartMargin}
                    >
                      <CartesianGrid strokeDasharray="4 4" stroke="rgba(0,0,0,0.25)" strokeWidth={0.5} />
                      <XAxis dataKey="name" tick={isMobile ? { ...xAxisTickProps, fontSize: 9 } : { fill: '#000', fontSize: 12 }} axisLine={{ stroke: 'rgba(0,0,0,0.5)', strokeWidth: 0.5 }} tickLine={{ stroke: 'rgba(0,0,0,0.4)', strokeWidth: 0.5 }}>
                        <Label value="Questions" position="insideBottom" offset={-8} style={{ fill: '#000', fontSize: 11 }} />
                      </XAxis>
                      <YAxis domain={[0, 120]} ticks={dureeTicks} tick={{ fill: '#000', fontSize: 12 }} axisLine={{ stroke: 'rgba(0,0,0,0.5)', strokeWidth: 0.5 }} tickLine={{ stroke: 'rgba(0,0,0,0.4)', strokeWidth: 0.5 }}>
                        <Label value="Secondes" angle={0} position="insideTop" offset={-24} style={{ fill: '#000', fontSize: 11 }} />
                      </YAxis>
                      <Tooltip
                        cursor={false}
                        contentStyle={{ background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8 }}
                        labelStyle={{ color: '#fff' }}
                        formatter={(value) => [`${value} s`, 'Temps de réponse moyen']}
                        labelFormatter={(_, payload) => (payload && payload[0] && payload[0].payload.fullQuestion) || ''}
                      />
                      <Bar dataKey="Durée (s)" fill="#ff9800" name="Temps de réponse moyen (s)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>

        </section>

        {rankingEnabled && ranking.length > 0 && (
          <section className="quiz-stats-section quiz-stats-ranking">
            <h3 className="quiz-stats-ranking-title">Classement de la session</h3>
            <ol className="quiz-stats-ranking-list">
              {ranking.map((r) => (
                <li key={r.rank} className="quiz-stats-ranking-item">
                  <span className="quiz-stats-ranking-rank">#{r.rank}</span>
                  <span className="quiz-stats-ranking-name">{r.pseudo}</span>
                  <span className="quiz-stats-ranking-score">{r.total_score} pt{r.total_score !== 1 ? 's' : ''}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

      </main>
    </div>
  );
}

export default SessionStats;
