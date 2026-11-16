import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import "./designs.css";
import { Providers } from "@/components/shell/providers";
import { DemoSwitcher } from "@/components/shell/demo-switcher";
import { DESIGN_BOOT_SCRIPT } from "@/lib/design-meta";

const sans = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });
const space = Space_Grotesk({ variable: "--font-space", subsets: ["latin"], display: "swap" });
const jet = JetBrains_Mono({ variable: "--font-jet", subsets: ["latin"], display: "swap" });
const serif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
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
    { media: "(prefers-color-scheme: light)", color: "#f3f1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-design="meridian"
      className={`${sans.variable} ${mono.variable} ${serif.variable} ${space.variable} ${jet.variable} antialiased`}
    >
      <head>
        {/* Apply the saved design before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: DESIGN_BOOT_SCRIPT }} />
      </head>
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
