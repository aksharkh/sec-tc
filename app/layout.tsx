import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shell/providers";
import { DemoSwitcher } from "@/components/shell/demo-switcher";

const sans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const serif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SecureKnots Trust",
    template: "%s | SecureKnots Trust",
  },
  description: "Managed trust centers for certified cloud providers: documents, reviewer access, machine-readable package data and access logs.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#080c17" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${serif.variable} ${mono.variable} antialiased`}>
      {/* Browser extensions (password managers, grammar checkers) add attributes to body before React loads. */}
      <body suppressHydrationWarning>
        <Providers>
          {children}
          <DemoSwitcher />
        </Providers>
      </body>
    </html>
  );
}
