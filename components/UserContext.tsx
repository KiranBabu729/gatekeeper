"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Role = "author" | "legal_reviewer";
export interface CurrentUser {
  name: string;
  role: Role;
}

const USERS: CurrentUser[] = [
  { name: "Priya (Author)", role: "author" },
  { name: "Morgan (Legal Reviewer)", role: "legal_reviewer" },
];

const UserContext = createContext<{
  user: CurrentUser;
  setUser: (u: CurrentUser) => void;
  users: CurrentUser[];
}>({ user: USERS[0], setUser: () => {}, users: USERS });

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser>(USERS[0]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("gatekeeper-user");
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  const update = (u: CurrentUser) => {
    setUser(u);
    try {
      localStorage.setItem("gatekeeper-user", JSON.stringify(u));
    } catch {}
  };

  return <UserContext.Provider value={{ user, setUser: update, users: USERS }}>{children}</UserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(UserContext);
}
