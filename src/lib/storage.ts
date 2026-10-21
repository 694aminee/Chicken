// Petite mémoire du navigateur (localStorage), protégée contre les erreurs
// (navigation privée, stockage bloqué…).

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // tant pis : le site marche quand même, sans mémoire
  }
}
