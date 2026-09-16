import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { supplyToPool, withdrawFromPool, getPoolHistory } from "../services/stateService.js";

export const poolRouter = Router();

/**
 * POST /api/pool/supply
 * Body: { accountId: string, amount: number }
 */
poolRouter.post(
  "/supply",
  asyncHandler(async (req, res) => {
    const { accountId, amount } = req.body ?? {};
    if (!accountId) return res.status(400).json({ error: true, message: "accountId requis" });
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: true, message: "amount doit être un nombre > 0" });
    }
    const state = await supplyToPool(accountId, Number(amount));
    res.json(state);
  }),
);

/**
 * POST /api/pool/withdraw
 * Body: { accountId: string }
 */
poolRouter.post(
  "/withdraw",
  asyncHandler(async (req, res) => {
    const { accountId } = req.body ?? {};
    if (!accountId) return res.status(400).json({ error: true, message: "accountId requis" });
    const state = await withdrawFromPool(accountId);
    res.json(state);
  }),
);

/** GET /api/pool/history — TVL global + série pour le graphique */
poolRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    const data = await getPoolHistory();
    res.json(data);
  }),
);
