// Puente mínimo entre el cliente Apollo (un módulo plano, sin acceso al
// árbol de React) y AuthContext (que sí puede limpiar la sesión y
// redirigir a Login). Cuando el backend responde que el token ya no es
// válido, apolloClient emite este evento y AuthContext se suscribe.
type Listener = () => void;

const listeners = new Set<Listener>();

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSessionExpired(): void {
  listeners.forEach((listener) => listener());
}
