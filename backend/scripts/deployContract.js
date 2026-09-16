import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ContractCreateFlow } from "@hashgraph/sdk";
import { getHederaClient } from "../src/config/hederaClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARTIFACT_PATH = path.join(__dirname, "..", "artifacts", "OliveChainPool.json");

async function main() {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    console.error("❌ Artifact introuvable. Lance d'abord: npm run compile");
    process.exit(1);
  }
  const { bytecode } = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf-8"));
  const client = getHederaClient();

  console.log("⏳ Déploiement du smart contract OliveChainPool sur Hedera testnet...");

  const flow = new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(4_000_000)
    .setConstructorParameters(); // constructor() sans paramètres

  const submit = await flow.execute(client);
  const receipt = await submit.getReceipt(client);
  const contractId = receipt.contractId.toString();

  console.log("✅ Contrat déployé !");
  console.log(`   CONTRACT_ID=${contractId}`);
  console.log(`   Transaction : ${submit.transactionId.toString()}`);
  console.log("\n👉 Ajoute cette ligne dans ton fichier .env :");
  console.log(`CONTRACT_ID=${contractId}`);
}

main().catch((err) => {
  console.error("❌ Échec du déploiement:", err);
  process.exit(1);
});
