/**
 * OliveChain — couche de données.
 *
 * Mode RÉEL (défaut) : lit les données depuis Hedera Testnet via le Mirror Node,
 * et envoie les transactions via des TanStack Server Functions (clé privée côté serveur).
 *
 * Mode MOCK (fallback) : données simulées si les appels Hedera échouent,
 * pour garantir une démo fluide même sans connexion réseau.
 *
 * Points d'intégration clairement marqués « // HEDERA: ... »
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
import {
  fetchAccountInfo,
  fetchFarmerNFTs,
  fetchPoolBalance,
  fetchContractTransactions,
  toCollateralRef,
  HEDERA_CONFIG,
  PRICE_PER_LITER,
} from "@/services/hederaService";
import {
  mintDepositNFT,
  requestLoanOnChain,
  repayLoanOnChain,
  fundPoolOnChain,
} from "@/services/hederaActions";

// ─── Constantes métier ────────────────────────────────────────────────────────

export { PRICE_PER_LITER };
export const LTV = 0.7;            // Loan-to-Value 70%
export const BORROW_APR = 0.09;    // 9% annuel (= 800 bps dans le contrat → 8%, on affiche 9% pour la marge)
export const POOL_APY = 0.081;     // 8.1% estimé pour les investisseurs
export const LOAN_TERM_DAYS = 180;

export type Grade = "extra-vierge" | "vierge" | "lampante";

// ─── Types (identiques à la structure retournée par le smart contract) ─────────

export interface CollateralLot {
  id: string;
  tokenId: string;
  serial?: number;
  collateralRef?: string;
  liters: number;
  grade: Grade;
  valueUsdc: number;
  createdAt: string;
}

export interface Loan {
  id: string;
  contractId: string;
  collateralRef: string;  // clé du mapping dans le smart contract
  principalUsdc: number;  // exprimé en USDC (≈ HBAR pour la démo)
  amountDue: number;      // principal + 8% d'intérêt
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
  poolTvlHbar: number;      // solde réel du pool en HBAR
  loadingChain: boolean;    // true pendant la synchro Mirror Node
}

// ─── Données mock (fallback si le Mirror Node est indisponible) ───────────────

const POOL_BASE_TVL = 1_248_500;

const MOCK_LOTS: CollateralLot[] = [
  {
    id: "lot-1",
    tokenId: "0.0.10558547",
    serial: 1,
    collateralRef: "0.0.10558547-1",
    liters: 4200,
    grade: "extra-vierge",
    valueUsdc: 4200 * PRICE_PER_LITER,
    createdAt: "2026-08-28T09:12:00Z",
  },
];

const MOCK_TXS: TxRecord[] = [
  {
    id: "tx-1",
    type: "deposit",
    label: "Dépôt de collatéral · 4 200 L extra-vierge",
    amount: "+35 700 USDC de valeur",
    hash: "0.0.10558547@1756372320.118",
    at: "2026-08-28T09:12:00Z",
  },
];

const initialState: OliveState = {
  accountId: null,
  connecting: false,
  lots: MOCK_LOTS,
  loan: null,
  supplied: 0,
  earned: 0,
  txs: MOCK_TXS,
  poolTvlHbar: 0,
  loadingChain: false,
};

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function fakeHash() {
  const now = Math.floor(Date.now() / 1000);
  return `${HEDERA_CONFIG.contractId}@${now}.${Math.floor(Math.random() * 1e9)}`;
}

const delay = (ms = 700) => new Promise((r) => setTimeout(r, ms));

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

// ─── Context ──────────────────────────────────────────────────────────────────

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
  refreshChainData: () => Promise<void>;
}

const OliveContext = createContext<OliveContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function OliveChainProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OliveState>(initialState);
  const [tick, setTick] = useState(0);
  const syncedAccount = useRef<string | null>(null);

  // Tick toutes les 3s pour les intérêts simulés
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(i);
  }, []);

  // ── Helpers locaux ──────────────────────────────────────────────────────────

  const pushTx = useCallback((tx: Omit<TxRecord, "id" | "hash" | "at">) => {
    setState((s) => ({
      ...s,
      txs: [
        { ...tx, id: uid("tx"), hash: fakeHash(), at: new Date().toISOString() },
        ...s.txs,
      ],
    }));
  }, []);

  // ── Synchronisation Mirror Node ─────────────────────────────────────────────

  /**
   * Charge les données on-chain pour un Account ID donné.
   * HEDERA: Mirror Node REST API — aucune clé privée requise.
   */
  const syncChainData = useCallback(async (accountId: string) => {
    setState((s) => ({ ...s, loadingChain: true }));
    try {
      // Charger NFTs (collatéraux) et solde du pool en parallèle
      const [nfts, poolHbar] = await Promise.all([
        fetchFarmerNFTs(accountId).catch(() => [] as Awaited<ReturnType<typeof fetchFarmerNFTs>>),
        fetchPoolBalance().catch(() => 0),
      ]);

      // Charger les transactions du contrat
      const chainTxs = await fetchContractTransactions().catch(() => []);

      setState((s) => ({
        ...s,
        lots: nfts.length > 0 ? nfts : MOCK_LOTS,
        poolTvlHbar: poolHbar,
        txs: chainTxs.length > 0
          ? chainTxs.map((t) => ({
              id: t.id,
              type: t.type as TxRecord["type"],
              label: t.label,
              amount: t.amount,
              hash: t.hash,
              at: t.at,
            }))
          : MOCK_TXS,
        loadingChain: false,
      }));
    } catch {
      // Fallback silencieux : les données mock restent affichées
      setState((s) => ({ ...s, loadingChain: false }));
    }
  }, []);

  const refreshChainData = useCallback(async () => {
    if (state.accountId) await syncChainData(state.accountId);
  }, [state.accountId, syncChainData]);

  // Synchronise automatiquement dès qu'un wallet est connecté
  useEffect(() => {
    if (state.accountId && state.accountId !== syncedAccount.current) {
      syncedAccount.current = state.accountId;
      void syncChainData(state.accountId);
    }
  }, [state.accountId, syncChainData]);

  // ── Actions wallet ──────────────────────────────────────────────────────────

  /**
   * Connexion wallet — vérifie l'Account ID via le Mirror Node.
   * HEDERA: fetchAccountInfo() → GET /api/v1/accounts/{accountId}
   */
  const connectWallet = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true }));
    try {
      // HEDERA: Utilise l'Account ID configuré dans .env.local
      const info = await fetchAccountInfo(HEDERA_CONFIG.accountId);
      setState((s) => ({ ...s, connecting: false, accountId: info.accountId }));
    } catch {
      // Fallback mock si le Mirror Node est injoignable
      await delay(900);
      setState((s) => ({ ...s, connecting: false, accountId: HEDERA_CONFIG.accountId || "0.0.10528188" }));
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    syncedAccount.current = null;
    setState((s) => ({ ...s, accountId: null, lots: MOCK_LOTS, loan: null, txs: MOCK_TXS }));
  }, []);

  // ── Actions agriculteur ─────────────────────────────────────────────────────

  /**
   * Dépôt de collatéral — mint un NFT OLVDEP.
   * HEDERA: mintDepositNFT() → TokenMintTransaction (Server Function)
   */
  const depositCollateral = useCallback(
    async (liters: number, grade: Grade) => {
      const qualityMap: Record<Grade, string> = {
        "extra-vierge": "Extra Vierge",
        "vierge": "Vierge",
        "lampante": "Lampante",
      };
      try {
        // HEDERA: Server Function — la clé privée est côté serveur
        const result = await mintDepositNFT({
          data: {
            farmer: state.accountId ?? HEDERA_CONFIG.accountId,
            quantity_liters: liters,
            quality: qualityMap[grade] ?? "Extra Vierge",
            date: new Date().toISOString().slice(0, 10),
          },
        });

        const newLot: CollateralLot = {
          id: `lot-${result.serial}`,
          tokenId: result.tokenId,
          serial: result.serial,
          collateralRef: result.collateralRef,
          liters,
          grade,
          valueUsdc: liters * PRICE_PER_LITER,
          createdAt: new Date().toISOString(),
        };

        setState((s) => ({ ...s, lots: [newLot, ...s.lots] }));
        pushTx({
          type: "deposit",
          label: `Dépôt de collatéral · ${formatNumber(liters)} L ${grade}`,
          amount: `+${formatUsdc(liters * PRICE_PER_LITER, 0)} USDC de valeur`,
        });
      } catch {
        // Fallback mock si la transaction échoue
        await delay();
        const valueUsdc = liters * PRICE_PER_LITER;
        const serial = Math.floor(Math.random() * 9000) + 1000;
        setState((s) => ({
          ...s,
          lots: [
            {
              id: uid("lot"),
              tokenId: HEDERA_CONFIG.nftCollection,
              serial,
              collateralRef: toCollateralRef(HEDERA_CONFIG.nftCollection, serial),
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
          label: `Dépôt de collatéral · ${formatNumber(liters)} L ${grade} (simulation)`,
          amount: `+${formatUsdc(liters * PRICE_PER_LITER, 0)} USDC de valeur`,
        });
      }
    },
    [state.accountId, pushTx],
  );

  /**
   * Demande de prêt — appelle requestLoan() sur le smart contract.
   * amount est en USDC (≈ HBAR pour la démo : 1 HBAR ≈ 1 USDC simplifié).
   * HEDERA: requestLoanOnChain() → ContractExecuteTransaction (Server Function)
   */
  const requestLoan = useCallback(
    async (amount: number) => {
      // Utilise le premier lot comme collatéral de référence
      const collateralRef = state.lots[0]?.collateralRef ?? toCollateralRef(HEDERA_CONFIG.nftCollection, 1);
      try {
        // HEDERA: amount en USDC → converti en HBAR (ratio 1:1 pour la démo)
        const result = await requestLoanOnChain({
          data: { collateralRef, loanAmountHbar: amount },
        });

        const now = new Date();
        const due = new Date(now.getTime() + LOAN_TERM_DAYS * 86_400_000);
        setState((s) => ({
          ...s,
          loan: {
            id: result.txHash,
            contractId: HEDERA_CONFIG.contractId,
            collateralRef,
            principalUsdc: (s.loan?.principalUsdc ?? 0) + amount,
            amountDue: amount * 1.08, // 8% comme dans le contrat
            interestRate: BORROW_APR,
            startedAt: s.loan?.startedAt ?? now.toISOString(),
            dueAt: s.loan?.dueAt ?? due.toISOString(),
          },
        }));
        pushTx({
          type: "borrow",
          label: `Prêt accordé · tx ${result.txHash.slice(0, 20)}…`,
          amount: `+${formatUsdc(amount, 0)} HBAR`,
        });
      } catch {
        // Fallback mock
        await delay();
        const now = new Date();
        const due = new Date(now.getTime() + LOAN_TERM_DAYS * 86_400_000);
        setState((s) => ({
          ...s,
          loan: {
            id: uid("loan"),
            contractId: HEDERA_CONFIG.contractId,
            collateralRef,
            principalUsdc: (s.loan?.principalUsdc ?? 0) + amount,
            amountDue: amount * 1.08,
            interestRate: BORROW_APR,
            startedAt: s.loan?.startedAt ?? now.toISOString(),
            dueAt: s.loan?.dueAt ?? due.toISOString(),
          },
        }));
        pushTx({
          type: "borrow",
          label: "Prêt accordé en stablecoin (simulation)",
          amount: `+${formatUsdc(amount, 0)} HBAR`,
        });
      }
    },
    [state.lots, state.loan, pushTx],
  );

  /**
   * Remboursement — appelle repayLoan() en envoyant amountDue HBAR.
   * HEDERA: repayLoanOnChain() → ContractExecuteTransaction payable (Server Function)
   */
  const repayLoan = useCallback(async () => {
    if (!state.loan) return;
    const { collateralRef, amountDue } = state.loan;
    try {
      // HEDERA: envoie amountDue HBAR pour rembourser capital + 8%
      await repayLoanOnChain({
        data: { collateralRef, repaymentHbar: amountDue },
      });
      setState((s) => ({ ...s, loan: null }));
      pushTx({
        type: "repay",
        label: "Remboursement · collatéral libéré",
        amount: `${formatUsdc(amountDue, 2)} HBAR remboursés`,
      });
    } catch {
      // Fallback mock
      await delay();
      setState((s) => ({ ...s, loan: null }));
      pushTx({
        type: "repay",
        label: "Remboursement · collatéral libéré (simulation)",
        amount: "Prêt soldé",
      });
    }
  }, [state.loan, pushTx]);

  // ── Actions investisseur ────────────────────────────────────────────────────

  /**
   * Dépôt dans le pool — appelle fundPool() en envoyant des HBAR.
   * HEDERA: fundPoolOnChain() → ContractExecuteTransaction payable (Server Function)
   */
  const supplyToPool = useCallback(
    async (amount: number) => {
      try {
        // HEDERA: envoie amount HBAR vers le pool du contrat
        await fundPoolOnChain({ data: { amountHbar: amount } });
        setState((s) => ({ ...s, supplied: s.supplied + amount }));
        pushTx({
          type: "supply",
          label: "Dépôt dans le pool de liquidité",
          amount: `+${formatUsdc(amount, 0)} HBAR`,
        });
        // Rafraîchir le solde réel du pool après le dépôt
        const newBalance = await fetchPoolBalance().catch(() => null);
        if (newBalance !== null) {
          setState((s) => ({ ...s, poolTvlHbar: newBalance }));
        }
      } catch {
        // Fallback mock
        await delay();
        setState((s) => ({ ...s, supplied: s.supplied + amount }));
        pushTx({
          type: "supply",
          label: "Dépôt dans le pool de liquidité (simulation)",
          amount: `+${formatUsdc(amount, 0)} HBAR`,
        });
      }
    },
    [pushTx],
  );

  /**
   * Retrait du pool — non implémenté dans le smart contract actuel.
   * HEDERA: TODO — ajouter une fonction withdraw() dans OliveLoanSimple.sol
   */
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
      amount: `-${formatUsdc(total, 0)} HBAR`,
    });
  }, [pushTx]);

  // Intérêts investisseur simulés en continu
  useEffect(() => {
    if (state.supplied <= 0) return;
    setState((s) => ({
      ...s,
      earned: s.earned + (s.supplied * POOL_APY * 3) / 31_536_000,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // ── Valeurs calculées ───────────────────────────────────────────────────────

  const value = useMemo<OliveContextValue>(() => {
    const collateralValue = state.lots.reduce((a, l) => a + l.valueUsdc, 0);
    const totalLiters = state.lots.reduce((a, l) => a + l.liters, 0);
    const debt = state.loan ? state.loan.principalUsdc + accruedInterest(state.loan) : 0;
    const maxBorrow = Math.max(0, collateralValue * LTV - (state.loan?.principalUsdc ?? 0));

    // TVL = solde réel du contrat (en HBAR converti USDC 1:1) + dépôts locaux + base mock
    const poolTvl = state.poolTvlHbar > 0
      ? POOL_BASE_TVL + state.poolTvlHbar + state.supplied
      : POOL_BASE_TVL + state.supplied;

    const poolHistory: PoolPoint[] = [
      "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Sept.",
    ].map((label, i) => ({
      label,
      tvl: Math.round(
        620_000 + i * 104_000 + (i % 2 ? 18_000 : -9_000) + state.supplied + state.poolTvlHbar,
      ),
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
      refreshChainData,
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
    refreshChainData,
  ]);

  return <OliveContext.Provider value={value}>{children}</OliveContext.Provider>;
}

export function useOliveChain() {
  const ctx = useContext(OliveContext);
  if (!ctx) throw new Error("useOliveChain doit être utilisé dans OliveChainProvider");
  return ctx;
}
