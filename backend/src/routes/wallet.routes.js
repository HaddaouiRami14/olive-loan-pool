import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { connectWallet, getState } from "../services/stateService.js";

export const walletRouter = Router();

/**
 * POST /api/wallet/connect
 * Body: { accountId?: string }
 * Si accountId n'est pas fourni, on simule l'attribution d'un compte
 * Hedera testnet (comme le ferait un wallet HashPack côté démo).
 */
walletRouter.post(
  "/connect",
  asyncHandler(async (req, res) => {
    const accountId = req.body?.accountId || "0.0.482017";
    const state = await connectWallet(accountId);
    res.json(state);
  }),
);

walletRouter.get(
  "/state/:accountId",
  asyncHandler(async (req, res) => {
    const state = await getState(req.params.accountId);
    res.json(state);
  }),
);
