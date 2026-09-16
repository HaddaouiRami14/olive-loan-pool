import { app } from "./app.js";
import { config, assertRuntimeConfig } from "./config/env.js";

try {
  assertRuntimeConfig();
} catch (err) {
 
  console.warn(`[startup] ${err.message}`);
  
  console.warn("[startup] Le serveur démarre quand même, mais les routes Hedera vont échouer.");
}

app.listen(config.port, () => {
 
  console.log(`
🫒 OliveChain backend prêt sur http://localhost:${config.port}
   Réseau Hedera   : ${config.hederaNetwork}
   Contrat         : ${config.contractId || "— (npm run deploy:contract)"}
   Token collatéral: ${config.collateralTokenId || "— (npm run setup:tokens)"}
   Token stablecoin: ${config.stablecoinTokenId || "— (npm run setup:tokens)"}
`);
});
