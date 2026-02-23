/**
 * Service API Quiz (Jours 8 à 14)
 * Appels vers /api/v1/quizzes et /api/v1/quizzes/:id/questions.
 * Toutes les requêtes (sauf options) envoient le JWT dans Authorization.
 */

import { clearSessionAndRedirectToLogin } from './authService';
import { getToken } from '../utils/sessionStorage';

const API_BASE = '/api/v1/quizzes';

/** Retourne les en-têtes avec le token JWT pour les requêtes authentifiées */
function getAuthHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/** En cas de 401, efface la session et redirige vers /login ; sinon ne fait rien */
function handleResponse(res, data) {
  if (res.status === 401) {
    clearSessionAndRedirectToLogin();
    throw new Error(data?.message || 'Session expirée');
  }
}

export async function getQuizzes() {
  const res = await fetch(API_BASE, { headers: getAuthHeaders() });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur chargement quiz');
  return data.quizzes;
}

export async function getQuiz(id) {
  const res = await fetch(`${API_BASE}/${id}`, { headers: getAuthHeaders() });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur chargement quiz');
  return data.quiz;
}

export async function createQuiz(body) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur création quiz');
  return data.quiz;
}

export async function updateQuiz(id, body) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur mise à jour quiz');
  return data.quiz;
}

export async function deleteQuiz(id) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur suppression quiz');
}

export async function startQuiz(id) {
  const res = await fetch(`${API_BASE}/${id}/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur lancement quiz');
  return data;
}

/** Ouvrir le quiz : affiche code + QR, participants peuvent rejoindre. Le quiz ne démarre pas encore. */
export async function openQuiz(id) {
  const res = await fetch(`${API_BASE}/${id}/open`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur ouverture quiz');
  return data;
}

/** Lancer le quiz : première question + timer (à utiliser après Ouvrir). */
export async function launchQuiz(id) {
  const res = await fetch(`${API_BASE}/${id}/launch`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur démarrage quiz');
  return data;
}

export async function endQuiz(id) {
  const res = await fetch(`${API_BASE}/${id}/end`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur fin du quiz');
  return data;
}

export async function getQuizSession(quizId) {
  const res = await fetch(`${API_BASE}/${quizId}/session`, { headers: getAuthHeaders() });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur session');
  return data.session;
}

export async function getQuizStats(quizId) {
  const res = await fetch(`${API_BASE}/${quizId}/stats`, { headers: getAuthHeaders() });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur chargement des statistiques');
  return data;
}

/** Liste des sessions d'un quiz (triées par numéro ordre croissant) */
export async function getQuizSessions(quizId) {
  const res = await fetch(`${API_BASE}/${quizId}/sessions`, { headers: getAuthHeaders() });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur chargement des sessions');
  return data;
}

/** Supprimer une session (interdit si actif ou ouvert) */
export async function deleteSession(quizId, sessionId) {
  const res = await fetch(`${API_BASE}/${quizId}/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur suppression de la session');
}

/** Supprimer toutes les sessions d'un quiz (interdit si actif ou ouvert) */
export async function deleteAllSessions(quizId) {
  const res = await fetch(`${API_BASE}/${quizId}/sessions`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur suppression des sessions');
}

/** Statistiques d'une session spécifique */
export async function getSessionStats(quizId, sessionId) {
  const res = await fetch(`${API_BASE}/${quizId}/sessions/${sessionId}/stats`, { headers: getAuthHeaders() });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur chargement des statistiques de la session');
  return data;
}

export async function getQuizLiveState(quizId) {
  const res = await fetch(`${API_BASE}/${quizId}/live`, { headers: getAuthHeaders() });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur suivi temps réel');
  return data;
}

export async function nextQuestion(quizId) {
  const res = await fetch(`${API_BASE}/${quizId}/next-question`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur passage à la question suivante');
  return data;
}

export async function addQuestion(quizId, body) {
  const res = await fetch(`${API_BASE}/${quizId}/questions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur ajout question');
  return data.question;
}

export async function updateQuestion(quizId, questionId, body) {
  const res = await fetch(`${API_BASE}/${quizId}/questions/${questionId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur mise à jour question');
  return data.question;
}

/** Upload d'un fichier média (image ou vidéo) pour une question */
export async function uploadMedia(file) {
  const formData = new FormData();
  formData.append('media', file);
  const token = getToken();
  const res = await fetch(`${API_BASE}/upload-media`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur upload média');
  return data.url;
}

export async function deleteQuestion(quizId, questionId) {
  const res = await fetch(`${API_BASE}/${quizId}/questions/${questionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur suppression question');
}
