/**
 * hederaActions.ts
 * TanStack Server Functions — s'exécutent côté serveur Node.js uniquement.
 * La clé privée HEDERA_PRIVATE_KEY est lue depuis l'env serveur (non exposée au client).
 *
 * Chaque fonction ici correspond à un appel blockchain réel via @hashgraph/sdk.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  PrivateKey,
  TokenMintTransaction,
} from "@hashgraph/sdk";

// ─── Client Hedera (côté serveur uniquement) ─────────────────────────────────

function buildClient(): Client {
  const accountId = process.env['VITE_HEDERA_ACCOUNT_ID'];
  const privateKey = process.env['HEDERA_PRIVATE_KEY'];
  if (!accountId || !privateKey) {
    throw new Error("Variables Hedera manquantes dans l'environnement serveur");
  }
  const client = Client.forTestnet();
  client.setOperator(accountId, PrivateKey.fromStringECDSA(privateKey));
  return client;
}

const CONTRACT_ID = process.env['VITE_HEDERA_CONTRACT_ID'] ?? "0.0.10560043";
const NFT_COLLECTION = process.env['VITE_HEDERA_NFT_COLLECTION'] ?? "0.0.10558547";
const TINYBARS_PER_HBAR = 100_000_000;

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Mint un NFT de dépôt pour un lot d'huile d'olive.
 * Correspond à ce que fait `mint-deposit-nft.js` dans OliveChain/.
 */
export const mintDepositNFT = createServerFn({ method: "POST" })
  .validator(
    (data: { farmer: string; quantity_liters: number; quality: string; date: string }) => data,
  )
  .handler(async ({ data }) => {
    const client = buildClient();
    try {
      const meta = JSON.stringify({
        farmer: data.farmer,
        quantity_liters: data.quantity_liters,
        quality: data.quality,
        date: data.date,
      });
      const metaBytes = Buffer.from(meta);
      if (metaBytes.length > 100) {
        throw new Error(`Métadonnées trop longues (${metaBytes.length}/100 bytes)`);
      }

      const tx = await new TokenMintTransaction()
        .setTokenId(NFT_COLLECTION)
        .setMetadata([metaBytes])
        .freezeWith(client)
        .sign(PrivateKey.fromStringECDSA(process.env['HEDERA_PRIVATE_KEY']!));

      const response = await tx.execute(client);
      const receipt = await response.getReceipt(client);
      const serial = receipt.serials[0]?.toString() ?? "0";

      return {
        success: true,
        tokenId: NFT_COLLECTION,
        serial: Number(serial),
        collateralRef: `${NFT_COLLECTION}-${serial}`,
        txHash: response.transactionId.toString(),
      };
    } finally {
      client.close();
    }
  });

/**
 * Demande un prêt : appelle requestLoan(collateralRef, loanAmount) sur le smart contract.
 * Correspond à `request-loan.js`.
 * loanAmountHbar : montant en HBAR (ex: 5 pour 5 HBAR).
 */
export const requestLoanOnChain = createServerFn({ method: "POST" })
  .validator((data: { collateralRef: string; loanAmountHbar: number }) => data)
  .handler(async ({ data }) => {
    const client = buildClient();
    try {
      const loanTinybars = new Hbar(data.loanAmountHbar).toTinybars();

      const tx = new ContractExecuteTransaction()
        .setContractId(CONTRACT_ID)
        .setGas(300_000)
        .setFunction(
          "requestLoan",
          new ContractFunctionParameters()
            .addString(data.collateralRef)
            .addUint256(loanTinybars),
        );

      const response = await tx.execute(client);
      const receipt = await response.getReceipt(client);

      return {
        success: true,
        status: receipt.status.toString(),
        txHash: response.transactionId.toString(),
        loanAmountHbar: data.loanAmountHbar,
        collateralRef: data.collateralRef,
      };
    } finally {
      client.close();
    }
  });

/**
 * Rembourse un prêt : appelle repayLoan(collateralRef) en envoyant du HBAR.
 * Correspond à `repay-loan.js`.
 */
export const repayLoanOnChain = createServerFn({ method: "POST" })
  .validator((data: { collateralRef: string; repaymentHbar: number }) => data)
  .handler(async ({ data }) => {
    const client = buildClient();
    try {
      const tx = new ContractExecuteTransaction()
        .setContractId(CONTRACT_ID)
        .setGas(300_000)
        .setPayableAmount(new Hbar(data.repaymentHbar))
        .setFunction(
          "repayLoan",
          new ContractFunctionParameters().addString(data.collateralRef),
        );

      const response = await tx.execute(client);
      const receipt = await response.getReceipt(client);

      return {
        success: true,
        status: receipt.status.toString(),
        txHash: response.transactionId.toString(),
      };
    } finally {
      client.close();
    }
  });

/**
 * Finance le pool de liquidité : appelle fundPool() en envoyant du HBAR.
 * Correspond à `fund-pool.js`.
 */
export const fundPoolOnChain = createServerFn({ method: "POST" })
  .validator((data: { amountHbar: number }) => data)
  .handler(async ({ data }) => {
    const client = buildClient();
    try {
      const tx = new ContractExecuteTransaction()
        .setContractId(CONTRACT_ID)
        .setGas(200_000)
        .setPayableAmount(new Hbar(data.amountHbar))
        .setFunction("fundPool");

      const response = await tx.execute(client);
      const receipt = await response.getReceipt(client);

      return {
        success: true,
        status: receipt.status.toString(),
        txHash: response.transactionId.toString(),
      };
    } finally {
      client.close();
    }
  });
