import {
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TokenMintTransaction,
  TokenBurnTransaction,
  TransferTransaction,
  AccountId,
  Hbar,
} from "@hashgraph/sdk";
import { getHederaClient, getOperatorId, getOperatorKey } from "../config/hederaClient.js";
import { config } from "../config/env.js";

export async function createCollateralToken() {
  const client = getHederaClient();
  const tx = await new TokenCreateTransaction()
    .setTokenName("OliveChain Collateral")
    .setTokenSymbol("OLV")
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(0)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(getOperatorId())
    .setSupplyKey(getOperatorKey())
    .setAdminKey(getOperatorKey())
    .freezeWith(client)
    .sign(getOperatorKey());

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);
  return receipt.tokenId.toString();
}


export async function createStablecoinToken() {
  const client = getHederaClient();
  const initialSupply = 10_000_000 * 10 ** config.stablecoinDecimals; // 10M OUSD

  const tx = await new TokenCreateTransaction()
    .setTokenName("OliveChain USD (simulé)")
    .setTokenSymbol("OUSD")
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(config.stablecoinDecimals)
    .setInitialSupply(initialSupply)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(getOperatorId())
    .setSupplyKey(getOperatorKey())
    .setAdminKey(getOperatorKey())
    .freezeWith(client)
    .sign(getOperatorKey());

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);
  return receipt.tokenId.toString();
}


export async function mintCollateral(liters) {
  const client = getHederaClient();
  const tx = await new TokenMintTransaction()
    .setTokenId(config.collateralTokenId)
    .setAmount(Math.round(liters))
    .freezeWith(client)
    .sign(getOperatorKey());

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);
  return {
    transactionId: submit.transactionId.toString(),
    status: receipt.status.toString(),
  };
}

export async function burnCollateral(liters) {
  const client = getHederaClient();
  const tx = await new TokenBurnTransaction()
    .setTokenId(config.collateralTokenId)
    .setAmount(Math.round(liters))
    .freezeWith(client)
    .sign(getOperatorKey());

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);
  return {
    transactionId: submit.transactionId.toString(),
    status: receipt.status.toString(),
  };
}

export async function recordStablecoinMovement(amountUsdc, memo) {
  const client = getHederaClient();
  const operatorId = getOperatorId();
  const feeCollector = AccountId.fromString("0.0.98");

  const tx = await new TransferTransaction()
    .setTransactionMemo(`OliveChain: ${memo} (${amountUsdc.toFixed(2)} OUSD)`.slice(0, 100))
    .addHbarTransfer(operatorId, Hbar.fromTinybars(-1))
    .addHbarTransfer(feeCollector, Hbar.fromTinybars(1))
    .freezeWith(client)
    .sign(getOperatorKey());

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);
  return {
    transactionId: submit.transactionId.toString(),
    status: receipt.status.toString(),
  };
}


export async function transferStablecoinTo(toAccountId, amountUsdc) {
  const client = getHederaClient();
  const units = Math.round(amountUsdc * 10 ** config.stablecoinDecimals);
  const operatorId = getOperatorId();
  const destination = AccountId.fromString(toAccountId);

  const tx = await new TransferTransaction()
    .addTokenTransfer(config.stablecoinTokenId, operatorId, -units)
    .addTokenTransfer(config.stablecoinTokenId, destination, units)
    .freezeWith(client)
    .sign(getOperatorKey());

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);
  return {
    transactionId: submit.transactionId.toString(),
    status: receipt.status.toString(),
  };
}
