// Accounts, sessions and API keys. Every account owns one wallet (its rows in ledger_entries).
// People sign in with email + password (session cookie). Agents call the API with a key:
//   Authorization: Bearer wk_test_...
// Only hashes are stored: passwords with scrypt, session tokens and API keys with SHA-256.
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { q } from "./db";
import { ensureDemoAccounts } from "./demo";

export const SESSION_COOKIE = "walley_session";
const SESSION_DAYS = 30;
const SIGN_IN_LINK_DAYS = 7;

export type Account = {
  id: string;
  kind: "human" | "agent";
  name: string;
  email: string | null;
  is_demo: boolean;
  created_at: string;
  has_password: boolean;
};

export class AuthError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// ---- Hashing ---------------------------------------------------------------

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, 64, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function verifyPassword(password: string, stored: string | null) {
  const [alg, salt, key] = (stored || "").split("$");
  if (alg !== "scrypt" || !salt || !key) return false;
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"));
  const expected = Buffer.from(key, "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const secret = (prefix: string) => prefix + randomBytes(24).toString("base64url");

// ---- Validation ------------------------------------------------------------

export function cleanEmail(raw: unknown) {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200)
    throw new AuthError(400, "invalid_email", "Enter a valid email address.");
  return email;
}

export function cleanPassword(raw: unknown) {
  const password = String(raw ?? "");
  if (password.length < 8) throw new AuthError(400, "weak_password", "Use at least 8 characters for the password.");
  if (password.length > 200) throw new AuthError(400, "weak_password", "Use at most 200 characters for the password.");
  return password;
}

export function cleanName(raw: unknown, fallback?: string) {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (!name && !fallback) throw new AuthError(400, "invalid_name", "Enter a name.");
  return name || fallback!;
}

// ---- Accounts --------------------------------------------------------------

const ACCOUNT_COLUMNS = `a.id, a.kind, a.name, a.email, a.is_demo, a.created_at, (a.password_hash is not null) as has_password`;

export async function createAccount(input: {
  kind: "human" | "agent";
  name: string;
  email: string | null;
  password: string | null;
}): Promise<Account> {
  await ensureDemoAccounts();
  const id = `acct_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const hash = input.password ? await hashPassword(input.password) : null;
  const rows = await q<Account>(
    `insert into accounts (id, kind, name, email, password_hash) values ($1, $2, $3, $4, $5)
     on conflict (email) do nothing
     returning id, kind, name, email, is_demo, created_at, (password_hash is not null) as has_password`,
    [id, input.kind, input.name, input.email, hash],
  );
  if (!rows.length) throw new AuthError(409, "email_taken", "An account with that email already exists. Sign in instead.");
  return rows[0];
}

export async function checkPassword(emailRaw: unknown, passwordRaw: unknown): Promise<Account> {
  await ensureDemoAccounts();
  const email = String(emailRaw ?? "").trim().toLowerCase();
  const [row] = await q<Account & { password_hash: string | null }>(
    `select ${ACCOUNT_COLUMNS}, a.password_hash from accounts a where a.email = $1`,
    [email],
  );
  // Same work whether or not the account exists, so timing doesn't reveal which emails are registered.
  const ok = await verifyPassword(String(passwordRaw ?? ""), row?.password_hash ?? "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
  if (!row || !ok) throw new AuthError(401, "bad_credentials", "That email and password don't match an account.");
  const { password_hash: _drop, ...account } = row;
  void _drop;
  return account;
}

export async function setCredentials(accountId: string, email: string | null, password: string) {
  const hash = await hashPassword(password);
  const rows = await q(
    `update accounts set email = coalesce($2, email), password_hash = $3
     where id = $1 and is_demo = false
       and ($2::text is null or not exists (select 1 from accounts o where o.email = $2 and o.id <> $1))
     returning id`,
    [accountId, email, hash],
  );
  if (!rows.length) throw new AuthError(409, "email_taken", "An account with that email already exists.");
}

// ---- Sessions (people in the browser) --------------------------------------

export async function createSession(accountId: string) {
  const token = secret("ws_");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await q(`insert into sessions (token_hash, account_id, expires_at) values ($1, $2, $3)`, [sha256(token), accountId, expires]);
  return { token, expires };
}

export async function endSession(token: string | undefined) {
  if (token) await q(`delete from sessions where token_hash = $1`, [sha256(token)]);
}

export function sessionCookie(token: string, expires: Date) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`;
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function readCookie(req: Request, name: string) {
  const header = req.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

// ---- API keys (agents) -----------------------------------------------------

export type ApiKeyRow = {
  id: string;
  prefix: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
};

export async function createApiKey(accountId: string, label: string) {
  const key = secret("wk_test_");
  const id = `key_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  await q(`insert into api_keys (id, account_id, key_hash, prefix, label) values ($1, $2, $3, $4, $5)`, [
    id,
    accountId,
    sha256(key),
    key.slice(0, 12),
    label,
  ]);
  return { id, key, prefix: key.slice(0, 12), label };
}

export async function listApiKeys(accountId: string) {
  return q<ApiKeyRow>(
    `select id, prefix, label, created_at, last_used_at from api_keys
     where account_id = $1 and revoked_at is null order by created_at desc`,
    [accountId],
  );
}

export async function revokeApiKey(accountId: string, keyId: string) {
  const rows = await q(
    // The public demo key stays usable for everyone, so it can't be revoked.
    `update api_keys set revoked_at = now()
     where id = $1 and account_id = $2 and revoked_at is null and id <> 'key_demo_scout' returning id`,
    [keyId, accountId],
  );
  return rows.length > 0;
}

// ---- One-time sign-in links (an agent hands one to its person) -------------

export async function createSignInLink(accountId: string, origin: string) {
  const token = secret("wl_");
  const expires = new Date(Date.now() + SIGN_IN_LINK_DAYS * 86400_000);
  await q(`insert into sign_in_links (token_hash, account_id, expires_at) values ($1, $2, $3)`, [sha256(token), accountId, expires]);
  return { url: `${origin}/api/auth/link?token=${token}`, expires };
}

// Single use: marks the link used and returns its account, or null if it is unknown, used or expired.
export async function redeemSignInLink(token: string) {
  const [row] = await q<{ account_id: string }>(
    `update sign_in_links set used_at = now()
     where token_hash = $1 and used_at is null and expires_at > now() returning account_id`,
    [sha256(token)],
  );
  return row?.account_id ?? null;
}

// ---- Who is calling? -------------------------------------------------------

async function accountById(id: string) {
  const [row] = await q<Account>(`select ${ACCOUNT_COLUMNS} from accounts a where a.id = $1`, [id]);
  return row ?? null;
}

// Resolves the caller from an API key (agents) or the session cookie (people). Null if neither is valid.
export async function currentAccount(req: Request): Promise<(Account & { via: "api_key" | "session" }) | null> {
  await ensureDemoAccounts();
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (bearer) {
    const [row] = await q<{ account_id: string }>(
      `update api_keys set last_used_at = now() where key_hash = $1 and revoked_at is null returning account_id`,
      [sha256(bearer)],
    );
    if (!row) return null;
    const account = await accountById(row.account_id);
    return account ? { ...account, via: "api_key" } : null;
  }
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const [row] = await q<{ account_id: string }>(
    `select account_id from sessions where token_hash = $1 and expires_at > now()`,
    [sha256(token)],
  );
  if (!row) return null;
  const account = await accountById(row.account_id);
  return account ? { ...account, via: "session" } : null;
}

export async function requireAccount(req: Request, opts: { sessionOnly?: boolean } = {}) {
  const account = await currentAccount(req);
  if (!account)
    throw new AuthError(
      401,
      "unauthenticated",
      "Sign in at /login, or send an API key: Authorization: Bearer wk_test_... (see /llms.txt).",
    );
  if (opts.sessionOnly && account.via !== "session")
    throw new AuthError(403, "session_required", "Only a signed-in person can do this, not an API key.");
  return account;
}
