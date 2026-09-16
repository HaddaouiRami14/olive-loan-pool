import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { depositCollateral } from "../services/stateService.js";

export const collateralRouter = Router();

/**
 * POST /api/collateral/deposit
 * Body: { accountId: string, liters: number, grade: "extra-vierge"|"vierge"|"lampante" }
 */
collateralRouter.post(
  "/deposit",
  asyncHandler(async (req, res) => {
    const { accountId, liters, grade } = req.body ?? {};
    if (!accountId) return res.status(400).json({ error: true, message: "accountId requis" });
    if (!liters || Number(liters) <= 0) {
      return res.status(400).json({ error: true, message: "liters doit être un nombre > 0" });
    }
    if (!["extra-vierge", "vierge", "lampante"].includes(grade)) {
      return res.status(400).json({ error: true, message: "grade invalide" });
    }
    const state = await depositCollateral(accountId, Number(liters), grade);
    res.json(state);
  }),
);
