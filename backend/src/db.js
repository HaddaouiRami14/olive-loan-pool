import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "store.json");

const POOL_BASE_TVL = 1_248_500;

function seedPoolHistory() {
 
  const months = ["Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Sept."];
  return months.map((label, i) => ({
    label,
    tvl: Math.round(620_000 + i * 104_000 + (i % 2 ? 18_000 : -9_000)),
    at: new Date().toISOString(),
  }));
}

function emptyDb() {
  return {
    accounts: {},
    poolHistory: seedPoolHistory(), 
  };
}

function ensureFile() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(emptyDb(), null, 2));
  }
}

export function readDb() {
  ensureFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return emptyDb();
  }
}

export function writeDb(db) {
  ensureFile();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function getAccount(db, accountId) {
  if (!db.accounts[accountId]) {
    db.accounts[accountId] = {
      lots: [],
      loan: null,
      supplied: 0,
      earned: 0,
      txs: [],
    };
  }
  return db.accounts[accountId];
}

export function pushTx(account, tx) {
  account.txs.unshift({
    id: `tx-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    at: new Date().toISOString(),
    ...tx,
  });
}

export function samplePoolHistory(db, poolTvl) {
  const raw = new Date().toLocaleDateString("fr-FR", { month: "short" });
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);
  const last = db.poolHistory[db.poolHistory.length - 1];
  if (last && last.label === label) {
    last.tvl = poolTvl;
  } else {
    db.poolHistory.push({ label, tvl: poolTvl, at: new Date().toISOString() });
  }
  // garde un historique raisonnable
  if (db.poolHistory.length > 24) db.poolHistory.shift();
}

export function computePoolTvl(db) {
  const suppliedTotal = Object.values(db.accounts).reduce((a, acc) => a + acc.supplied, 0);
  return POOL_BASE_TVL + suppliedTotal;
}

export { POOL_BASE_TVL };
