import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    network: config.hederaNetwork,
    contractId: config.contractId || null,
    collateralTokenId: config.collateralTokenId || null,
    stablecoinTokenId: config.stablecoinTokenId || null,
  });
});

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
