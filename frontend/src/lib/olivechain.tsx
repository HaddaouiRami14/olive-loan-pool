/**
 * OliveChain — couche de données connectée au backend Hedera réel.
 *
 * Remplace l'ancienne version 100% simulée : chaque fonction du provider
 * appelle maintenant l'API Express (`backend/`), qui elle-même mint des
 * tokens HTS et appelle le smart contract OliveChainPool sur Hedera testnet.
 * L'interface exposée par `useOliveChain()` (mêmes champs, mêmes fonctions)
 * reste identique pour ne rien casser dans les composants existants.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

// Valeurs affichées côté UI — doivent rester alignées avec les constantes
// on-chain définies dans backend/contracts/OliveChainPool.sol
export const PRICE_PER_LITER = 8.5; // USDC par litre (référence backend)
export const LTV = 0.7; // Loan-to-Value 70%
export const BORROW_APR = 0.09; // 9% annuel
export const POOL_APY = 0.081; // 8.1% estimé pour les investisseurs
export const LOAN_TERM_DAYS = 180;

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000";
// Compte "démo" utilisé côté backend custodial (voir README backend, §7)
const DEMO_ACCOUNT_ID = (import.meta.env.VITE_DEMO_ACCOUNT_ID as string | undefined) ?? "0.0.482017";
const REFRESH_INTERVAL_MS = 6000;

export type Grade = "extra-vierge" | "vierge" | "lampante";

export interface CollateralLot {
  id: string;
  tokenId: string;
  liters: number;
  grade: Grade;
  valueUsdc: number;
  createdAt: string;
}

export interface Loan {
  id: string;
  contractId: string;
  principalUsdc: number;
  interestRate: number;
  startedAt: string;
  dueAt: string;
  currentDebt?: number;
}

export interface TxRecord {
  id: string;
  type: "deposit" | "borrow" | "repay" | "supply" | "withdraw";
  label: string;
  amount: string;
  hash: string;
  at: string;
}

export interface PoolPoint {
  label: string;
  tvl: number;
}

/** Forme exacte de la réponse renvoyée par le backend (buildStateResponse). */
interface ApiState {
  accountId: string;
  lots: CollateralLot[];
  loan: Loan | null;
  supplied: number;
  earned: number;
  txs: TxRecord[];
  collateralValue: number;
  totalLiters: number;
  maxBorrow: number;
  debt: number;
  healthRatio: number;
  poolTvl: number;
  poolHistory: PoolPoint[];
}

interface OliveState extends Omit<ApiState, "accountId"> {
  accountId: string | null;
  connecting: boolean;
}

const emptyState: OliveState = {
  accountId: null,
  connecting: false,
  lots: [],
  loan: null,
  supplied: 0,
  earned: 0,
  txs: [],
  collateralValue: 0,
  totalLiters: 0,
  maxBorrow: 0,
  debt: 0,
  healthRatio: 0,
  poolTvl: 0,
  poolHistory: [],
};

export function formatUsdc(value: number, digits = 2) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Intérêts courus côté client, pour un affichage fluide entre deux rafraîchissements. */
export function accruedInterest(loan: Loan, now = Date.now()) {
  const days = Math.max(0, (now - new Date(loan.startedAt).getTime()) / 86_400_000);
  return loan.principalUsdc * loan.interestRate * (days / 365);
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Erreur API OliveChain (${res.status})`);
  }
  return (await res.json()) as T;
}

interface OliveContextValue extends OliveState {
  connected: boolean;
  connectWallet: (customAccountId?: string) => Promise<void>;
  disconnectWallet: () => void;
  depositCollateral: (liters: number, grade: Grade) => Promise<void>;
  requestLoan: (amount: number) => Promise<void>;
  repayLoan: () => Promise<void>;
  supplyToPool: (amount: number) => Promise<void>;
  withdrawFromPool: () => Promise<void>;
}

const OliveContext = createContext<OliveContextValue | null>(null);

export function OliveChainProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OliveState>(emptyState);
  const accountIdRef = useRef<string | null>(null);
  accountIdRef.current = state.accountId;

  const applyApiState = useCallback((api: ApiState) => {
    setState((s) => ({ ...s, ...api, connecting: false }));
  }, []);

  const refresh = useCallback(
    async (accountId: string) => {
      try {
        const api = await apiFetch<ApiState>(`/api/wallet/state/${accountId}`);
        applyApiState(api);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("OliveChain: échec du rafraîchissement de l'état", err);
      }
    },
    [applyApiState],
  );

  // Rafraîchit l'état régulièrement (dette et intérêts calculés on-chain
  // évoluent en continu, même sans action de l'utilisateur).
  useEffect(() => {
    if (!state.accountId) return;
    const id = window.setInterval(() => {
      if (accountIdRef.current) void refresh(accountIdRef.current);
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [state.accountId, refresh]);

  const connectWallet = useCallback(async (customAccountId?: string) => {
    setState((s) => ({ ...s, connecting: true }));
    const target = customAccountId || DEMO_ACCOUNT_ID;
    try {
      const api = await apiFetch<ApiState>("/api/wallet/connect", {
        method: "POST",
        body: JSON.stringify({ accountId: target }),
      });
      applyApiState(api);
    } catch (err) {
      setState((s) => ({ ...s, connecting: false }));
      toast.error(
        err instanceof Error
          ? err.message
          : "Impossible de joindre le backend OliveChain. Vérifie qu'il tourne sur " + API_BASE_URL,
      );
    }
  }, [applyApiState]);

  const disconnectWallet = useCallback(() => {
    // Le backend garde l'état en mémoire (custodial) — se "déconnecter"
    // ne fait que quitter la session côté UI.
    setState(emptyState);
  }, []);

  const withAccount = useCallback(
    async (fn: (accountId: string) => Promise<ApiState>) => {
      const accountId = accountIdRef.current;
      if (!accountId) throw new Error("Wallet non connecté");
      const api = await fn(accountId);
      applyApiState(api);
    },
    [applyApiState],
  );

  const depositCollateral = useCallback(
    (liters: number, grade: Grade) =>
      withAccount((accountId) =>
        apiFetch<ApiState>("/api/collateral/deposit", {
          method: "POST",
          body: JSON.stringify({ accountId, liters, grade }),
        }),
      ),
    [withAccount],
  );

  const requestLoan = useCallback(
    (amount: number) =>
      withAccount((accountId) =>
        apiFetch<ApiState>("/api/loan/request", {
          method: "POST",
          body: JSON.stringify({ accountId, amount }),
        }),
      ),
    [withAccount],
  );

  const repayLoan = useCallback(
    () =>
      withAccount((accountId) =>
        apiFetch<ApiState>("/api/loan/repay", {
          method: "POST",
          body: JSON.stringify({ accountId }),
        }),
      ),
    [withAccount],
  );

  const supplyToPool = useCallback(
    (amount: number) =>
      withAccount((accountId) =>
        apiFetch<ApiState>("/api/pool/supply", {
          method: "POST",
          body: JSON.stringify({ accountId, amount }),
        }),
      ),
    [withAccount],
  );

  const withdrawFromPool = useCallback(
    () =>
      withAccount((accountId) =>
        apiFetch<ApiState>("/api/pool/withdraw", {
          method: "POST",
          body: JSON.stringify({ accountId }),
        }),
      ),
    [withAccount],
  );

  const value = useMemo<OliveContextValue>(
    () => ({
      ...state,
      connected: Boolean(state.accountId),
      connectWallet,
      disconnectWallet,
      depositCollateral,
      requestLoan,
      repayLoan,
      supplyToPool,
      withdrawFromPool,
    }),
    [
      state,
      connectWallet,
      disconnectWallet,
      depositCollateral,
      requestLoan,
      repayLoan,
      supplyToPool,
      withdrawFromPool,
    ],
  );

  return <OliveContext.Provider value={value}>{children}</OliveContext.Provider>;
}

export function useOliveChain() {
  const ctx = useContext(OliveContext);
  if (!ctx) throw new Error("useOliveChain doit être utilisé dans OliveChainProvider");
  return ctx;
}
