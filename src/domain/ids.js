/** Generates a unique identifier, falling back when `crypto.randomUUID` is unavailable. */
export const newId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
