import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { readDb, getAccount } from "../db.js";

export const txRouter = Router();

/** GET /api/transactions/:accountId — historique des transactions d'un compte */
txRouter.get(
  "/:accountId",
  asyncHandler(async (req, res) => {
    const db = readDb();
    const account = getAccount(db, req.params.accountId);
    res.json({ accountId: req.params.accountId, txs: account.txs });
  }),
);
