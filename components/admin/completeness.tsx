"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleDashed, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/display";
import { useTrust } from "@/lib/store";
import { useUi } from "@/lib/ui";
import { checkPackage, completenessPct } from "@/lib/completeness";
import { cn } from "@/lib/utils";

/** Is everything an agency expects published and current? Each gap has a one-click fix. */
export function PackageCompleteness({ onRegenerate, busy }: { onRegenerate: () => void; busy?: boolean }) {
  const docs = useTrust((s) => s.documents);
  const pkg = useTrust((s) => s.pkg);
  const setUi = useUi((s) => s.set);
  const router = useRouter();
  const checks = React.useMemo(() => checkPackage(docs, pkg), [docs, pkg]);
  const ok = checks.filter((c) => c.status === "ok").length;
  const pct = completenessPct(checks);
  const gaps = checks.filter((c) => c.status !== "ok");

  React.useEffect(() => {
    // Links from the overview and the snapshot dialog land here. Not returned: scrollIntoView returns a Promise in Chrome.
    if (window.location.hash === "#completeness") {
      document.getElementById("completeness")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <Card id="completeness" className="mt-4 scroll-mt-20 overflow-hidden">
      <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:px-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-fg">Package completeness</h3>
          <p className="mt-0.5 text-[12.5px] text-muted">
            Checked on every change: the package overview JSON, and that each document agencies expect is uploaded and within its refresh period.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="tnum font-serif text-[30px] leading-none text-fg">{pct}%</div>
            <div className="mt-1 text-[12px] text-muted">
              {ok} of {checks.length} checks
            </div>
          </div>
        </div>
      </div>
      <div className="mx-4 mt-3 flex h-1.5 gap-[3px] sm:mx-5" aria-hidden>
        {checks.map((c) => (
          <span key={c.id} className={cn("flex-1 rounded-full", c.status === "ok" ? "bg-success" : c.status === "stale" ? "bg-warning" : "bg-danger")} />
        ))}
      </div>
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {[...gaps, ...checks.filter((c) => c.status === "ok")].map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 sm:px-5">
            {c.status === "ok" ? (
              <CircleCheck className="size-4 shrink-0 text-success" />
            ) : c.status === "stale" ? (
              <Clock3 className="size-4 shrink-0 text-warning" />
            ) : (
              <CircleDashed className="size-4 shrink-0 text-danger" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-fg">
                {c.docId ? (
                  <Link href={`/admin/documents/${c.docId}`} className="hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  c.label
                )}
                {c.status !== "ok" && <Badge tone={c.status === "missing" ? "danger" : "warning"}>{c.status === "missing" ? "Missing" : "Out of date"}</Badge>}
              </div>
              <div className="text-[12px] text-muted">{c.detail}</div>
            </div>
            {c.fix === "regenerate" && (
              <Button size="xs" variant="secondary" loading={busy} onClick={onRegenerate}>
                Regenerate
              </Button>
            )}
            {c.fix === "upload" && (
              <Button
                size="xs"
                variant="secondary"
                onClick={() => {
                  setUi({ uploadOpen: true });
                  router.push("/admin/documents");
                }}
              >
                Upload
              </Button>
            )}
            {c.fix === "new-version" && c.docId && (
              <Button asChild size="xs" variant="secondary">
                <Link href={`/admin/documents/${c.docId}`}>Add version</Link>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
