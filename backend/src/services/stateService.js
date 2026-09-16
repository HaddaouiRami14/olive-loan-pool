import { config } from "../config/env.js";
import {
  readDb,
  writeDb,
  getAccount,
  pushTx,
  samplePoolHistory,
  computePoolTvl,
} from "../db.js";
import { mintCollateral, burnCollateral, recordStablecoinMovement, transferStablecoinTo } from "./tokenService.js";
import {
  contractDepositCollateral,
  contractRequestLoan,
  contractRepayLoan,
  contractSupplyToPool,
  contractWithdrawFromPool,
  getOnChainPosition,
} from "./contractService.js";

const LOAN_TERM_DAYS = 180;

function formatUsdc(value, digits = 0) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}


async function buildStateResponse(accountId, account, onChain) {
  const collateralValue = account.lots.reduce((a, l) => a + l.valueUsdc, 0);
  const totalLiters = account.lots.reduce((a, l) => a + l.liters, 0);
  const debt = onChain.currentDebt;
  const maxBorrow = onChain.maxBorrowable;

  const db = readDb();
  const poolTvl = computePoolTvl(db);

  return {
    accountId,
    lots: account.lots,
    loan: account.loan
      ? {
          ...account.loan,
          
          currentDebt: debt,
        }
      : null,
    supplied: onChain.supplied,
    earned: onChain.earned,
    txs: account.txs,
    collateralValue,
    totalLiters,
    maxBorrow,
    debt,
    healthRatio: collateralValue > 0 ? debt / collateralValue : 0,
    poolTvl,
    poolHistory: db.poolHistory,
  };
}

export async function connectWallet(accountId) {
  const db = readDb();
  const account = getAccount(db, accountId);
  try {
    const onChain = await getOnChainPosition(accountId);
    account._lastOnChain = onChain;
    writeDb(db);
    return buildStateResponse(accountId, account, onChain);
  } catch (err) {
    if (account._lastOnChain) {
      return buildStateResponse(accountId, account, account._lastOnChain);
    }
    throw err;
  }
}

export async function getState(accountId) {
  const db = readDb();
  const account = getAccount(db, accountId);
  try {
    const onChain = await getOnChainPosition(accountId);
    account._lastOnChain = onChain;
    writeDb(db);
    return buildStateResponse(accountId, account, onChain);
  } catch (err) {
    if (account._lastOnChain) {
      return buildStateResponse(accountId, account, account._lastOnChain);
    }
  
    const fallbackOnChain = {
      collateralValueUsdc: account.lots.reduce((a, l) => a + l.valueUsdc, 0),
      loanPrincipal: account.loan?.principalUsdc ?? 0,
      currentDebt: account.loan?.principalUsdc ?? 0,
      maxBorrowable: Math.max(0, (account.lots.reduce((a, l) => a + l.valueUsdc, 0) * 0.7) - (account.loan?.principalUsdc ?? 0)),
      supplied: account.supplied ?? 0,
      earned: account.earned ?? 0,
    };
    return buildStateResponse(accountId, account, fallbackOnChain);
  }
}

export async function depositCollateral(accountId, liters, grade) {
  if (!(liters > 0)) throw new Error("liters doit être > 0");
  const valueUsdc = liters * config.pricePerLiter;

  const mint = await mintCollateral(liters);
  await contractDepositCollateral(accountId, valueUsdc);

  const db = readDb();
  const account = getAccount(db, accountId);
  const lot = {
    id: `lot-${Date.now()}`,
    tokenId: config.collateralTokenId,
    liters,
    grade,
    valueUsdc,
    createdAt: new Date().toISOString(),
  };
  account.lots.unshift(lot);
  pushTx(account, {
    type: "deposit",
    label: `Dépôt de collatéral · ${formatNumber(liters)} L ${grade}`,
    amount: `+${formatUsdc(valueUsdc)} USDC de valeur`,
    hash: mint.transactionId,
  });
  samplePoolHistory(db, computePoolTvl(db));
  writeDb(db);

  const onChain = await getOnChainPosition(accountId);
  return buildStateResponse(accountId, account, onChain);
}

export async function requestLoan(accountId, amount) {
  if (!(amount > 0)) throw new Error("amount doit être > 0");

  await contractRequestLoan(accountId, amount);
  let movement;
  try {
    movement = await transferStablecoinTo(accountId, amount);
  } catch (_err) {
    movement = await recordStablecoinMovement(amount, `Prêt accordé à ${accountId}`);
  }

  const db = readDb();
  const account = getAccount(db, accountId);
  const now = new Date();
  const due = new Date(now.getTime() + LOAN_TERM_DAYS * 86_400_000);
  account.loan = {
    id: account.loan?.id ?? `loan-${Date.now()}`,
    contractId: config.contractId,
    principalUsdc: (account.loan?.principalUsdc ?? 0) + amount,
    interestRate: 0.09,
    startedAt: account.loan?.startedAt ?? now.toISOString(),
    dueAt: account.loan?.dueAt ?? due.toISOString(),
  };
  pushTx(account, {
    type: "borrow",
    label: "Prêt accordé en stablecoin",
    amount: `+${formatUsdc(amount)} USDC`,
    hash: movement.transactionId,
  });
  writeDb(db);

  const onChain = await getOnChainPosition(accountId);
  return buildStateResponse(accountId, account, onChain);
}

export async function repayLoan(accountId) {
  const onChainBefore = await getOnChainPosition(accountId);
  if (!(onChainBefore.currentDebt > 0)) throw new Error("Aucun prêt actif à rembourser");

  await contractRepayLoan(accountId);
  const movement = await recordStablecoinMovement(
    onChainBefore.currentDebt,
    `Remboursement de ${accountId}`,
  );

  const db = readDb();
  const account = getAccount(db, accountId);
  const totalLiters = account.lots.reduce((a, l) => a + l.liters, 0);
  if (totalLiters > 0) {
    // Libère (brûle) le collatéral tokenisé maintenant que le prêt est soldé
    await burnCollateral(totalLiters);
  }
  account.loan = null;
  pushTx(account, {
    type: "repay",
    label: "Remboursement · collatéral libéré",
    amount: `-${formatUsdc(onChainBefore.currentDebt)} USDC`,
    hash: movement.transactionId,
  });
  writeDb(db);

  const onChain = await getOnChainPosition(accountId);
  return buildStateResponse(accountId, account, onChain);
}

export async function supplyToPool(accountId, amount) {
  if (!(amount > 0)) throw new Error("amount doit être > 0");

  await contractSupplyToPool(accountId, amount);
  const movement = await recordStablecoinMovement(amount, `Dépôt pool par ${accountId}`);

  const db = readDb();
  const account = getAccount(db, accountId);
  account.supplied += amount;
  pushTx(account, {
    type: "supply",
    label: "Dépôt dans le pool de liquidité",
    amount: `+${formatUsdc(amount)} USDC`,
    hash: movement.transactionId,
  });
  samplePoolHistory(db, computePoolTvl(db));
  writeDb(db);

  const onChain = await getOnChainPosition(accountId);
  return buildStateResponse(accountId, account, onChain);
}

export async function withdrawFromPool(accountId) {
  const onChainBefore = await getOnChainPosition(accountId);
  if (!(onChainBefore.supplied > 0)) throw new Error("Rien à retirer du pool");

  await contractWithdrawFromPool(accountId);
  const total = onChainBefore.supplied + onChainBefore.earned;
  const movement = await recordStablecoinMovement(total, `Retrait pool par ${accountId}`);

  const db = readDb();
  const account = getAccount(db, accountId);
  account.supplied = 0;
  account.earned = 0;
  pushTx(account, {
    type: "withdraw",
    label: "Retrait du pool (capital + intérêts)",
    amount: `-${formatUsdc(total)} USDC`,
    hash: movement.transactionId,
  });
  samplePoolHistory(db, computePoolTvl(db));
  writeDb(db);

  const onChain = await getOnChainPosition(accountId);
  return buildStateResponse(accountId, account, onChain);
}

export async function getPoolHistory() {
  const db = readDb();
  return { poolTvl: computePoolTvl(db), poolHistory: db.poolHistory };
}
