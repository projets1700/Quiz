/**
 * Service API Participant (Jours 15–21)
 * Join par code, état (timer), réponse, classement.
 * En dev sans VITE_API_URL : on cible directement le backend (http://localhost:3000) pour éviter les soucis de proxy.
 */
function getApiBase() {
  const envUrl = (import.meta.env.VITE_API_URL ?? '').toString().trim().replace(/\/$/, '');
  if (envUrl) return envUrl + '/api/v1/participant';
  if (import.meta.env.DEV && typeof window !== 'undefined') return 'http://localhost:3000/api/v1/participant';
  return '/api/v1/participant';
}
const API_BASE = getApiBase();

const PARTICIPANT_TOKEN_KEY = 'participant_token';

/** Récupère le token de session participant (stocké après /join) */
export function getParticipantToken() {
  return localStorage.getItem(PARTICIPANT_TOKEN_KEY);
}

/** Enregistre ou supprime le token participant (après join ou déconnexion) */
export function setParticipantToken(token) {
  if (token) localStorage.setItem(PARTICIPANT_TOKEN_KEY, token);
  else localStorage.removeItem(PARTICIPANT_TOKEN_KEY);
}

/** Efface la session participant (quand le quiz est quitté ou terminé) */
export function clearParticipantSession() {
  localStorage.removeItem(PARTICIPANT_TOKEN_KEY);
}

/** En-têtes pour les requêtes participant (state, respond, ranking) */
function getParticipantHeaders() {
  const token = getParticipantToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'X-Participant-Token': token }),
  };
}

/**
 * Rejoindre une session par code et pseudo (Jour 15)
 */
export async function join(code, pseudo) {
  const res = await fetch(`${API_BASE}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: String(code).toUpperCase().trim(), pseudo: pseudo.trim() }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur lors de l\'entrée');
  return data;
}

const STATE_REQUEST_TIMEOUT_MS = 12000;

/**
 * État courant : question, timer, ou finished (Jours 16, 20)
 */
export async function getState() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STATE_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/state`, {
      headers: getParticipantHeaders(),
      signal: controller.signal,
    });
    let data;
    try {
      data = await res.json();
    } catch (_) {
      throw new Error(res.status === 404 ? 'Session introuvable' : 'Réponse serveur invalide');
    }
    if (!res.ok) throw new Error(data.message || (res.status === 401 ? 'Session expirée' : 'Erreur serveur'));
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Envoyer une réponse (Jour 17)
 */
export async function respond(questionId, answer) {
  const res = await fetch(`${API_BASE}/respond`, {
    method: 'POST',
    headers: getParticipantHeaders(),
    body: JSON.stringify({ question_id: questionId, answer }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur envoi réponse');
  return data;
}

/**
 * Classement de la session (Jour 18)
 */
export async function getRanking() {
  const res = await fetch(`${API_BASE}/ranking`, { headers: getParticipantHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erreur classement');
  return data;
}
