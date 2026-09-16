# OliveChain — Application complète (Frontend + Backend Hedera)

Projet du hackathon **Hedera Cross Campus Challenge 2026**. Deux dossiers :

```
olivechain/
├── frontend/   # React + TanStack Start (ton app "olive-loan-pool", branchée sur l'API réelle)
└── backend/    # Node.js + Express + Hedera SDK (HTS + Smart Contract)
```

Le frontend appelait auparavant des données 100% simulées
(`src/lib/olivechain.tsx`). Ce fichier a été réécrit pour appeler l'API du
backend via `fetch` — **même interface** (`useOliveChain()`, mêmes champs),
donc tous les autres composants n'ont pas changé.

## Démarrage rapide

### 1. Installer les dépendances

```bash
npm run install:all
```

(équivaut à `npm install` dans `frontend/` et `backend/` séparément)

### 2. Configurer le backend (Hedera testnet)

```bash
cd backend
cp .env.example .env
# remplis OPERATOR_ID / OPERATOR_KEY avec ton compte testnet (portal.hedera.com)
npm run setup:tokens     # crée les tokens HTS -> copie les IDs dans .env
npm run compile          # compile le smart contract
npm run deploy:contract  # déploie -> copie le CONTRACT_ID dans .env
cd ..
```

Détails complets : [`backend/README.md`](./backend/README.md).

### 3. Configurer le frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL=http://localhost:4000 par défaut, à ajuster si besoin
cd ..
```

### 4. Lancer les deux ensemble

```bash
npm run dev
```

→ backend sur `http://localhost:4000`, frontend sur le port affiché par Vite
(généralement `http://localhost:5173`). Ou lance-les séparément :

```bash
npm run dev:backend
npm run dev:frontend
```

## Comment ça se branche

`frontend/src/lib/olivechain.tsx` :

- `connectWallet()` → `POST /api/wallet/connect`
- `depositCollateral(liters, grade)` → `POST /api/collateral/deposit` (mint HTS + appel contrat)
- `requestLoan(amount)` → `POST /api/loan/request` (vérifie LTV 70% on-chain)
- `repayLoan()` → `POST /api/loan/repay` (solde la dette + libère le collatéral)
- `supplyToPool(amount)` / `withdrawFromPool()` → `POST /api/pool/supply` / `/withdraw`
- Un rafraîchissement automatique toutes les 6 secondes (`GET /api/wallet/state/:accountId`)
  met à jour la dette et les intérêts, calculés en continu par le smart contract.

Chaque action déclenche une vraie transaction sur le testnet Hedera : le
`hash` affiché dans l'historique des transactions du frontend est un vrai
`transactionId`, vérifiable sur [HashScan](https://hashscan.io/testnet).

## Modèle custodial (à dire pendant le pitch)

Le backend utilise un seul compte Hedera "operator" pour exécuter toutes les
opérations (mint HTS, appels au smart contract) — pas besoin de wallet
HashPack côté navigateur pour la démo. `backend/README.md` §7 explique
précisément comment ça marche et comment passer à un modèle non-custodial
avec de vrais wallets utilisateurs si tu as le temps de l'implémenter avant
le pitch.

## Déploiement / démo live

Pour une démo hors de ta machine (ex. sur un poste du jury) :

1. Déploie `backend/` sur un service Node (Render, Railway, Fly.io...) avec
   les mêmes variables d'environnement.
2. Mets à jour `VITE_API_URL` dans `frontend/.env` vers l'URL publique du
   backend, puis `npm run build --prefix frontend`.
3. Le smart contract et les tokens restent les mêmes (déployés une seule
   fois sur testnet) — pas besoin de refaire `setup:tokens` / `deploy:contract`.
