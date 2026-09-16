import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Coins,
  Droplets,
  LineChart,
  Lock,
  ShieldCheck,
  Sprout,
  Wallet,
} from "lucide-react";
import heroImage from "@/assets/olive-hero.jpg";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { formatNumber, useOliveChain } from "@/lib/olivechain";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OliveChain — Transformez votre récolte en liquidité" },
      {
        name: "description",
        content:
          "Déposez votre stock d'huile d'olive en garantie tokenisée et recevez un prêt en stablecoin. Les investisseurs financent le pool et gagnent des intérêts.",
      },
      { property: "og:title", content: "OliveChain — Transformez votre récolte en liquidité" },
      {
        property: "og:description",
        content: "Un prêt garanti par votre production, géré en toute transparence sur Hedera.",
      },
    ],
  }),
  component: Landing,
});

const steps = [
  {
    icon: Sprout,
    title: "Vous déposez votre stock",
    text: "Litres et qualité sont vérifiés, puis représentés par un jeton adossé à votre huile.",
  },
  {
    icon: Lock,
    title: "Le collatéral est bloqué",
    text: "Votre stock reste le vôtre : il est simplement immobilisé le temps du prêt.",
  },
  {
    icon: Coins,
    title: "Vous recevez vos fonds",
    text: "Jusqu'à 70 % de la valeur estimée, versés en stablecoin en quelques minutes.",
  },
  {
    icon: ShieldCheck,
    title: "Vous remboursez, c'est libéré",
    text: "Remboursement à tout moment avant l'échéance, collatéral immédiatement débloqué.",
  },
];

function Landing() {
  const { poolTvl } = useOliveChain();

  return (
    <div>
      <section className="relative overflow-hidden">
        <img
          src={heroImage}
          alt="Oliveraie méditerranéenne au coucher du soleil"
          width={1600}
          height={1008}
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(100deg,oklch(0.24_0.033_140/0.92)_0%,oklch(0.24_0.033_140/0.72)_55%,oklch(0.24_0.033_140/0.35)_100%)]" />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/25 px-3 py-1 text-xs font-medium text-primary-foreground">
            <Droplets className="size-3.5" /> Actif réel tokenisé sur Hedera
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl leading-[1.08] font-semibold text-primary-foreground sm:text-6xl">
            Transformez votre récolte en liquidité, sans attendre la vente.
          </h1>
          <p className="mt-5 max-w-xl text-base text-primary-foreground/80 sm:text-lg">
            Un prêt garanti par votre production d'huile d'olive, financé par une communauté
            d'investisseurs et géré en toute transparence.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/agriculteur">
                Je suis agriculteur <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="rounded-full border border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
            >
              <Link to="/investisseur">Je suis investisseur</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={Droplets}
            label="Collatéral déposé"
            value="182 400 L"
            hint="≈ 1 550 400 USDC de valeur estimée"
          />
          <StatCard
            icon={Coins}
            label="Prêts actifs"
            value="964 200 USDC"
            hint="127 agriculteurs financés"
          />
          <StatCard
            icon={LineChart}
            label="Valeur totale bloquée"
            value={`${formatNumber(poolTvl)} USDC`}
            hint="Pool de liquidité investisseurs"
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <h2 className="text-2xl font-semibold sm:text-3xl">Le problème, simplement</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold">Une trésorerie bloquée dans les cuves</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Après la récolte, l'huile attend parfois des mois avant d'être vendue. Pendant ce
              temps, il faut payer la main-d'œuvre, le matériel et la prochaine saison.
            </p>
          </div>
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold">Un crédit lent et hors de portée</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Les prêts classiques demandent des garanties que peu de petits producteurs peuvent
              fournir. OliveChain utilise la récolte elle-même comme garantie.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <h2 className="text-2xl font-semibold sm:text-3xl">Comment ça marche</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div key={step.title} className="surface-card p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <step.icon className="size-5" />
                </span>
                <span className="text-sm font-medium text-muted-foreground">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/comment-ca-marche">Voir le parcours complet</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-20">
        <div className="gradient-olive flex flex-col items-start justify-between gap-6 rounded-3xl p-8 text-primary-foreground sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold">Prêt à essayer la démo ?</h2>
            <p className="mt-2 max-w-lg text-sm text-primary-foreground/80">
              Connectez un wallet de test pour parcourir les deux profils : dépôt de collatéral,
              prêt, remboursement et rendement investisseur.
            </p>
          </div>
          <Button asChild size="lg" variant="secondary" className="rounded-full">
            <Link to="/agriculteur">
              <Wallet className="size-4" /> Démarrer la démo
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
