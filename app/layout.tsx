import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "@/components/UserContext";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Gatekeeper",
  description: "A compliance layer for outbound product communications.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-w-[1280px]">
        <UserProvider>
          <Header />
          <main className="mx-auto max-w-[1280px] px-6 py-8">{children}</main>
        </UserProvider>
      </body>
    </html>
  );
}
