# OliveChain — Backend (Node.js + Hedera Hashgraph)

Backend complet pour le hackathon **Hedera Cross Campus Challenge 2026**.
Remplace la couche `src/lib/olivechain.tsx` (mock) du frontend par de vraies
opérations **Hedera testnet** :

- **HTS (Hedera Token Service)** : token `OLV` (collatéral huile d'olive tokenisé)
  + token `OUSD` (stablecoin simulé pour prêts / pool).
- **Smart Contract** (`contracts/OliveChainPool.sol`) déployé via le
  **Hedera Smart Contract Service** : logique LTV 70%, intérêts prêt 9% APR,
  rendement pool 8.1% APY, calculés on-chain via `block.timestamp`.
- **API REST Express** qui orchestre les deux et sert le frontend.

## 1. Prérequis

- Node.js ≥ 18
- Un compte **Hedera Testnet** (gratuit) : crée-le sur
  [portal.hedera.com](https://portal.hedera.com) → récupère ton `Account ID`
  (ex. `0.0.123456`) et ta clé privée **ED25519** (format DER, commence par
  `302e0201...`).

## 2. Installation

```bash
cd backend
npm install
cp .env.example .env
```

Ouvre `.env` et remplis :

```
OPERATOR_ID=0.0.xxxxxx
OPERATOR_KEY=302e0201...
```

## 3. Mise en place Hedera (une seule fois)

### a. Créer les tokens HTS

```bash
npm run setup:tokens
```

Copie les `COLLATERAL_TOKEN_ID` et `STABLECOIN_TOKEN_ID` affichés dans `.env`.

### b. Compiler + déployer le smart contract

```bash
npm run compile
npm run deploy:contract
```

Copie le `CONTRACT_ID` affiché dans `.env`.

## 4. Lancer le serveur

```bash
npm run dev
```

→ `http://localhost:4000`. Vérifie `GET /health` pour confirmer que
`contractId` / `collateralTokenId` / `stablecoinTokenId` sont bien chargés.

## 5. Endpoints API

Base URL : `http://localhost:4000/api`

| Méthode | Route                        | Body / Params                                   | Description                              |
|---------|-------------------------------|--------------------------------------------------|-------------------------------------------|
| POST    | `/wallet/connect`             | `{ accountId? }`                                 | "Connecte" un compte (crée l'état si absent) |
| GET     | `/wallet/state/:accountId`    | —                                                 | État complet (collatéral, prêt, pool, txs)|
| POST    | `/collateral/deposit`         | `{ accountId, liters, grade }`                   | Mint HTS + dépôt on-chain dans le contrat |
| POST    | `/loan/request`                | `{ accountId, amount }`                          | Emprunt (vérifie LTV 70% on-chain)        |
| POST    | `/loan/repay`                  | `{ accountId }`                                  | Rembourse la dette courante + libère le collatéral |
| POST    | `/pool/supply`                 | `{ accountId, amount }`                          | Dépôt investisseur dans le pool           |
| POST    | `/pool/withdraw`               | `{ accountId }`                                  | Retire capital + intérêts courus          |
| GET     | `/pool/history`                | —                                                 | TVL courant + série pour le graphique     |
| GET     | `/transactions/:accountId`     | —                                                 | Historique des transactions               |

`grade` ∈ `extra-vierge` | `vierge` | `lampante`.

Chaque réponse renvoie l'état complet (même shape que `useOliveChain()` côté
frontend : `lots`, `loan`, `supplied`, `earned`, `txs`, `collateralValue`,
`maxBorrow`, `debt`, `healthRatio`, `poolTvl`, `poolHistory`), donc tu peux
directement remplacer les fonctions de `src/lib/olivechain.tsx` par des
appels `fetch()` vers ces routes.

### Exemple

```bash
curl -X POST http://localhost:4000/api/wallet/connect \
  -H "Content-Type: application/json" -d '{}'

curl -X POST http://localhost:4000/api/collateral/deposit \
  -H "Content-Type: application/json" \
  -d '{"accountId":"0.0.482017","liters":1000,"grade":"extra-vierge"}'

curl -X POST http://localhost:4000/api/loan/request \
  -H "Content-Type: application/json" \
  -d '{"accountId":"0.0.482017","amount":2000}'
```

## 6. Architecture

```
backend/
├── contracts/OliveChainPool.sol   # smart contract Solidity (LTV, intérêts, pool)
├── scripts/
│   ├── compile.js                 # compile le contrat avec solc
│   ├── deployContract.js          # déploie via ContractCreateFlow
│   └── setupTokens.js             # crée les tokens HTS OLV + OUSD
├── src/
│   ├── config/                    # env + client Hedera singleton
│   ├── services/
│   │   ├── tokenService.js        # mint/burn/transfer HTS
│   │   ├── contractService.js     # execute/call sur le smart contract
│   │   └── stateService.js        # orchestration métier (routes -> services)
│   ├── routes/                    # wallet, collateral, loan, pool, transactions
│   ├── middleware/                # asyncHandler, errorHandler
│   ├── db.js                      # persistence JSON locale (data/store.json)
│   ├── app.js
│   └── server.js
└── data/store.json                # généré automatiquement au 1er lancement
```

## 7. Modèle "custodial" — à savoir pour le pitch

Pour rester simple pour un MVP hackathon (pas de wallet HashPack réel côté
frontend), **le backend possède un seul compte Hedera (`operator`)** qui fait
toutes les opérations HTS + appelle le smart contract en son nom. Le
`accountId` que tu passes dans les requêtes est un **identifiant logique**
utilisé comme clé dans le contrat (`mapping(bytes32 => Position)`) et dans la
DB locale — il ne signe rien lui-même.

C'est un choix assumé et documenté : ça permet une démo 100% fonctionnelle
sur testnet sans gérer de clés privées côté navigateur. Pour passer en
non-custodial (production) :

1. Intègre le SDK **HashConnect / WalletConnect** côté frontend pour que
   chaque utilisateur signe avec son propre wallet HashPack.
2. Utilise `transferStablecoinTo(accountId, amount)` (déjà présent dans
   `tokenService.js`) au lieu du self-transfer symbolique.
3. Fais associer (`TokenAssociateTransaction`) les tokens OLV/OUSD par
   chaque compte utilisateur avant tout transfert.
4. Remplace les appels `onlyOperator` du contrat par une vérification
   `msg.sender` si tu veux que les utilisateurs appellent le contrat
   directement (nécessite alors du gas HBAR sur chaque compte utilisateur).

## 8. Notes

- Le smart contract est la **source de vérité** pour la dette et les intérêts
  (calculés on-chain via `block.timestamp`), pas la DB JSON locale.
- `data/store.json` sert uniquement à l'affichage (libellés, historique
  lisible) — supprime-le à tout moment pour repartir de zéro (l'état
  on-chain, lui, reste dans le contrat).
- Chaque action génère une vraie transaction Hedera testnet (`transactionId`)
  utilisée comme `hash` affiché dans l'historique côté frontend — vérifiable
  sur [HashScan](https://hashscan.io/testnet).
