import { Link } from "@tanstack/react-router";
import { Droplets } from "lucide-react";
import { WalletButton } from "./WalletButton";

const nav = [
  { to: "/agriculteur", label: "Agriculteur" },
  { to: "/investisseur", label: "Investisseur" },
  { to: "/comment-ca-marche", label: "Comment ça marche" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="gradient-olive flex size-9 items-center justify-center rounded-xl text-primary-foreground">
            <Droplets className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">OliveChain</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary text-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <WalletButton />
      </div>
    </header>
  );
}
