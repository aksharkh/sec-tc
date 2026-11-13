"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Editorial two-column section: a sticky label column and the content column. */
export function Section({
  id,
  title,
  lead,
  aside,
  children,
  className,
}: {
  id: string;
  title: string;
  lead?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} data-section className={cn("scroll-mt-32 border-t border-line py-14 sm:py-16", className)}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-14">
        <div className="lg:sticky lg:top-36 lg:self-start">
          <h2 id={`${id}-h`} className="text-[22px] font-semibold leading-tight tracking-[-0.025em] text-fg">
            {title}
          </h2>
          {lead && <div className="mt-2.5 text-[14px] leading-relaxed text-muted">{lead}</div>}
          {aside && <div className="mt-5">{aside}</div>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

/** Highlights matched words in search results. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return <>{text}</>;
  const re = new RegExp(`(${words.join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-[3px] bg-tenant-soft px-0.5 text-fg">
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

/** Scrollspy: the id of the section nearest the top of the viewport. */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = React.useState(ids[0]!);
  React.useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-140px 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids]);
  return active;
}
