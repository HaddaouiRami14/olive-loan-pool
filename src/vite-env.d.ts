/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HEDERA_ACCOUNT_ID: string;
  readonly VITE_HEDERA_CONTRACT_ID: string;
  readonly VITE_HEDERA_NFT_COLLECTION: string;
  readonly VITE_HEDERA_NETWORK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
