/**
 * hederaActions.ts
 * TanStack Server Functions — s'exécutent côté serveur Node.js uniquement.
 * La clé privée HEDERA_PRIVATE_KEY est lue depuis l'env serveur (non exposée au client).
 *
 * Chaque fonction ici correspond à un appel blockchain réel via @hashgraph/sdk.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  AccountId,
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  NftId,
  PrivateKey,
  TokenId,
  TokenMintTransaction,
  TransferTransaction,
} from "@hashgraph/sdk";

// ─── Client Hedera (côté serveur uniquement) ─────────────────────────────────

const OPERATOR_ID = process.env['HEDERA_OPERATOR_ID'] ?? "0.0.10528188";
const OPERATOR_KEY =
  process.env['HEDERA_OPERATOR_KEY'] ??
  process.env['HEDERA_PRIVATE_KEY'] ??
  "0x44f1ebaae2428b45ad449737b4f74202d635106f9dcdb95dc175dcbbc74525d8";

function buildClient(): Client {
  const client = Client.forTestnet();
  client.setOperator(OPERATOR_ID, PrivateKey.fromStringECDSA(OPERATOR_KEY));
  return client;
}

/**
 * Client pour les actions initiées par l'utilisateur (prêt, remboursement, financement).
 * Si une clé utilisateur est configurée, elle signe la transaction directement
 * pour apparaître dans l'historique HashPack du wallet.
 */
function buildUserClient(): Client {
  const userAccountId = process.env['VITE_HEDERA_ACCOUNT_ID'];
  const userKey = process.env['USER_PRIVATE_KEY'];

  if (userAccountId && userKey) {
    try {
      const client = Client.forTestnet();
      client.setOperator(
        userAccountId,
        userKey.startsWith("0x")
          ? PrivateKey.fromStringECDSA(userKey)
          : PrivateKey.fromStringDer(userKey)
      );
      return client;
    } catch {
      // Fallback vers l'opérateur serveur
    }
  }
  return buildClient();
}

const CONTRACT_ID = process.env['VITE_HEDERA_CONTRACT_ID'] ?? "0.0.10560043";
const NFT_COLLECTION = process.env['VITE_HEDERA_NFT_COLLECTION'] ?? "0.0.10558547";
const TINYBARS_PER_HBAR = 100_000_000;

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Mint un NFT de dépôt pour un lot d'huile d'olive et le transfère au fermier.
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
        .sign(PrivateKey.fromStringECDSA(OPERATOR_KEY));

      const response = await tx.execute(client);
      const receipt = await response.getReceipt(client);
      const serial = receipt.serials[0]?.toString() ?? "0";

      // Si le fermier est un compte différent du serveur (ex: HashPack 0.0.10568767), lui transférer le NFT
      if (data.farmer && data.farmer !== OPERATOR_ID) {
        try {
          const transferTx = await new TransferTransaction()
            .addNftTransfer(
              new NftId(TokenId.fromString(NFT_COLLECTION), Number(serial)),
              AccountId.fromString(OPERATOR_ID),
              AccountId.fromString(data.farmer),
            )
            .freezeWith(client)
            .execute(client);
          await transferTx.getReceipt(client);
        } catch (transferErr) {
          console.warn("Note: NFT minté. Le transfert vers le wallet requiert l'association du token dans HashPack:", transferErr);
        }
      }

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
    const client = buildUserClient();
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
    const client = buildUserClient();
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
    const client = buildUserClient();
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
