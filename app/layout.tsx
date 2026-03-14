import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rétroplanning Gantt",
  description: "Import Excel → Gantt interactif (aucune donnée sauvegardée)",
};

export default async function RootLayout({
  children,
  ...rest
}: Readonly<{
  children: React.ReactNode;
  params?: Promise<Record<string, string | string[]>>;
}>) {
  // Next.js 16: params est une Promise — la résoudre pour éviter l’énumération par les DevTools
  if ("params" in rest && rest.params) await rest.params;
  return (
    <html lang="fr">
      <body
        className={`${plusJakarta.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
