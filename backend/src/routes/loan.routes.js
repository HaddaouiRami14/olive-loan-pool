import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requestLoan, repayLoan } from "../services/stateService.js";

export const loanRouter = Router();

/**
 * POST /api/loan/request
 * Body: { accountId: string, amount: number }
 */
loanRouter.post(
  "/request",
  asyncHandler(async (req, res) => {
    const { accountId, amount } = req.body ?? {};
    if (!accountId) return res.status(400).json({ error: true, message: "accountId requis" });
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: true, message: "amount doit être un nombre > 0" });
    }
    const state = await requestLoan(accountId, Number(amount));
    res.json(state);
  }),
);

/**
 * POST /api/loan/repay
 * Body: { accountId: string }
 */
loanRouter.post(
  "/repay",
  asyncHandler(async (req, res) => {
    const { accountId } = req.body ?? {};
    if (!accountId) return res.status(400).json({ error: true, message: "accountId requis" });
    const state = await repayLoan(accountId);
    res.json(state);
  }),
);
