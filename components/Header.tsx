"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/components/UserContext";

const NAV = [
  { href: "/", label: "Tickets" },
  { href: "/policy", label: "Policy" },
  { href: "/audit", label: "Audit" },
  { href: "/evals", label: "Evals" },
];

export function Header() {
  const pathname = usePathname();
  const { user, setUser, users } = useCurrentUser();

  return (
    <header className="border-b border-gk-border bg-gk-surface">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-sm font-semibold tracking-tight text-gk-text">
            Gatekeeper
          </Link>
          <nav className="flex gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded px-3 py-1.5 text-sm ${
                    active ? "bg-gk-surface-raised text-gk-text" : "text-gk-text-secondary hover:text-gk-text"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <select
          value={user.name}
          onChange={(e) => {
            const next = users.find((u) => u.name === e.target.value);
            if (next) setUser(next);
          }}
          className="rounded border border-gk-border bg-gk-surface-raised px-2 py-1.5 text-sm text-gk-text"
        >
          {users.map((u) => (
            <option key={u.name} value={u.name}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
