/**
 * Stockage de session par onglet (sessionStorage).
 * Chaque onglet du navigateur a sa propre session, ce qui permet d'avoir
 * plusieurs comptes connectés simultanément (ex: admin dans un onglet, créateur dans un autre).
 */

const KEY_TOKEN = 'token';
const KEY_USER = 'user';

export function getToken() {
  return sessionStorage.getItem(KEY_TOKEN);
}

export function setToken(token) {
  if (token) sessionStorage.setItem(KEY_TOKEN, token);
  else sessionStorage.removeItem(KEY_TOKEN);
}

export function getUser() {
  const raw = sessionStorage.getItem(KEY_USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (user) sessionStorage.setItem(KEY_USER, JSON.stringify(user));
  else sessionStorage.removeItem(KEY_USER);
}

export function clearSession() {
  sessionStorage.removeItem(KEY_TOKEN);
  sessionStorage.removeItem(KEY_USER);
}
