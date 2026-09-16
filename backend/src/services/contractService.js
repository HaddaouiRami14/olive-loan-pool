import {
  ContractExecuteTransaction,
  ContractCallQuery,
  ContractFunctionParameters,
  Hbar,
} from "@hashgraph/sdk";
import { getHederaClient, getOperatorKey } from "../config/hederaClient.js";
import { config } from "../config/env.js";

const toUnits = (usdc) => Math.round(usdc * 10 ** config.stablecoinDecimals);
const toUsdc = (units) => Number(units) / 10 ** config.stablecoinDecimals;

async function execute(functionName, params, gas = 300_000) {
  const client = getHederaClient();
  const tx = await new ContractExecuteTransaction()
    .setContractId(config.contractId)
    .setGas(gas)
    .setFunction(functionName, params)
    .setMaxTransactionFee(new Hbar(5))
    .freezeWith(client)
    .sign(getOperatorKey());

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);
  return {
    transactionId: submit.transactionId.toString(),
    status: receipt.status.toString(),
  };
}

async function call(functionName, params, gas = 100_000) {
  const client = getHederaClient();
  const result = await new ContractCallQuery()
    .setContractId(config.contractId)
    .setGas(gas)
    .setFunction(functionName, params)
    .setMaxQueryPayment(new Hbar(2))
    .execute(client);
  return result;
}

export async function contractDepositCollateral(accountId, valueUsdc) {
  const params = new ContractFunctionParameters()
    .addString(accountId)
    .addUint256(toUnits(valueUsdc));
  return execute("depositCollateral", params);
}

export async function contractRequestLoan(accountId, amountUsdc) {
  const params = new ContractFunctionParameters()
    .addString(accountId)
    .addUint256(toUnits(amountUsdc));
  return execute("requestLoan", params);
}

export async function contractRepayLoan(accountId) {
  const params = new ContractFunctionParameters().addString(accountId);
  return execute("repayLoan", params);
}

export async function contractSupplyToPool(accountId, amountUsdc) {
  const params = new ContractFunctionParameters()
    .addString(accountId)
    .addUint256(toUnits(amountUsdc));
  return execute("supplyToPool", params);
}

export async function contractWithdrawFromPool(accountId) {
  const params = new ContractFunctionParameters().addString(accountId);
  return execute("withdrawFromPool", params);
}


export async function getOnChainPosition(accountId) {
  const params = new ContractFunctionParameters().addString(accountId);
  const result = await call("getPosition", params, 150_000);
  return {
    collateralValueUsdc: toUsdc(result.getUint256(0)),
    loanPrincipal: toUsdc(result.getUint256(1)),
    currentDebt: toUsdc(result.getUint256(2)),
    maxBorrowable: toUsdc(result.getUint256(3)),
    supplied: toUsdc(result.getUint256(4)),
    earned: toUsdc(result.getUint256(5)),
  };
}

export async function getPoolTotalSupplied() {
  const result = await call("poolTotalSupplied", new ContractFunctionParameters(), 60_000);
  return toUsdc(result.getUint256(0));
}
