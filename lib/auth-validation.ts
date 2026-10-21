export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  const username = normalizeUsername(value);
  if (!/^[a-z][a-z0-9_]{2,31}$/.test(username))
    return "Use de 3 a 32 caracteres: comece com uma letra e use letras, números ou _.";
  if (username.startsWith("legacy_"))
    return "Esse prefixo de username é reservado.";
  return null;
}
