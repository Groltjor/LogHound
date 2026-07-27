import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Log Hound | Demo interactiva",
  description: "Showcase autónomo con datos simulados de tráfico automatizado.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
