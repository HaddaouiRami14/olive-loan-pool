/**
 * OliveChain — couche de données simulée.
 *
 * Toutes les données sont structurées comme si elles provenaient d'un
 * smart contract Hedera (accountId, tokenId, collateralAmount, loanAmount...).
 * Chaque fonction du provider est un point d'intégration : il suffit de
 * remplacer le corps par un appel au SDK Hedera / à une API pour passer en réel.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const PRICE_PER_LITER = 8.5; // USDC par litre (oracle simulé)
export const LTV = 0.7; // Loan-to-Value 70%
export const BORROW_APR = 0.09; // 9% annuel
export const POOL_APY = 0.081; // 8.1% estimé pour les investisseurs
export const LOAN_TERM_DAYS = 180;

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

interface OliveState {
  accountId: string | null;
  connecting: boolean;
  lots: CollateralLot[];
  loan: Loan | null;
  supplied: number;
  earned: number;
  txs: TxRecord[];
}

const POOL_BASE_TVL = 1_248_500;

const initialState: OliveState = {
  accountId: null,
  connecting: false,
  lots: [
    {
      id: "lot-1",
      tokenId: "0.0.487211",
      liters: 4200,
      grade: "extra-vierge",
      valueUsdc: 4200 * PRICE_PER_LITER,
      createdAt: "2026-08-28T09:12:00Z",
    },
  ],
  loan: null,
  supplied: 0,
  earned: 0,
  txs: [
    {
      id: "tx-1",
      type: "deposit",
      label: "Dépôt de collatéral · 4 200 L extra-vierge",
      amount: "+35 700 USDC de valeur",
      hash: "0.0.487211@1756372320.118",
      at: "2026-08-28T09:12:00Z",
    },
  ],
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function fakeHash() {
  const now = Math.floor(Date.now() / 1000);
  return `0.0.48201@${now}.${Math.floor(Math.random() * 1e9)}`;
}

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

export function accruedInterest(loan: Loan, now = Date.now()) {
  const days = Math.max(0, (now - new Date(loan.startedAt).getTime()) / 86_400_000);
  return loan.principalUsdc * loan.interestRate * (days / 365);
}

interface OliveContextValue extends OliveState {
  connected: boolean;
  collateralValue: number;
  totalLiters: number;
  maxBorrow: number;
  debt: number;
  healthRatio: number;
  poolHistory: PoolPoint[];
  poolTvl: number;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  depositCollateral: (liters: number, grade: Grade) => Promise<void>;
  requestLoan: (amount: number) => Promise<void>;
  repayLoan: () => Promise<void>;
  supplyToPool: (amount: number) => Promise<void>;
  withdrawFromPool: () => Promise<void>;
}

const OliveContext = createContext<OliveContextValue | null>(null);

const delay = (ms = 700) => new Promise((r) => setTimeout(r, ms));

export function OliveChainProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OliveState>(initialState);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(i);
  }, []);

  const pushTx = useCallback((tx: Omit<TxRecord, "id" | "hash" | "at">) => {
    setState((s) => ({
      ...s,
      txs: [
        { ...tx, id: uid("tx"), hash: fakeHash(), at: new Date().toISOString() },
        ...s.txs,
      ],
    }));
  }, []);

  // --- Points d'intégration Hedera (remplacer par le SDK) ---
  const connectWallet = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true }));
    await delay(900);
    setState((s) => ({ ...s, connecting: false, accountId: "0.0.482017" }));
  }, []);

  const disconnectWallet = useCallback(() => {
    setState((s) => ({ ...s, accountId: null }));
  }, []);

  const depositCollateral = useCallback(
    async (liters: number, grade: Grade) => {
      await delay();
      const valueUsdc = liters * PRICE_PER_LITER;
      setState((s) => ({
        ...s,
        lots: [
          {
            id: uid("lot"),
            tokenId: `0.0.${480000 + Math.floor(Math.random() * 9999)}`,
            liters,
            grade,
            valueUsdc,
            createdAt: new Date().toISOString(),
          },
          ...s.lots,
        ],
      }));
      pushTx({
        type: "deposit",
        label: `Dépôt de collatéral · ${formatNumber(liters)} L ${grade}`,
        amount: `+${formatUsdc(valueUsdc, 0)} USDC de valeur`,
      });
    },
    [pushTx],
  );

  const requestLoan = useCallback(
    async (amount: number) => {
      await delay();
      const now = new Date();
      const due = new Date(now.getTime() + LOAN_TERM_DAYS * 86_400_000);
      setState((s) => ({
        ...s,
        loan: {
          id: uid("loan"),
          contractId: `0.0.${490000 + Math.floor(Math.random() * 9999)}`,
          principalUsdc: (s.loan?.principalUsdc ?? 0) + amount,
          interestRate: BORROW_APR,
          startedAt: s.loan?.startedAt ?? now.toISOString(),
          dueAt: s.loan?.dueAt ?? due.toISOString(),
        },
      }));
      pushTx({
        type: "borrow",
        label: "Prêt accordé en stablecoin",
        amount: `+${formatUsdc(amount, 0)} USDC`,
      });
    },
    [pushTx],
  );

  const repayLoan = useCallback(async () => {
    await delay();
    setState((s) => {
      if (!s.loan) return s;
      return { ...s, loan: null };
    });
    pushTx({
      type: "repay",
      label: "Remboursement · collatéral libéré",
      amount: "Prêt soldé",
    });
  }, [pushTx]);

  const supplyToPool = useCallback(
    async (amount: number) => {
      await delay();
      setState((s) => ({ ...s, supplied: s.supplied + amount }));
      pushTx({
        type: "supply",
        label: "Dépôt dans le pool de liquidité",
        amount: `+${formatUsdc(amount, 0)} USDC`,
      });
    },
    [pushTx],
  );

  const withdrawFromPool = useCallback(async () => {
    await delay();
    let total = 0;
    setState((s) => {
      total = s.supplied + s.earned;
      return { ...s, supplied: 0, earned: 0 };
    });
    pushTx({
      type: "withdraw",
      label: "Retrait du pool (capital + intérêts)",
      amount: `-${formatUsdc(total, 0)} USDC`,
    });
  }, [pushTx]);

  // Intérêts investisseur simulés en continu
  useEffect(() => {
    if (state.supplied <= 0) return;
    setState((s) => ({ ...s, earned: s.earned + (s.supplied * POOL_APY * 3) / 31_536_000 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const value = useMemo<OliveContextValue>(() => {
    const collateralValue = state.lots.reduce((a, l) => a + l.valueUsdc, 0);
    const totalLiters = state.lots.reduce((a, l) => a + l.liters, 0);
    const debt = state.loan ? state.loan.principalUsdc + accruedInterest(state.loan) : 0;
    const maxBorrow = Math.max(0, collateralValue * LTV - (state.loan?.principalUsdc ?? 0));
    const poolTvl = POOL_BASE_TVL + state.supplied;
    const poolHistory: PoolPoint[] = [
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juillet",
      "Août",
      "Sept.",
    ].map((label, i) => ({
      label,
      tvl: Math.round(620_000 + i * 104_000 + (i % 2 ? 18_000 : -9_000) + state.supplied),
    }));

    return {
      ...state,
      connected: Boolean(state.accountId),
      collateralValue,
      totalLiters,
      maxBorrow,
      debt,
      healthRatio: collateralValue > 0 ? debt / collateralValue : 0,
      poolTvl,
      poolHistory,
      connectWallet,
      disconnectWallet,
      depositCollateral,
      requestLoan,
      repayLoan,
      supplyToPool,
      withdrawFromPool,
    };
  }, [
    state,
    connectWallet,
    disconnectWallet,
    depositCollateral,
    requestLoan,
    repayLoan,
    supplyToPool,
    withdrawFromPool,
  ]);

  return <OliveContext.Provider value={value}>{children}</OliveContext.Provider>;
}

export function useOliveChain() {
  const ctx = useContext(OliveContext);
  if (!ctx) throw new Error("useOliveChain doit être utilisé dans OliveChainProvider");
  return ctx;
}
