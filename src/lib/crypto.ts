import { createHash, randomBytes } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Jeton aléatoire URL-safe (sessions, liens magiques). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Alphabet sans ambiguïté orale : pas de I, O, 0, 1. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Code d'accès à 8 caractères, transmissible oralement (ex. « K7RM-P2WX »). */
export function generateAccessCode(): string {
  const buf = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[(buf[i] ?? 0) % CODE_ALPHABET.length];
  }
  return code;
}

/** Normalise un code saisi : majuscules, sans espaces ni tirets.
 *  (L'alphabet de génération exclut I, O, 0 et 1 pour éviter les confusions.) */
export function normalizeAccessCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, "").slice(0, 8);
}
