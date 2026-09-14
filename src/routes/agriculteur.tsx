import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CalendarClock,
  Coins,
  Droplets,
  ImagePlus,
  Loader2,
  Lock,
  RefreshCcw,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { ConnectGate } from "@/components/ConnectGate";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  BORROW_APR,
  LTV,
  PRICE_PER_LITER,
  accruedInterest,
  formatDate,
  formatNumber,
  formatUsdc,
  useOliveChain,
  type Grade,
} from "@/lib/olivechain";

export const Route = createFileRoute("/agriculteur")({
  head: () => ({
    meta: [
      { title: "Espace agriculteur — OliveChain" },
      {
        name: "description",
        content:
          "Déposez votre stock d'huile d'olive en garantie, obtenez un prêt jusqu'à 70 % de sa valeur et suivez votre remboursement.",
      },
      { property: "og:title", content: "Espace agriculteur — OliveChain" },
      {
        property: "og:description",
        content: "Dépôt de collatéral, prêt en stablecoin et remboursement en un seul écran.",
      },
    ],
  }),
  component: FarmerPage,
});

const txIcon = {
  deposit: Droplets,
  borrow: Coins,
  repay: RefreshCcw,
  supply: ArrowDownToLine,
  withdraw: ArrowUpRight,
} as const;

function FarmerPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold sm:text-4xl">Espace agriculteur</h1>
      <p className="mt-2 text-muted-foreground">
        Votre stock, votre prêt et vos échéances, en un coup d'œil.
      </p>
      <ConnectGate title="votre espace agriculteur">
        <FarmerDashboard />
      </ConnectGate>
    </div>
  );
}

function FarmerDashboard() {
  const {
    accountId,
    lots,
    loan,
    txs,
    collateralValue,
    totalLiters,
    maxBorrow,
    debt,
    healthRatio,
    depositCollateral,
    requestLoan,
    repayLoan,
  } = useOliveChain();

  const [liters, setLiters] = useState("1000");
  const [grade, setGrade] = useState<Grade>("extra-vierge");
  const [photo, setPhoto] = useState<string | null>(null);
  const [depositing, setDepositing] = useState(false);

  const [amount, setAmount] = useState(0);
  const [borrowing, setBorrowing] = useState(false);
  const [repaying, setRepaying] = useState(false);

  const litersNumber = Number(liters) || 0;
  const estimatedValue = litersNumber * PRICE_PER_LITER;
  const interest = useMemo(() => (loan ? accruedInterest(loan) : 0), [loan]);

  const handleDeposit = async () => {
    if (litersNumber <= 0) {
      toast.error("Indiquez une quantité en litres.");
      return;
    }
    setDepositing(true);
    await depositCollateral(litersNumber, grade);
    setDepositing(false);
    setLiters("1000");
    setPhoto(null);
    toast.success(`${formatNumber(litersNumber)} L déposés et tokenisés.`);
  };

  const handleBorrow = async () => {
    if (amount <= 0) {
      toast.error("Choisissez un montant à emprunter.");
      return;
    }
    setBorrowing(true);
    await requestLoan(amount);
    setBorrowing(false);
    setAmount(0);
    toast.success("Prêt accordé, fonds envoyés sur votre wallet.");
  };

  const handleRepay = async () => {
    setRepaying(true);
    await repayLoan();
    setRepaying(false);
    toast.success("Prêt remboursé, votre collatéral est libéré.");
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Droplets}
          label="Stock déposé"
          value={`${formatNumber(totalLiters)} L`}
          hint={`${lots.length} lot(s) tokenisé(s)`}
        />
        <StatCard
          icon={Lock}
          label="Valeur estimée"
          value={`${formatUsdc(collateralValue, 0)} USDC`}
          hint={`${PRICE_PER_LITER} USDC / litre`}
        />
        <StatCard
          icon={Coins}
          label="Montant dû"
          value={`${formatUsdc(debt, 2)} USDC`}
          hint={loan ? `Intérêts courus : ${formatUsdc(interest, 2)} USDC` : "Aucun prêt en cours"}
        />
        <StatCard
          icon={Wallet}
          label="Compte Hedera"
          value={accountId ?? "—"}
          hint="Testnet · wallet connecté"
        />
      </div>

      <div className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Ratio collatéral / prêt</h2>
          <span className="text-sm text-muted-foreground">
            {Math.round(healthRatio * 100)} % utilisé · limite {Math.round(LTV * 100)} %
          </span>
        </div>
        <Progress value={Math.min(100, (healthRatio / LTV) * 100)} className="mt-4" />
        <p className="mt-3 text-sm text-muted-foreground">
          Capacité d'emprunt restante : {formatUsdc(maxBorrow, 0)} USDC
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-6">
          <h2 className="text-lg font-semibold">Déposer un stock</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Votre huile reste chez vous ou chez votre partenaire de stockage.
          </p>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="liters">Quantité (litres)</Label>
              <Input
                id="liters"
                inputMode="numeric"
                value={liters}
                onChange={(e) => setLiters(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>

            <div className="space-y-2">
              <Label>Qualité</Label>
              <Select value={grade} onValueChange={(v) => setGrade(v as Grade)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="extra-vierge">Extra vierge</SelectItem>
                  <SelectItem value="vierge">Vierge</SelectItem>
                  <SelectItem value="lampante">Lampante</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo">Photo du lot (optionnel)</Label>
              <label
                htmlFor="photo"
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground hover:bg-secondary"
              >
                <ImagePlus className="size-4" />
                {photo ?? "Ajouter une photo des cuves ou du certificat"}
              </label>
              <input
                id="photo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? null)}
              />
            </div>

            <div className="rounded-xl bg-primary-soft p-4 text-sm text-primary">
              Valeur estimée : <strong>{formatUsdc(estimatedValue, 0)} USDC</strong>
            </div>

            <Button className="w-full rounded-full" onClick={handleDeposit} disabled={depositing}>
              {depositing ? <Loader2 className="size-4 animate-spin" /> : null}
              Déposer et tokeniser
            </Button>
          </div>
        </div>

        <div className="surface-card p-6">
          <h2 className="text-lg font-semibold">Demander un prêt</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Jusqu'à {Math.round(LTV * 100)} % de la valeur de votre stock, taux {(
              BORROW_APR * 100
            ).toFixed(1)}{" "}
            % par an.
          </p>

          <div className="mt-5 space-y-5">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Montant souhaité</span>
                <span className="text-2xl font-semibold">{formatUsdc(amount, 0)} USDC</span>
              </div>
              <Slider
                className="mt-4"
                value={[amount]}
                max={Math.max(1, Math.floor(maxBorrow))}
                step={50}
                onValueChange={(v) => setAmount(v[0] ?? 0)}
              />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>0</span>
                <span>Max {formatUsdc(maxBorrow, 0)} USDC</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Ou saisir un montant</Label>
              <Input
                id="amount"
                inputMode="numeric"
                value={amount ? String(amount) : ""}
                placeholder="0"
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                  setAmount(Math.min(v, Math.floor(maxBorrow)));
                }}
              />
            </div>

            <Button
              className="w-full rounded-full"
              onClick={handleBorrow}
              disabled={borrowing || maxBorrow <= 0}
            >
              {borrowing ? <Loader2 className="size-4 animate-spin" /> : null}
              Recevoir les fonds
            </Button>
          </div>
        </div>
      </div>

      <div className="surface-card p-6">
        <h2 className="text-lg font-semibold">Mon prêt actif</h2>
        {loan ? (
          <div className="mt-4 space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Capital emprunté" value={`${formatUsdc(loan.principalUsdc, 0)} USDC`} />
              <Field label="Intérêts dus" value={`${formatUsdc(interest, 2)} USDC`} />
              <Field
                label="Échéance"
                value={formatDate(loan.dueAt)}
                icon={<CalendarClock className="size-4 text-accent" />}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary p-4">
              <div>
                <p className="text-sm text-muted-foreground">Total à rembourser</p>
                <p className="text-xl font-semibold">{formatUsdc(debt, 2)} USDC</p>
              </div>
              <Button className="rounded-full" onClick={handleRepay} disabled={repaying}>
                {repaying ? <Loader2 className="size-4 animate-spin" /> : null}
                Rembourser et libérer le collatéral
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Contrat Hedera : {loan.contractId}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Aucun prêt en cours. Votre collatéral est entièrement disponible.
          </p>
        )}
      </div>

      <div className="surface-card p-6">
        <h2 className="text-lg font-semibold">Historique des transactions</h2>
        <ul className="mt-4 space-y-4">
          {txs.map((tx) => {
            const Icon = txIcon[tx.type];
            return (
              <li key={tx.id} className="flex gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{tx.label}</p>
                    <p className="text-sm text-muted-foreground">{tx.amount}</p>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(tx.at)} · {tx.hash}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
