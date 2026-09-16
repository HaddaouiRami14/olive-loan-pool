import { Loader2, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOliveChain } from "@/lib/olivechain";

export function WalletButton() {
  const { connected, accountId, connecting, connectWallet, disconnectWallet } = useOliveChain();

  if (connected) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-2 rounded-full border border-border bg-primary-soft px-3 py-1.5 text-xs font-medium text-primary sm:inline-flex">
          <span className="size-2 rounded-full bg-success" />
          Hedera Testnet · {accountId}
        </span>
        <Button variant="ghost" size="icon" aria-label="Déconnecter" onClick={disconnectWallet}>
          <LogOut className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={() => void connectWallet()} disabled={connecting} className="rounded-full">
      {connecting ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
      {connecting ? "Connexion…" : "Connecter le wallet"}
    </Button>
  );
}
