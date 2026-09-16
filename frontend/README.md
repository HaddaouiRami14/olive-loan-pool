# Olive Yields

PRD — OliveChain (Frontend)

Product Requirement Document pour génération via Lovable

1. Contexte du projet

Nom du projet : OliveChain Type : Application web DeFi (Decentralized Finance) + RWA (Real-World Asset Tokenization) Blockchain : Hedera Hashgraph (Testnet) Thème du hackathon : Hedera Cross Campus Challenge 2026 — combinaison DeFi + RWA

Résumé en une phrase : OliveChain permet à un agriculteur de déposer un stock d'huile d'olive tokenisé comme garantie, et d'obtenir instantanément un prêt en stablecoin, tandis que des investisseurs déposent des fonds dans un pool de liquidité pour gagner des intérêts.

2. Objectif du frontend

Construire une interface web claire, moderne et fonctionnelle qui permet de démontrer le parcours complet du produit lors d'un pitch de hackathon : dépôt de collatéral → demande de prêt → remboursement → côté investisseur (dépôt/retrait dans le pool).

Le frontend doit être connecté à un wallet Hedera (simulation acceptable pour le MVP) et présenter les données de façon crédible, même si le backend/smart contract est encore simplifié.

3. Utilisateurs cibles (2 profils)

Profil 1 — L'Agriculteur (Emprunteur)

Dépose son stock d'huile d'olive (tokenisé) comme garantie

Demande et reçoit un prêt en stablecoin

Suit l'état de son prêt (montant dû, échéance, collatéral bloqué)

Rembourse et récupère son collatéral

Profil 2 — L'Investisseur (Prêteur)

Dépose des fonds (stablecoin) dans le pool de liquidité

Suit le rendement généré (intérêts accumulés)

Retire ses fonds + intérêts à tout moment

4. Pages / Écrans requis

4.1 Landing Page

Présentation du projet : mission, problème résolu, comment ça marche (3-4 étapes visuelles)

Boutons d'accès : "Je suis agriculteur" / "Je suis investisseur"

Section stats globales (mock data acceptable) : total collatéral déposé, total prêts actifs, TVL (Total Value Locked)

4.2 Connexion Wallet

Bouton "Connect Wallet" (style HashPack / Hedera)

Affichage de l'Account ID Hedera une fois connecté

État "non connecté" clairement visible avant connexion

4.3 Dashboard Agriculteur

Vue d'ensemble : quantité de stock déposée, valeur estimée, statut du prêt en cours

Formulaire "Déposer un stock" : quantité (litres), qualité/grade, upload photo (optionnel)

Formulaire "Demander un prêt" : affiche le montant max disponible (LTV 70%), slider ou input du montant souhaité

Section "Mon prêt actif" : montant emprunté, intérêts dus, date d'échéance, bouton "Rembourser"

Historique des transactions (dépôts, prêts, remboursements)

4.4 Dashboard Investisseur

Solde disponible dans le pool

Formulaire "Déposer des fonds" (montant + bouton confirmer)

Affichage du rendement (APY estimé, intérêts accumulés en temps réel ou simulé)

Bouton "Retirer mes fonds"

Graphique simple d'évolution du pool (mock data acceptable)

4.5 Page "Comment ça marche" (optionnel mais recommandé pour le pitch)

Schéma explicatif du flux complet : Agriculteur dépose → Token émis → Prêt accordé → Investisseur gagne intérêt → Remboursement → Collatéral libéré

5. Fonctionnalités clés (résumé)

Fonctionnalité Priorité Notes Connexion Wallet (mock ou réelle) Haute Simuler avec un Account ID fictif si besoin Dépôt de collatéral (formulaire) Haute Peut être mock au début, pas besoin d'appel blockchain réel pour la démo visuelle Demande de prêt avec calcul LTV Haute Calcul automatique : montant max = 70% de la valeur du stock Suivi du prêt actif Haute Montant dû, intérêts, échéance Remboursement Haute Bouton simple, met à jour l'état Dépôt/retrait investisseur Moyenne Pool de liquidité simplifié Historique des transactions Moyenne Liste simple, style timeline Graphiques (TVL, rendement) Basse Nice-to-have pour la démo

6. Design & Direction visuelle

Ambiance générale : Fintech moderne, sobre, digne de confiance — pas "crypto flashy". Penser à un mélange entre une app bancaire moderne et une touche évoquant l'agriculture/l'huile d'olive.

Palette de couleurs suggérée :

Vert olive profond (couleur principale, évoque le produit)

Doré/ambre (accent, évoque l'huile et la valeur)

Blanc cassé / gris clair (fond)

Vert foncé ou noir (texte)

Typographie : Sans-serif moderne, lisible, professionnelle (ex: Inter, Poppins)

Style des composants :

Cards arrondies avec ombre légère pour chaque section (dépôt, prêt, etc.)

Icônes simples et claires (gouttes d'huile, cadenas pour collatéral, graphique pour rendement)

Barres de progression pour montrer le ratio collatéral/prêt

Design responsive (mobile-first idéalement, car démo possible sur téléphone)

7. Contraintes techniques

Frontend en React

Pas besoin d'intégration blockchain réelle obligatoire pour le MVP visuel — données mockées acceptables, mais structurées comme si elles venaient d'un smart contract Hedera (ex: accountId, tokenId, collateralAmount, loanAmount, interestRate)

Prévoir des points d'intégration clairs (fonctions/API calls) pour brancher facilement le vrai SDK Hedera plus tard

Pas de <form> HTML natif si le projet est en React (gestion via state + onClick/onChange)

8. Ton du contenu texte (copywriting)

Simple, rassurant, orienté "impact réel" plutôt que jargon crypto

Exemple de ton pour la landing page : "Transformez votre récolte en liquidité, sans attendre la vente." "Un prêt garanti par votre production, géré en toute transparence sur Hedera."

9. Livrables attendus de Lovable

Landing page complète

Flow de connexion wallet (mock acceptable)

Dashboard Agriculteur fonctionnel (avec données mockées dynamiques)

Dashboard Investisseur fonctionnel (avec données mockées dynamiques)

Design cohérent et responsive sur l'ensemble des écrans

Structure de code claire permettant de brancher facilement des appels API/Hedera SDK par la suite

10. Hors scope (pour ce PRD frontend)

Smart contracts (traités séparément)

Intégration backend réelle avec Hedera SDK

Système d'authentification complexe (KYC, etc.)

Paiements réels / mainnet

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8c4142ae-9034-4eb1-be06-ebd8976a4e2c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
