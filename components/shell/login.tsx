"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { SecureKnotsLogo } from "@/components/brand/SecureKnotsLogo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useTrust } from "@/lib/store";
import { useQueryParam } from "@/lib/ui";
import { cn, sleep } from "@/lib/utils";
import { ThemeToggle } from "./app-shell";

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 21 21" className="size-4" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#0b0b0b] text-white lg:flex lg:flex-col">
      <svg className="absolute inset-0 size-full opacity-[0.07]" aria-hidden>
        <defs>
          <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M44 0H0V44" fill="none" stroke="white" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgb(255_255_255/0.07),transparent_55%)]" aria-hidden />
      <div className="relative flex items-center gap-2.5 p-10">
        <SecureKnotsLogo className="h-8 w-auto" onDark />
        <span className="text-[15px] font-semibold tracking-[-0.01em]">
          SecureKnots <span className="font-normal text-white/60">Trust</span>
        </span>
      </div>
      <div className="relative grid flex-1 place-items-center px-10">
        <SecureKnotsLogo variant="knot" className="h-[300px] w-auto text-white/[0.09]" />
      </div>
      <div className="relative max-w-md p-10">
        <p className="font-serif text-[30px] leading-[1.15] text-white/95">One place to share certification documents with the agencies that review them.</p>
        <p className="mt-4 text-[13px] leading-relaxed text-white/55">
          Admin access for SecureKnots staff and client administrators. Every sign-in requires multi-factor authentication.
        </p>
      </div>
    </div>
  );
}

function CodeInput({ value, onChange, invalid }: { value: string[]; onChange: (v: string[]) => void; invalid?: boolean }) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const set = (i: number, ch: string) => {
    const next = [...value];
    next[i] = ch;
    onChange(next);
  };
  return (
    <div className="flex gap-2" onPaste={(e) => {
      const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6).split("");
      if (!digits.length) return;
      e.preventDefault();
      onChange([...digits, ...Array(6 - digits.length).fill("")]);
      refs.current[Math.min(digits.length, 5)]?.focus();
    }}>
      {value.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          value={d}
          autoFocus={i === 0}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, "").slice(-1);
            set(i, ch);
            if (ch && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          className={cn(
            "h-12 w-full min-w-0 rounded-[9px] border bg-surface text-center font-mono text-[20px] font-medium text-fg shadow-xs outline-none transition-[border-color,box-shadow] focus:border-brand focus:shadow-[0_0_0_3px_var(--ring)] dark:bg-raised",
            invalid ? "border-danger" : d ? "border-line-strong" : "border-line-strong",
          )}
        />
      ))}
    </div>
  );
}

export function LoginScreen() {
  const router = useRouter();
  const next = useQueryParam("next");
  const signIn = useTrust((s) => s.setAdminSignedIn);
  const [step, setStep] = React.useState<"credentials" | "mfa">("credentials");
  const [email, setEmail] = React.useState("seema@secureknots.com");
  const [password, setPassword] = React.useState("demo-password");
  const [code, setCode] = React.useState<string[]>(Array(6).fill(""));
  const [busy, setBusy] = React.useState<"ms" | "email" | "code" | null>(null);
  const [error, setError] = React.useState("");
  const [resendIn, setResendIn] = React.useState(30);

  React.useEffect(() => {
    if (step !== "mfa" || resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [step, resendIn]);

  const toMfa = async (via: "ms" | "email") => {
    setError("");
    if (via === "email" && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password)) {
      setError("Enter your work email and password.");
      return;
    }
    setBusy(via);
    await sleep(700);
    setBusy(null);
    setResendIn(30);
    setStep("mfa");
  };

  const verify = React.useCallback(
    async (digits: string[]) => {
      if (digits.join("").length !== 6) {
        setError("Enter all 6 digits.");
        return;
      }
      setError("");
      setBusy("code");
      await sleep(650);
      signIn(true);
      router.push(next && next.startsWith("/admin") ? next : "/admin");
    },
    [signIn, router, next],
  );

  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <BrandPanel />
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <div className="flex items-center gap-2 lg:invisible">
            <SecureKnotsLogo className="h-7 w-auto" onDark />
            <span className="text-[14px] font-semibold text-fg">
              SecureKnots <span className="font-normal text-muted">Trust</span>
            </span>
          </div>
          <ThemeToggle />
        </div>
        <div className="grid flex-1 place-items-center px-4 pb-24 sm:px-6">
          <div className="w-full max-w-[380px]">
            <AnimatePresence mode="wait" initial={false}>
              {step === "credentials" ? (
                <motion.div key="cred" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                  <h1 className="font-serif text-[34px] leading-tight text-fg">Sign in</h1>
                  <p className="mt-1.5 text-[13.5px] text-muted">Admin console for SecureKnots Trust.</p>
                  <Button variant="secondary" size="lg" className="mt-7 w-full" loading={busy === "ms"} onClick={() => toMfa("ms")}>
                    <MicrosoftMark /> Continue with Microsoft 365
                  </Button>
                  <div className="my-5 flex items-center gap-3 text-[12px] text-faint">
                    <span className="h-px flex-1 bg-line" /> or with email <span className="h-px flex-1 bg-line" />
                  </div>
                  <form
                    className="grid grid-cols-1 gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      toMfa("email");
                    }}
                  >
                    <Field label="Work email" htmlFor="li-email">
                      <Input id="li-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </Field>
                    <Field label="Password" htmlFor="li-pass">
                      <Input id="li-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </Field>
                    {error && <p className="text-[12.5px] text-danger-fg">{error}</p>}
                    <Button type="submit" variant="primary" size="lg" loading={busy === "email"}>
                      Continue
                    </Button>
                  </form>
                  <p className="mt-6 rounded-[8px] border border-dashed border-line-strong px-3 py-2.5 text-[12.5px] text-muted">
                    Demo: the fields are prefilled and any 6-digit code works.
                  </p>
                </motion.div>
              ) : (
                <motion.div key="mfa" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                  <button onClick={() => { setStep("credentials"); setError(""); setCode(Array(6).fill("")); }} className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
                    <ArrowLeft className="size-3.5" /> Back
                  </button>
                  <span className="grid size-11 place-items-center rounded-full bg-brand-soft text-brand-ink">
                    <ShieldCheck className="size-5" />
                  </span>
                  <h1 className="mt-4 font-serif text-[34px] leading-tight text-fg">Verify it&apos;s you</h1>
                  <p className="mt-1.5 text-[13.5px] text-muted">
                    Enter the 6-digit code from your authenticator app for <span className="font-medium text-fg">{email}</span>.
                  </p>
                  <form
                    className="mt-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      verify(code);
                    }}
                  >
                    <CodeInput
                      value={code}
                      invalid={!!error}
                      onChange={(v) => {
                        setCode(v);
                        setError("");
                        if (v.join("").length === 6) verify(v);
                      }}
                    />
                    {error && <p className="mt-2 text-[12.5px] text-danger-fg">{error}</p>}
                    <Button type="submit" variant="primary" size="lg" className="mt-5 w-full" loading={busy === "code"}>
                      Verify and sign in
                    </Button>
                  </form>
                  <div className="mt-5 flex items-center justify-between text-[12.5px]">
                    <button disabled={resendIn > 0} onClick={() => setResendIn(30)} className="font-medium text-brand-ink disabled:font-normal disabled:text-faint">
                      {resendIn > 0 ? `Send a text instead in ${resendIn}s` : "Send a text instead"}
                    </button>
                    <span className="inline-flex items-center gap-1 text-faint">
                      <KeyRound className="size-3.5" /> Lost your device? Ask another admin
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="px-6 pb-20 text-center text-[12px] text-faint">
          Reviewers sign in with an emailed link from the client&apos;s trust page.{" "}
          <Link href="/t/northwind" className="text-muted underline-offset-4 hover:underline">
            Open Northwind&apos;s trust page
          </Link>
        </div>
      </div>
    </div>
  );
}
