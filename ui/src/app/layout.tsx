import type { Metadata } from "next";
import { Orbitron, Exo_2, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const exo = Exo_2({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const techMono = Share_Tech_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "GeoIntel Command Interface",
  description:
    "Cyberpunk satellite reconnaissance UI blending Three.js, Anime.js, and neon HUD overlays.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${orbitron.variable} ${exo.variable} ${techMono.variable} bg-black text-white antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
