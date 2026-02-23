/**
 * Service d'authentification (Jour 7)
 * Centralise les appels fetch vers l'API backend pour register, login, verify-email, me.
 * Utilise sessionStorage : chaque onglet a sa propre session (plusieurs comptes simultanés possibles).
 */

import { clearSession } from '../utils/sessionStorage';

// URL de base de l'API : en dev Vite proxy redirige /api vers localhost:3000, en prod mettre l'URL réelle
const API_BASE = '/api/v1/auth';

/** En cas de 401 (token expiré ou invalide), supprime la session et redirige vers /login */
export function clearSessionAndRedirectToLogin() {
  clearSession();
  window.location.href = '/login?expired=1';
}

/**
 * Inscription d'un nouveau créateur
 * @param {string} email - Email professionnel
 * @param {string} password - Mot de passe (min 8 caractères)
 * @returns {Promise<{ message, user?, verifyUrl? }>} Réponse du serveur
 */
export async function register(email, password) {
  const response = await fetch(`${API_BASE}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  // Lecture du corps en JSON ; si la réponse n'est pas du JSON (ex: erreur réseau), on utilise un objet vide
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Erreur lors de l\'inscription');
  }

  return data;
}

/**
 * Vérification du compte via le token reçu par email (lien cliqué)
 * @param {string} token - Token unique passé en query (?token=xxx)
 * @returns {Promise<{ message }>}
 */
export async function verifyEmail(token) {
  const response = await fetch(`${API_BASE}/verify-email?token=${encodeURIComponent(token)}`, {
    method: 'GET',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Erreur lors de la vérification');
  return data;
}

/**
 * Statut du token de confirmation (page confirm-email)
 * @param {string} token
 * @returns {Promise<{ valid: boolean, expired?: boolean, message?: string }>}
 */
export async function confirmEmailStatus(token) {
  const response = await fetch(`${API_BASE}/confirm-email/status?token=${encodeURIComponent(token)}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Erreur');
  return data;
}

/**
 * Action sur la page de confirmation : confirmer (Oui) ou annuler (Non)
 * @param {string} token
 * @param {'confirm'|'cancel'} action
 * @returns {Promise<{ success: boolean, cancelled?: boolean, expired?: boolean, message?: string }>}
 */
export async function confirmEmailAction(token, action) {
  const response = await fetch(`${API_BASE}/confirm-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, action }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Erreur');
  return data;
}

/**
 * Connexion : email + mot de passe → JWT
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token, user }>}
 */
export async function login(email, password) {
  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Identifiants incorrects');
  }

  return data;
}

/**
 * Récupère le profil de l'utilisateur connecté (nécessite un JWT valide)
 * @param {string} token - JWT stocké côté client (sessionStorage)
 * @returns {Promise<{ user }>}
 */
export async function getMe(token) {
  const response = await fetch(`${API_BASE}/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (response.status === 401) {
    clearSessionAndRedirectToLogin();
    throw new Error(data.message || 'Session expirée');
  }
  if (!response.ok) {
    throw new Error(data.message || 'Session expirée');
  }

  return data;
}
