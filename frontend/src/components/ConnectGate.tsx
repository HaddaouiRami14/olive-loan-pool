import { Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useOliveChain } from "@/lib/olivechain";

export function ConnectGate({ title, children }: { title: string; children: ReactNode }) {
  const { connected, connecting, connectWallet } = useOliveChain();

  if (connected) return <>{children}</>;

  return (
    <div className="surface-card mx-auto mt-12 max-w-md p-8 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-foreground">
        <Wallet className="size-6" />
      </span>
      <h2 className="mt-4 text-xl font-semibold">Wallet non connecté</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Connectez votre wallet Hedera pour accéder à {title}. Aucune donnée réelle n'est engagée
        dans cette démo.
      </p>
      <Button
        className="mt-6 w-full rounded-full"
        onClick={() => void connectWallet()}
        disabled={connecting}
      >
        {connecting ? "Connexion…" : "Connecter le wallet"}
      </Button>
    </div>
  );
}
