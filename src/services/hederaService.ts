/**
 * hederaService.ts
 * Couche d'accès aux données Hedera pour OliveChain.
 *
 * Lecture  → Hedera Mirror Node REST API (aucun SDK, aucune clé requise)
 * Écriture → TanStack Server Functions (clé privée côté serveur uniquement)
 */

// ─── Constantes ─────────────────────────────────────────────────────────────

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

export const HEDERA_CONFIG = {
  accountId: (import.meta.env['VITE_HEDERA_ACCOUNT_ID'] ?? "") as string,
  contractId: (import.meta.env['VITE_HEDERA_CONTRACT_ID'] ?? "") as string,
  nftCollection: (import.meta.env['VITE_HEDERA_NFT_COLLECTION'] ?? "") as string,
  network: (import.meta.env['VITE_HEDERA_NETWORK'] ?? "testnet") as string,
};

// 1 HBAR = 100_000_000 tinybars
export const TINYBARS_PER_HBAR = 100_000_000;
// Prix oracle simulé : 1 litre d'huile = 8.5 USDC (identique au frontend mock)
export const PRICE_PER_LITER = 8.5;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MirrorNFT {
  token_id: string;
  serial_number: number;
  metadata: string; // base64-encoded JSON
  created_timestamp: string;
}

export interface ContractCallResult {
  result: string; // hex-encoded return value
}

export interface MirrorTransaction {
  transaction_id: string;
  consensus_timestamp: string;
  name: string;
  result: string;
  transfers: Array<{ account: string; amount: number }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function mirrorGet<T>(path: string): Promise<T> {
  const res = await fetch(`${MIRROR_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Mirror Node ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export interface NFTLotMetadata {
  farmer?: string;
  quantity_liters?: number;
  quality?: string;
  date?: string;
}

/** Décoder les métadonnées NFT (base64 → JSON) */
function decodeNFTMetadata(base64: string): NFTLotMetadata {
  try {
    const json = atob(base64);
    return JSON.parse(json) as NFTLotMetadata;
  } catch {
    return {};
  }
}

/** Formate un collateralRef depuis un NFT Hedera : "collectionId-serial" */
export function toCollateralRef(tokenId: string, serial: number): string {
  return `${tokenId}-${serial}`;
}

// ─── Lecture — Mirror Node ────────────────────────────────────────────────────

/**
 * Récupère les informations de base d'un compte Hedera.
 * Utilisé pour vérifier qu'un Account ID existe avant de "connecter".
 */
export async function fetchAccountInfo(accountId: string) {
  const data = await mirrorGet<{ account: string; balance: { balance: number } }>(
    `/accounts/${accountId}`,
  );
  return {
    accountId: data.account,
    balanceTinybars: data.balance.balance,
    balanceHbar: data.balance.balance / TINYBARS_PER_HBAR,
  };
}

/**
 * Récupère tous les NFTs OLVDEP détenus par un compte.
 * Chaque NFT = un dépôt de collatéral.
 */
export async function fetchFarmerNFTs(accountId: string) {
  const collectionId = HEDERA_CONFIG.nftCollection;
  const data = await mirrorGet<{ nfts: MirrorNFT[] }>(
    `/tokens/${collectionId}/nfts?account.id=${accountId}&limit=100`,
  );

  return data.nfts.map((nft) => {
    const meta = decodeNFTMetadata(nft.metadata);
    const liters = typeof meta.quantity_liters === "number" ? meta.quantity_liters : 0;
    const quality = typeof meta.quality === "string" ? meta.quality : "Extra Vierge";
    const grade = qualityToGrade(quality);

    return {
      id: `lot-${nft.serial_number}`,
      tokenId: nft.token_id,
      serial: nft.serial_number,
      collateralRef: toCollateralRef(nft.token_id, nft.serial_number),
      liters,
      grade,
      quality,
      valueUsdc: liters * PRICE_PER_LITER,
      createdAt: nft.created_timestamp
        ? new Date(Number(nft.created_timestamp.split(".")[0]) * 1000).toISOString()
        : new Date().toISOString(),
    };
  });
}

/** Convertit la qualité string du NFT vers le type Grade du frontend */
function qualityToGrade(quality: string): "extra-vierge" | "vierge" | "lampante" {
  const q = quality.toLowerCase();
  if (q.includes("extra")) return "extra-vierge";
  if (q.includes("vierge")) return "vierge";
  return "lampante";
}

/**
 * Lit le solde du pool de liquidité directement depuis le smart contract.
 * Appel de lecture (view) → Mirror Node, pas de signature requise.
 */
export async function fetchPoolBalance(): Promise<number> {
  // poolBalance() n'a pas de paramètres → calldata = selector seul
  // keccak256("poolBalance()") = 0x97e45627
  const calldata = "0x97e45627";
  const contractId = HEDERA_CONFIG.contractId;

  const data = await mirrorGet<ContractCallResult>(
    `/contracts/${contractId}/results/calls?calldata=${calldata}`,
  ).catch(() => null);

  // Si le Mirror Node ne supporte pas cet endpoint, on lit le solde du compte contrat
  if (!data) {
    const account = await mirrorGet<{ balance: { balance: number } }>(
      `/contracts/${contractId}`,
    );
    return (account.balance?.balance ?? 0) / TINYBARS_PER_HBAR;
  }

  // Décoder la réponse hex (uint256 BE, 32 bytes)
  const hex = data.result.replace("0x", "");
  const tinybars = parseInt(hex, 16);
  return isNaN(tinybars) ? 0 : tinybars / TINYBARS_PER_HBAR;
}

/**
 * Lit l'historique des transactions du smart contract.
 * Retourne les 25 dernières txs impliquant le contrat.
 */
export async function fetchContractTransactions() {
  const contractId = HEDERA_CONFIG.contractId;
  const data = await mirrorGet<{ transactions: MirrorTransaction[] }>(
    `/transactions?account.id=${contractId}&limit=25&order=desc`,
  ).catch(() => ({ transactions: [] }));

  return data.transactions.map((tx) => ({
    id: tx.transaction_id,
    hash: tx.transaction_id,
    at: tx.consensus_timestamp
      ? new Date(Number(tx.consensus_timestamp.split(".")[0]) * 1000).toISOString()
      : new Date().toISOString(),
    type: classifyTxName(tx.name),
    label: labelFromTxName(tx.name),
    amount: extractAmount(tx.transfers, contractId),
    status: tx.result,
  }));
}

function classifyTxName(name: string): "deposit" | "borrow" | "repay" | "supply" | "withdraw" {
  const n = name.toLowerCase();
  if (n.includes("tokenm")) return "deposit"; // TokenMintTransaction
  if (n.includes("fund")) return "supply";
  if (n.includes("repay")) return "repay";
  if (n.includes("request")) return "borrow";
  return "deposit";
}

function labelFromTxName(name: string): string {
  const map: Record<string, string> = {
    TOKENMINTTRANSACTION: "Dépôt de collatéral (NFT minté)",
    CONTRACTCALLTRANSACTION: "Interaction avec le contrat",
    CRYPTOTRANSFER: "Transfert HBAR",
  };
  return map[name.toUpperCase()] ?? name;
}

function extractAmount(
  transfers: Array<{ account: string; amount: number }>,
  contractId: string,
): string {
  const contractTransfer = transfers.find((t) => t.account === contractId);
  if (!contractTransfer) return "—";
  const hbar = Math.abs(contractTransfer.amount) / TINYBARS_PER_HBAR;
  return `${contractTransfer.amount > 0 ? "+" : "-"}${hbar.toFixed(2)} HBAR`;
}
