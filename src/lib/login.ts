/**
 * Staff can sign in with a username (no "@") or an email.
 * Usernames map to an internal address that never receives mail.
 */
export const USERNAME_DOMAIN = "burkaharbu-sss.local";

export function toAuthEmail(identifier: string): string {
  const id = identifier.trim().toLowerCase();
  return id.includes("@") ? id : `${id}@${USERNAME_DOMAIN}`;
}

export function displayLogin(email: string | null | undefined): string {
  if (!email) return "";
  const suffix = `@${USERNAME_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}

export function isUsernameLogin(identifier: string): boolean {
  return !identifier.trim().includes("@");
}

/** Readable username from a teacher's name, e.g. "Girmaa Gaaddisaa Korsaa" -> "girmaa.gaaddisaa". */
export function makeUsername(fullName: string, taken: Set<string>): string {
  const parts = fullName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const base = parts.slice(0, 2).join(".") || "teacher";
  let name = base;
  for (let i = 2; taken.has(name); i++) name = `${base}${i}`;
  taken.add(name);
  return name;
}

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function randomPassword(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}
