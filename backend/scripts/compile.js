import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_PATH = path.join(__dirname, "..", "contracts", "OliveChainPool.sol");
const OUTPUT_DIR = path.join(__dirname, "..", "artifacts");

function main() {
  const source = fs.readFileSync(CONTRACT_PATH, "utf-8");

  const input = {
    language: "Solidity",
    sources: {
      "OliveChainPool.sol": { content: source },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object"] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  const errors = (output.errors ?? []).filter((e) => e.severity === "error");
  if (errors.length) {
    errors.forEach((e) => console.error(e.formattedMessage));
    process.exit(1);
  }
  (output.errors ?? [])
    .filter((e) => e.severity === "warning")
    .forEach((e) => console.warn(e.formattedMessage));

  const contract = output.contracts["OliveChainPool.sol"]["OliveChainPool"];
  const artifact = {
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object,
  };

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "OliveChainPool.json"),
    JSON.stringify(artifact, null, 2),
  );

  console.log("✅ Contrat compilé -> artifacts/OliveChainPool.json");
  console.log(`   Taille bytecode: ${artifact.bytecode.length / 2} bytes`);
}

main();
