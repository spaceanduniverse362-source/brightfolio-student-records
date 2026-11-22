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
