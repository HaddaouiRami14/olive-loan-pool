import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, Droplets, HandCoins, Lock, RefreshCcw, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/comment-ca-marche")({
  head: () => ({
    meta: [
      { title: "Comment ça marche — OliveChain" },
      {
        name: "description",
        content:
          "Le parcours complet OliveChain : dépôt du stock, émission du jeton, prêt en stablecoin, intérêts pour les investisseurs, remboursement et libération du collatéral.",
      },
      { property: "og:title", content: "Comment ça marche — OliveChain" },
      {
        property: "og:description",
        content: "Du stock d'huile au prêt en stablecoin : chaque étape expliquée simplement.",
      },
    ],
  }),
  component: HowItWorks,
});

const flow = [
  {
    icon: Droplets,
    title: "L'agriculteur dépose son stock",
    text: "Quantité en litres et qualité déclarées, puis validées par le partenaire de stockage.",
  },
  {
    icon: Lock,
    title: "Un jeton de collatéral est émis",
    text: "Le stock devient un actif numérique adossé à l'huile réelle, immobilisé pendant le prêt.",
  },
  {
    icon: Coins,
    title: "Le prêt est accordé",
    text: "Jusqu'à 70 % de la valeur du stock, versé en stablecoin depuis le pool de liquidité.",
  },
  {
    icon: HandCoins,
    title: "Les investisseurs gagnent des intérêts",
    text: "Les intérêts payés par les emprunteurs rémunèrent ceux qui alimentent le pool.",
  },
  {
    icon: RefreshCcw,
    title: "L'agriculteur rembourse",
    text: "Capital et intérêts, à tout moment avant l'échéance de 180 jours.",
  },
  {
    icon: Unlock,
    title: "Le collatéral est libéré",
    text: "Le jeton est brûlé, le stock redevient librement vendable par le producteur.",
  },
];

function HowItWorks() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-14">
      <h1 className="text-3xl font-semibold sm:text-4xl">Le parcours, étape par étape</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Un circuit simple qui relie un producteur qui a besoin de trésorerie et des investisseurs
        qui cherchent un rendement adossé à un actif réel.
      </p>

      <ol className="mt-10 space-y-4">
        {flow.map((step, i) => (
          <li key={step.title} className="surface-card flex gap-4 p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-foreground">
              <step.icon className="size-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Étape {i + 1}</p>
              <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Button asChild className="rounded-full">
          <Link to="/agriculteur">Essayer côté agriculteur</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/investisseur">Essayer côté investisseur</Link>
        </Button>
      </div>
    </div>
  );
}
