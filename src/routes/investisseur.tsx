import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Coins, Loader2, PiggyBank, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ConnectGate } from "@/components/ConnectGate";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { POOL_APY, formatNumber, formatUsdc, useOliveChain } from "@/lib/olivechain";

export const Route = createFileRoute("/investisseur")({
  head: () => ({
    meta: [
      { title: "Espace investisseur — OliveChain" },
      {
        name: "description",
        content:
          "Déposez des stablecoins dans le pool OliveChain, suivez vos intérêts en temps réel et retirez vos fonds à tout moment.",
      },
      { property: "og:title", content: "Espace investisseur — OliveChain" },
      {
        property: "og:description",
        content: "Un rendement adossé à des stocks d'huile d'olive réels.",
      },
    ],
  }),
  component: InvestorPage,
});

function InvestorPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold sm:text-4xl">Espace investisseur</h1>
      <p className="mt-2 text-muted-foreground">
        Financez des producteurs réels et suivez votre rendement jour après jour.
      </p>
      <ConnectGate title="votre espace investisseur">
        <InvestorDashboard />
      </ConnectGate>
    </div>
  );
}

function InvestorDashboard() {
  const {
    accountId,
    supplied,
    earned,
    poolTvl,
    poolHistory,
    supplyToPool,
    withdrawFromPool,
  } = useOliveChain();
  const [amount, setAmount] = useState("500");
  const [pending, setPending] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const value = Number(amount) || 0;

  const handleSupply = async () => {
    if (value <= 0) {
      toast.error("Indiquez un montant à déposer.");
      return;
    }
    setPending(true);
    await supplyToPool(value);
    setPending(false);
    setAmount("500");
    toast.success(`${formatUsdc(value, 0)} USDC déposés dans le pool.`);
  };

  const handleWithdraw = async () => {
    if (supplied <= 0) {
      toast.error("Vous n'avez aucun fonds dans le pool.");
      return;
    }
    setWithdrawing(true);
    await withdrawFromPool();
    setWithdrawing(false);
    toast.success("Fonds et intérêts retirés.");
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={PiggyBank}
          label="Mon dépôt"
          value={`${formatUsdc(supplied, 2)} USDC`}
          hint="Capital fourni au pool"
        />
        <StatCard
          icon={Sparkles}
          label="Intérêts accumulés"
          value={`${formatUsdc(earned, 4)} USDC`}
          hint="Mise à jour en continu"
        />
        <StatCard
          icon={TrendingUp}
          label="Rendement estimé"
          value={`${(POOL_APY * 100).toFixed(1)} % APY`}
          hint="Basé sur les prêts en cours"
        />
        <StatCard
          icon={Wallet}
          label="Compte Hedera"
          value={accountId ?? "—"}
          hint="Testnet · wallet connecté"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="surface-card p-6">
          <h2 className="text-lg font-semibold">Déposer des fonds</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Votre dépôt finance des prêts garantis par des stocks d'huile réels.
          </p>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supply">Montant (USDC)</Label>
              <Input
                id="supply"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <div className="flex gap-2">
              {[250, 500, 1000, 5000].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setAmount(String(preset))}
                >
                  {formatNumber(preset)}
                </Button>
              ))}
            </div>
            <div className="rounded-xl bg-accent-soft p-4 text-sm text-accent-foreground">
              Gain estimé sur 12 mois :{" "}
              <strong>{formatUsdc(value * POOL_APY, 2)} USDC</strong>
            </div>
            <Button className="w-full rounded-full" onClick={handleSupply} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirmer le dépôt
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-full"
              onClick={handleWithdraw}
              disabled={withdrawing}
            >
              {withdrawing ? <Loader2 className="size-4 animate-spin" /> : null}
              Retirer mes fonds + intérêts
            </Button>
          </div>
        </div>

        <div className="surface-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Évolution du pool</h2>
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Coins className="size-4 text-accent" /> TVL {formatNumber(poolTvl)} USDC
            </span>
          </div>
          <PoolChart points={poolHistory} />
          <p className="mt-3 text-xs text-muted-foreground">
            Données de démonstration · 7 derniers mois
          </p>
        </div>
      </div>
    </div>
  );
}

function PoolChart({ points }: { points: { label: string; tvl: number }[] }) {
  const max = Math.max(...points.map((p) => p.tvl));
  const min = Math.min(...points.map((p) => p.tvl));
  const span = Math.max(1, max - min);
  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * 100,
    y: 100 - ((p.tvl - min) / span) * 82 - 9,
  }));
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div className="mt-5">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-48 w-full">
        <polygon
          points={`0,100 ${line} 100,100`}
          fill="var(--color-primary)"
          opacity="0.12"
        />
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="1.2" fill="var(--color-accent)" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        {points.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}
