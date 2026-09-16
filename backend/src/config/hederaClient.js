import { Client, PrivateKey, AccountId, Hbar } from "@hashgraph/sdk";
import { config } from "./env.js";

let client;

/**
 * Retourne un Client Hedera singleton, configuré avec le compte operator
 * (treasury custodial du backend). Toutes les transactions HTS et les
 * appels au smart contract passent par ce client.
 */
export function getHederaClient() {
  if (client) return client;

  if (!config.operatorId || !config.operatorKey) {
    throw new Error(
      "OPERATOR_ID / OPERATOR_KEY manquants dans .env — crée un compte testnet sur https://portal.hedera.com",
    );
  }

  client =
    config.hederaNetwork === "mainnet" ? Client.forMainnet() : Client.forTestnet();

  const operatorId = AccountId.fromString(config.operatorId);
  const operatorKey = PrivateKey.fromStringECDSA(config.operatorKey);

  client.setOperator(operatorId, operatorKey);
  client.setDefaultMaxTransactionFee(new Hbar(100)); // 100 HBAR cap de sécurité
  client.setDefaultMaxQueryPayment(new Hbar(10)); // 10 HBAR

  return client;
}

export function getOperatorId() {
  return AccountId.fromString(config.operatorId);
}

export function getOperatorKey() {
  return PrivateKey.fromStringECDSA(config.operatorKey);
}
