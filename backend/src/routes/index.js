import { Router } from "express";
import { walletRouter } from "./wallet.routes.js";
import { collateralRouter } from "./collateral.routes.js";
import { loanRouter } from "./loan.routes.js";
import { poolRouter } from "./pool.routes.js";
import { txRouter } from "./tx.routes.js";

export const apiRouter = Router();

apiRouter.use("/wallet", walletRouter);
apiRouter.use("/collateral", collateralRouter);
apiRouter.use("/loan", loanRouter);
apiRouter.use("/pool", poolRouter);
apiRouter.use("/transactions", txRouter);
