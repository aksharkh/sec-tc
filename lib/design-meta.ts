/* Design list (shared with SecureKnots Workspace) and the boot script. No React here,
   so the server layout can import it. */

export type DesignId = "meridian" | "mono" | "boardroom" | "aurora" | "brutal" | "spatial" | "nocturne";
export type ChartKind = "editorial" | "dots" | "classic" | "rings" | "blocks" | "iso" | "neon";

export type Design = {
  id: DesignId;
  name: string;
  tagline: string;
  audience: string;
  scheme: "both" | "light" | "dark";
  chart: ChartKind;
};

export const DESIGNS: Design[] = [
  { id: "meridian", name: "Meridian", tagline: "Matches secureknots.com: ivory paper, ink and cobalt, serif titles", audience: "Brand", scheme: "both", chart: "editorial" },
  { id: "mono", name: "Mono", tagline: "Black, white and gray. Quiet and precise", audience: "Minimal", scheme: "both", chart: "dots" },
  { id: "boardroom", name: "Boardroom", tagline: "Larger type, high contrast, classic charts", audience: "Every generation", scheme: "light", chart: "classic" },
  { id: "aurora", name: "Aurora", tagline: "Soft gradients, frosted glass, rounded everything", audience: "Gen Z", scheme: "light", chart: "rings" },
  { id: "brutal", name: "Brutal", tagline: "Bold outlines, hard shadows, loud and confident", audience: "Gen Z", scheme: "light", chart: "blocks" },
  { id: "spatial", name: "Spatial", tagline: "Glass panels floating in depth, 3D charts", audience: "Futuristic", scheme: "dark", chart: "iso" },
  { id: "nocturne", name: "Nocturne", tagline: "Near-black with a neon signal and glowing data", audience: "Night owls", scheme: "dark", chart: "neon" },
];

export const designOf = (id: string | undefined) => DESIGNS.find((d) => d.id === id) ?? DESIGNS[0]!;

export const CHARTS: { id: ChartKind; label: string }[] = [
  { id: "iso", label: "3D towers" },
  { id: "rings", label: "Rings" },
  { id: "neon", label: "Neon bars" },
  { id: "blocks", label: "Blocks" },
  { id: "dots", label: "Dot matrix" },
  { id: "classic", label: "Classic bars" },
  { id: "editorial", label: "Editorial" },
];

export const DESIGN_KEY = "sk-design";

/** Runs before first paint: applies the saved design (and its forced scheme) to <html>. */
export const DESIGN_BOOT_SCRIPT = `try{var d=localStorage.getItem("${DESIGN_KEY}");var ok=${JSON.stringify(DESIGNS.map((d) => d.id))};if(d&&ok.indexOf(d)>-1){document.documentElement.dataset.design=d;var f=${JSON.stringify(Object.fromEntries(DESIGNS.filter((d) => d.scheme !== "both").map((d) => [d.id, d.scheme])))}[d];if(f){document.documentElement.classList.toggle("dark",f==="dark");}}}catch(e){}`;
