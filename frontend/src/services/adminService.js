/**
 * Service API Admin : gestion des comptes, statistiques, suppression de quiz.
 * Réservé aux comptes avec rôle admin.
 */

import { clearSessionAndRedirectToLogin } from './authService';
import { getToken } from '../utils/sessionStorage';

const API_BASE = '/api/v1/admin';

function getAuthHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

function handleResponse(res, data) {
  if (res.status === 401) {
    clearSessionAndRedirectToLogin();
    throw new Error(data?.message || 'Session expirée');
  }
}

export async function getUsers() {
  const res = await fetch(`${API_BASE}/users`, { headers: getAuthHeaders() });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur chargement utilisateurs');
  return data;
}

export async function createCreator(email, password) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur création compte');
  return data;
}

export async function deactivateCreator(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}/deactivate`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur désactivation');
  return data;
}

export async function activateCreator(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}/activate`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur réactivation');
  return data;
}

export async function promoteCreator(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}/promote`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur promotion');
  return data;
}

export async function demoteAdmin(userId) {
  const res = await fetch(`${API_BASE}/users/${userId}/demote`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur rétrogradation');
  return data;
}

export async function getGlobalStats() {
  const res = await fetch(`${API_BASE}/stats`, { headers: getAuthHeaders() });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur chargement statistiques');
  return data;
}

export async function getAllQuizzes() {
  const res = await fetch(`${API_BASE}/quizzes`, { headers: getAuthHeaders() });
  const data = await res.json();
  handleResponse(res, data);
  if (!res.ok) throw new Error(data.message || 'Erreur chargement quiz');
  return data.quizzes;
}

export async function deleteQuizAdmin(quizId) {
  const res = await fetch(`${API_BASE}/quizzes/${quizId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  handleResponse(res, data);
  if (!res.ok && res.status !== 204) throw new Error(data.message || 'Erreur suppression');
}
