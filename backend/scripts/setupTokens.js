import { createCollateralToken, createStablecoinToken } from "../src/services/tokenService.js";

async function main() {
  console.log("⏳ Création du token de collatéral (OLV)...");
  const collateralTokenId = await createCollateralToken();
  console.log(`✅ OLV créé: ${collateralTokenId}`);

  console.log("⏳ Création du stablecoin simulé (OUSD)...");
  const stablecoinTokenId = await createStablecoinToken();
  console.log(`✅ OUSD créé: ${stablecoinTokenId}`);

  console.log("\n👉 Ajoute ces lignes dans ton fichier .env :");
  console.log(`COLLATERAL_TOKEN_ID=${collateralTokenId}`);
  console.log(`STABLECOIN_TOKEN_ID=${stablecoinTokenId}`);
}

main().catch((err) => {
  console.error("❌ Échec de la création des tokens:", err);
  process.exit(1);
});
