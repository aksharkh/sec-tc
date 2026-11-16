"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/display";
import { Tooltip } from "@/components/ui/menu";
import { EmptyState } from "@/components/kit/bits";
import { KSI_CHECKS } from "@/lib/mock/catalog";
import { useReady } from "@/lib/hooks";
import { useTrust } from "@/lib/store";
import type { Topic, TrustDocument } from "@/lib/types";
import { cn, fmt } from "@/lib/utils";
import { TenantFooter, TenantWordmark } from "./chrome";
import { RequestAccessDialog } from "./request-access";
import { Credential } from "./public/credential";
import { Compliance, Controls } from "./public/compliance";
import { DocSheet, Documents } from "./public/documents";
import { SecurityQA, SubscribeDialog, Subprocessors, UpdatesFeed } from "./public/engage";
import { AccessAndContacts, MachineReadable, ServiceStatus, VerifyDialog, overallStatus, uptimeOf } from "./public/ops";
import { useActiveSection } from "./public/layout";
import { AskBox } from "./public/ask";
import { DesignSwitcher } from "@/components/design/design-switcher";

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "compliance", label: "Compliance" },
  { id: "controls", label: "Controls" },
  { id: "documents", label: "Documents" },
  { id: "qa", label: "Security Q&A" },
  { id: "subprocessors", label: "Subprocessors" },
  { id: "status", label: "Status" },
  { id: "machine-readable", label: "Machine-readable" },
  { id: "updates", label: "Updates" },
  { id: "contact", label: "Contact" },
];
const NAV_IDS = NAV.map((n) => n.id);

export function PublicTrustPage() {
  const ready = useReady();
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [basket, setBasket] = React.useState<string[]>([]);
  const [requestDocs, setRequestDocs] = React.useState<string[]>([]);
  const [sheetDoc, setSheetDoc] = React.useState<TrustDocument | null>(null);
  const [subscribe, setSubscribe] = React.useState<{ open: boolean; topics: Topic[] }>({ open: false, topics: ["documents", "changes", "incidents"] });
  const [verifyOpen, setVerifyOpen] = React.useState(false);

  const openRequest = (ids: string[] = []) => {
    setRequestDocs(ids);
    setRequestOpen(true);
  };
  const openSubscribe = (topics: Topic[]) => setSubscribe({ open: true, topics });
  const toggleBasket = (id: string) => setBasket((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]));

  return (
    <div className="app-bg min-h-dvh bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <TenantWordmark />
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <DesignSwitcher />
            <Tooltip content="Subscribe to updates">
              <Button variant="ghost" size="icon-sm" className="hidden sm:inline-flex" aria-label="Subscribe to updates" onClick={() => openSubscribe(["documents", "changes", "incidents"])}>
                <BellRing />
              </Button>
            </Tooltip>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/t/northwind/portal">Reviewer sign in</Link>
            </Button>
            <Button variant="tenant" size="sm" onClick={() => openRequest(basket)}>
              Request access
            </Button>
          </div>
        </div>
        {ready && <SectionNav />}
      </header>

      <main className="mx-auto max-w-[1240px] px-4 sm:px-6">
        {ready ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
            <Hero onRequest={() => openRequest(basket)} onRequestDocs={(ids) => openRequest(ids)} onVerify={() => setVerifyOpen(true)} onOpenDoc={setSheetDoc} />
            <KeyFigures />
            <Compliance onOpenDoc={setSheetDoc} />
            <Controls onOpenDoc={setSheetDoc} />
            <Documents basket={basket} setBasket={setBasket} onRequest={openRequest} onOpenDoc={setSheetDoc} />
            <SecurityQA onOpenDoc={setSheetDoc} onRequest={() => openRequest(basket)} />
            <Subprocessors onSubscribe={openSubscribe} />
            <ServiceStatus onSubscribe={() => openSubscribe(["incidents"])} />
            <MachineReadable onVerify={() => setVerifyOpen(true)} />
            <UpdatesFeed onSubscribe={openSubscribe} onOpenDoc={setSheetDoc} />
            <AccessAndContacts onRequest={() => openRequest(basket)} />
          </motion.div>
        ) : (
          <PublicSkeleton />
        )}
      </main>
      <TenantFooter />

      <RequestAccessDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        docIds={requestDocs}
        onRemoveDoc={(id) => {
          setRequestDocs((d) => d.filter((x) => x !== id));
          setBasket((b) => b.filter((x) => x !== id));
        }}
        onSent={() => setBasket([])}
      />
      <DocSheet doc={sheetDoc} onClose={() => setSheetDoc(null)} inBasket={!!sheetDoc && basket.includes(sheetDoc.id)} onToggleBasket={toggleBasket} />
      <SubscribeDialog open={subscribe.open} topics={subscribe.topics} onOpenChange={(v) => setSubscribe((s) => ({ ...s, open: v }))} />
      <VerifyDialog open={verifyOpen} onOpenChange={setVerifyOpen} />
    </div>
  );
}

function SectionNav() {
  const active = useActiveSection(NAV_IDS);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-nav="${active}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);
  return (
    <nav aria-label="Sections" className="border-t border-line">
      <div ref={ref} className="scroll-thin mx-auto flex max-w-[1240px] gap-1 overflow-x-auto px-3 sm:px-5">
        {NAV.map((n) => {
          const on = active === n.id;
          return (
            <a
              key={n.id}
              href={`#${n.id}`}
              data-nav={n.id}
              aria-current={on ? "location" : undefined}
              className={cn("relative shrink-0 whitespace-nowrap px-2.5 py-2.5 text-[13px] font-medium transition-colors", on ? "text-fg" : "text-muted hover:text-fg")}
            >
              {n.label}
              {on && <motion.span layoutId="pub-nav" className="absolute inset-x-2.5 -bottom-px h-[2px] rounded-full bg-tenant" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function PublicSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-10 py-14 lg:grid-cols-[1.2fr_1fr] lg:py-20" aria-busy="true" aria-label="Loading">
      <div>
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-6 h-14 w-[92%]" />
        <Skeleton className="mt-3 h-14 w-[78%]" />
        <Skeleton className="mt-3 h-14 w-[55%]" />
        <Skeleton className="mt-8 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-[80%]" />
      </div>
      <Skeleton className="h-[420px] rounded-[14px]" />
    </div>
  );
}

/* ───────── Hero ───────── */
function Hero({ onRequest, onRequestDocs, onVerify, onOpenDoc }: { onRequest: () => void; onRequestDocs: (ids: string[]) => void; onVerify: () => void; onOpenDoc: (d: TrustDocument) => void }) {
  const profile = useTrust((s) => s.profile);
  const docs = useTrust((s) => s.documents);
  const components = useTrust((s) => s.components);
  const latest = React.useMemo(() => docs.flatMap((d) => d.versions.map((v) => v.publishedAt)).sort().at(-1)!, [docs]);
  const overall = overallStatus(components);
  return (
    <section id="overview" data-section className="scroll-mt-32 grid grid-cols-1 gap-12 pb-14 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16 lg:pb-16 lg:pt-16">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          <a href="#status" className="inline-flex items-center gap-2 font-medium text-fg hover:underline hover:underline-offset-4">
            <span className="relative inline-flex size-2">
              <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60", overall.tone === "success" ? "bg-success" : "bg-warning")} />
              <span className={cn("relative size-2 rounded-full", overall.tone === "success" ? "bg-success" : "bg-warning")} />
            </span>
            {overall.label}
          </a>
          <span aria-hidden className="text-faint">/</span>
          <span>Updated {fmt.date(latest)}</span>
        </div>
        <h1 className="mt-6 max-w-[15ch] font-serif text-[42px] leading-[1.02] tracking-[-0.02em] text-fg sm:text-[56px] lg:text-[60px]">
          How {profile.product} is secured, assessed and monitored.
        </h1>
        <p className="mt-6 max-w-[56ch] text-[16px] leading-relaxed text-muted">{profile.about}</p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button variant="tenant" size="lg" onClick={onRequest}>
            Request access
          </Button>
          <Button asChild variant="secondary" size="lg">
            <a href="#documents">
              Browse documents <ArrowRight />
            </a>
          </Button>
        </div>
        <AskBox onOpenDoc={onOpenDoc} onRequest={onRequestDocs} />
        <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 sm:grid-cols-4">
          {profile.facts.map((f) => (
            <div key={f.label}>
              <dt className="text-[12px] text-faint">{f.label}</dt>
              <dd className="mt-1 text-[13.5px] font-medium leading-snug text-fg">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="min-w-0 lg:pt-2">
        <Credential onVerify={onVerify} />
      </div>
    </section>
  );
}

function KeyFigures() {
  const docs = useTrust((s) => s.documents);
  const components = useTrust((s) => s.components);
  const faqs = useTrust((s) => s.faqs);
  const restricted = docs.filter((d) => d.visibility === "restricted").length;
  const checks = Object.values(KSI_CHECKS).reduce((a, b) => a + b.checks, 0);
  const figures = [
    { v: "10 of 10", l: `KSI families validated today, ${checks} automated checks`, href: "#controls" },
    { v: `${uptimeOf(components).toFixed(2)}%`, l: "Workbench uptime over the last 90 days", href: "#status" },
    { v: String(docs.length), l: `Documents, ${docs.length - restricted} public and ${restricted} for approved reviewers`, href: "#documents" },
    { v: String(faqs.filter((f) => f.public).length), l: "Security answers you can search right now", href: "#qa" },
  ];
  return (
    <div className="grid grid-cols-1 border-t border-line min-[480px]:grid-cols-2 lg:grid-cols-4">
      {figures.map((f, i) => (
        <a
          key={f.l}
          href={f.href}
          className={cn(
            "group block px-1 py-7 transition-colors hover:bg-raised/60 sm:px-6",
            i > 0 && "border-t border-line min-[480px]:border-t-0",
            i % 2 === 1 && "min-[480px]:border-l",
            i >= 2 && "min-[480px]:border-t lg:border-t-0",
            i > 0 && "lg:border-l",
          )}
        >
          <div className="font-serif text-[44px] leading-none tracking-[-0.02em] text-fg">{f.v}</div>
          <div className="mt-3 max-w-[26ch] text-[13px] leading-snug text-muted group-hover:text-fg">{f.l}</div>
        </a>
      ))}
    </div>
  );
}

export function UnknownTenant({ slug }: { slug: string }) {
  const ready = useReady(150);
  const tenant = useTrust((s) => s.tenants.find((t) => t.slug === slug));
  if (!ready) return <div className="min-h-dvh" />;
  return (
    <div className="app-bg grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="card w-full max-w-md">
        <EmptyState
          title={tenant ? `${tenant.name} is not public yet` : "Trust center not found"}
          body={
            tenant
              ? tenant.status === "draft"
                ? "This trust center publishes after the client's certification is complete. Only Northwind Cloud has full demo data."
                : "This trust center is still being set up. Only Northwind Cloud has full demo data."
              : "There is no trust center at this address."
          }
          action={
            <Button asChild variant="primary" size="sm">
              <Link href="/t/northwind">Open Northwind Cloud</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
