import dotenv from "dotenv";

dotenv.config();

function required(name, { optional = false } = {}) {
  const value = process.env[name];
  if (!value && !optional) {
    // eslint-disable-next-line no-console
    console.warn(
      `[config] ⚠️  ${name} n'est pas défini dans .env — certaines routes vont échouer tant que tu ne l'as pas configuré.`,
    );
  }
  return value ?? "";
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",

  hederaNetwork: process.env.HEDERA_NETWORK ?? "testnet",
  operatorId: required("OPERATOR_ID"),
  operatorKey: required("OPERATOR_KEY"),

  collateralTokenId: required("COLLATERAL_TOKEN_ID", { optional: true }),
  stablecoinTokenId: required("STABLECOIN_TOKEN_ID", { optional: true }),
  contractId: required("CONTRACT_ID", { optional: true }),

  pricePerLiter: Number(process.env.PRICE_PER_LITER ?? 8.5),

  // Décimales du token stablecoin (utilisées pour convertir "USDC" <-> unités entières)
  stablecoinDecimals: 6,
};

export function assertRuntimeConfig() {
  const missing = [];
  if (!config.operatorId) missing.push("OPERATOR_ID");
  if (!config.operatorKey) missing.push("OPERATOR_KEY");
  if (!config.contractId) missing.push("CONTRACT_ID (lance `npm run deploy:contract`)");
  if (!config.collateralTokenId || !config.stablecoinTokenId) {
    missing.push("COLLATERAL_TOKEN_ID / STABLECOIN_TOKEN_ID (lance `npm run setup:tokens`)");
  }
  if (missing.length) {
    throw new Error(
      `Configuration incomplète, il manque: ${missing.join(", ")}. Vérifie ton fichier .env.`,
    );
  }
}
