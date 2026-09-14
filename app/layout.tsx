import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, Tinos } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const tinos = Tinos({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-tinos",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Redline: see what you're signing",
  description:
    "Before you sign a client agreement, see which sentences could cost you. Every flag quotes the sentence it came from, word for word.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${tinos.variable}`}>
      <body>{children}</body>
    </html>
  );
}
