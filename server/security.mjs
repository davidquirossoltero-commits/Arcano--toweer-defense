import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const ACCOUNTS = [
  { username: "Wesked", name: "Wesked", env: "QUEST_PASSWORD_WESKED" },
  { username: "Flisin", name: "Flisin", env: "QUEST_PASSWORD_FLISIN" },
  { username: "Aidi", name: "Aidi", env: "QUEST_PASSWORD_AIDI" },
  { username: "Einar", name: "Einar", env: "QUEST_PASSWORD_EINAR" },
];

export const RANKS = [
  { wave: 0, title: "Iniciado Arcano", icon: "🔮" },
  { wave: 5, title: "Guardián de Runas", icon: "✨" },
  { wave: 10, title: "Evocador Elemental", icon: "⚡" },
  { wave: 15, title: "Mago del Nexo", icon: "🌀" },
  { wave: 20, title: "Archimago Cósmico", icon: "👑" },
  { wave: 25, title: "Señor de la Realidad", icon: "🌌" },
];

export function rankInfo(highestWave = 0) {
  let current = RANKS[0];
  for (let i = 0; i < RANKS.length; i++) {
    if (highestWave >= RANKS[i].wave) {
      current = RANKS[i];
    }
  }
  return current;
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt, 32);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [algo, salt, hex] = String(stored ?? "").split("$");
  if (algo !== "scrypt" || !salt || !hex || password.length === 0 || password.length > 200) return false;
  const hash = await scryptAsync(password, salt, 32);
  const expected = Buffer.from(hex, "hex");
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

export async function loadAccounts(env = process.env) {
  const accounts = [];
  for (const account of ACCOUNTS) {
    const password = env[account.env] ?? "";
    if (password.length < 8 || password.length > 200) {
      throw new Error(`Falta ${account.env}: pon una contraseña de al menos 8 caracteres.`);
    }
    if (password.startsWith("cambia-esta")) {
      throw new Error(`${account.env} sigue siendo la contraseña de ejemplo. Cámbiala antes de publicar.`);
    }
    accounts.push({
      username: account.username,
      name: account.name,
      passwordHash: await hashPassword(password),
    });
  }
  return accounts;
}

export function createLimiter({ max = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const book = new Map();
  return {
    check(key) {
      const now = Date.now();
      const row = book.get(key);
      if (!row || now > row.resetAt) {
        book.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, remaining: max - 1 };
      }
      if (row.count >= max) {
        return { ok: false, remaining: 0, retryAfter: Math.ceil((row.resetAt - now) / 1000) };
      }
      row.count += 1;
      return { ok: true, remaining: max - row.count };
    },
    reset(key) {
      book.delete(key);
    },
  };
}

export function emptyState() {
  return {
    highestWave: 0,
    score: 0,
    stars: 0,
    totalKills: 0,
    gamesPlayed: 0,
    upgrades: {
      damage: 0,
      range: 0,
      manaRate: 0,
      nexusHp: 0,
    },
  };
}

export function sanitizeState(raw) {
  if (!raw || typeof raw !== "object") return emptyState();
  const highestWave = Math.max(0, Math.min(100, Number(raw.highestWave) || 0));
  const score = Math.max(0, Math.min(10_000_000, Number(raw.score) || 0));
  const stars = Math.max(0, Math.min(100, Number(raw.stars) || 0));
  const totalKills = Math.max(0, Math.min(100_000, Number(raw.totalKills) || 0));
  const gamesPlayed = Math.max(0, Math.min(10_000, Number(raw.gamesPlayed) || 0));

  const up = raw.upgrades && typeof raw.upgrades === "object" ? raw.upgrades : {};
  const upgrades = {
    damage: Math.max(0, Math.min(10, Number(up.damage) || 0)),
    range: Math.max(0, Math.min(10, Number(up.range) || 0)),
    manaRate: Math.max(0, Math.min(10, Number(up.manaRate) || 0)),
    nexusHp: Math.max(0, Math.min(10, Number(up.nexusHp) || 0)),
  };

  return {
    highestWave,
    score,
    stars,
    totalKills,
    gamesPlayed,
    upgrades,
  };
}

export function publicRow(account, state) {
  const safe = sanitizeState(state);
  const info = rankInfo(safe.highestWave);
  return {
    username: account.username,
    name: account.name,
    highestWave: safe.highestWave,
    score: safe.score,
    stars: safe.stars,
    kills: safe.totalKills,
    rank: info.title,
    icon: info.icon,
  };
}

export function rankRows(accounts, states) {
  return accounts
    .map((account) => publicRow(account, states.get(account.username)))
    .sort((a, b) => b.highestWave - a.highestWave || b.score - a.score || b.stars - a.stars || a.name.localeCompare(b.name, "es"));
}
