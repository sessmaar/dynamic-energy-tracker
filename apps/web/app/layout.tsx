import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./tokens.css";
import { TabBar } from "@/components/TabBar";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Dense Matrix · Metabolic Intelligence",
  description: "Precise metabolic tracking using Bayesian Convergence.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dense Matrix",
  },
  // apple-touch-icon.svg is the file in /public; iOS also accepts SVG
  icons: {
    apple: "/apple-touch-icon.svg",
    icon: "/apple-touch-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#01696f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>{children}<TabBar /></body>
    </html>
  );
}
