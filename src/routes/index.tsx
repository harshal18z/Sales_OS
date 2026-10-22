import { createFileRoute, Link, useNavigate } from "@/lib/router-compat";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Sparkles } from "lucide-react";

import dashboardImg from "@/assets/landing/dashboard.png";
import researchImg from "@/assets/landing/research.png";
import companiesImg from "@/assets/landing/companies.png";
import leadsImg from "@/assets/landing/leads.png";
import emailsImg from "@/assets/landing/emails.png";
import campaignsImg from "@/assets/landing/campaigns.png";
import meetingsImg from "@/assets/landing/meetings.png";
import analyticsImg from "@/assets/landing/analytics.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SalesOS AI — Your First Autonomous AI Sales Team" },
      {
        name: "description",
        content:
          "SalesOS AI researches accounts, finds decision makers, writes personalized outreach, and books meetings. Autonomous revenue, 24/7.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "SalesOS AI — Your First Autonomous AI Sales Team" },
      {
        property: "og:description",
        content:
          "The autonomous AI sales team that researches, writes, and books meetings while you sleep.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SalesOS AI — Your First Autonomous AI Sales Team" },
      {
        name: "twitter:description",
        content: "The autonomous AI sales team that never sleeps.",
      },
    ],
  }),
  component: Landing,
});

/* ---------------- Landing ---------------- */

function Landing() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  // If a session exists (e.g. after OAuth callback), send the user to the app.
  useEffect(() => {
    if (!loading && session) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, session, navigate]);

  // Force dark theme on the landing page without touching global state.
  useEffect(() => {
    const el = document.documentElement;
    const had = el.classList.contains("dark");
    el.classList.add("dark");
    return () => {
      if (!had) el.classList.remove("dark");
    };
  }, []);

  // Avoid flashing the landing page while auth is resolving, or during redirect.
  if (loading || session) {
    return (
      <div className="min-h-screen bg-[oklch(0.11_0_0)] flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[oklch(0.11_0_0)] text-foreground antialiased overflow-x-clip">
      <AtmosphericBackground />
      <Nav />
      <main className="relative z-10">
        <Hero />
        <LogoStrip />
        <ScrollStory />
        <Comparison />
        <Integrations />
        <SocialProof />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

/* ---------------- Background ---------------- */

function AtmosphericBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.22_0.05_260)_0%,oklch(0.11_0_0)_55%)]" />
      {/* Aurora blooms */}
      <div className="absolute -top-40 left-1/2 h-[720px] w-[1200px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(0.55_0.22_260/0.35)_0%,transparent_60%)] blur-3xl" />
      <div className="absolute top-[40%] -left-40 h-[520px] w-[720px] rounded-full bg-[radial-gradient(circle,oklch(0.6_0.2_300/0.18)_0%,transparent_60%)] blur-3xl" />
      <div className="absolute top-[70%] right-[-10%] h-[520px] w-[720px] rounded-full bg-[radial-gradient(circle,oklch(0.62_0.18_220/0.18)_0%,transparent_60%)] blur-3xl" />
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.98_0_0/0.06) 1px, transparent 1px), linear-gradient(90deg, oklch(0.98_0_0/0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />
      {/* Noise */}
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
    </div>
  );
}

/* ---------------- Nav ---------------- */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "backdrop-blur-xl bg-[oklch(0.11_0_0/0.6)] border-b border-white/[0.06]"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <LogoMark />
          <span className="text-[14px] font-semibold tracking-tight">SalesOS AI</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-[13px] text-foreground-muted">
          <a href="#story" className="hover:text-foreground transition">
            Product
          </a>
          <a href="#compare" className="hover:text-foreground transition">
            Why SalesOS
          </a>
          <a href="#integrations" className="hover:text-foreground transition">
            Integrations
          </a>
          <a href="#faq" className="hover:text-foreground transition">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden sm:inline-flex h-8 items-center rounded-md px-3 text-[13px] text-foreground-muted hover:text-foreground transition"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-[13px] font-medium text-[oklch(0.11_0_0)] hover:opacity-90 transition"
          >
            Start free <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <div className="relative h-6 w-6 rounded-md bg-gradient-to-br from-white/90 to-white/60 grid place-items-center">
      <div className="h-2 w-2 rounded-[2px] bg-[oklch(0.11_0_0)]" />
      <div className="absolute inset-0 rounded-md ring-1 ring-inset ring-white/20" />
    </div>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -120]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={ref} className="relative pt-40 pb-32 md:pt-52 md:pb-44">
      <motion.div style={{ y, opacity }} className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex justify-center"
        >
          <div className="inline-flex items-center gap-2 h-7 px-3 rounded-full border border-white/10 bg-white/[0.03] text-[12px] text-foreground-muted backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.75_0.18_150)] shadow-[0_0_8px_oklch(0.75_0.18_150)]" />
            Now with autonomous outreach agents
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          className="mx-auto mt-8 max-w-5xl text-center text-[44px] sm:text-[68px] md:text-[88px] leading-[0.98] tracking-[-0.04em] font-semibold"
        >
          <span className="block bg-gradient-to-b from-white via-white to-white/50 bg-clip-text text-transparent">
            Your first autonomous
          </span>
          <span className="block bg-gradient-to-r from-white via-[oklch(0.85_0.12_260)] to-white/70 bg-clip-text text-transparent">
            AI sales team.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15 }}
          className="mx-auto mt-8 max-w-xl text-center text-[15px] md:text-[17px] leading-relaxed text-foreground-muted"
        >
          Researches companies. Finds buyers. Writes personalized outreach. Books meetings. Works
          24/7.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            to="/signup"
            className="group relative inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-[14px] font-medium text-[oklch(0.11_0_0)] transition hover:shadow-[0_0_40px_oklch(0.85_0.12_260/0.35)]"
          >
            Start free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#story"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-6 text-[14px] text-foreground hover:bg-white/[0.06] transition backdrop-blur"
          >
            Book demo
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </motion.div>
      </motion.div>

      {/* Centerpiece: animated AI workflow */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative mx-auto mt-20 max-w-5xl px-6"
      >
        <WorkflowStage />
      </motion.div>
    </section>
  );
}

/* ---------------- Workflow (cinematic AI in action) ---------------- */

const WORKFLOW_STEPS = [
  { label: "Researching Acme Corp", done: "Business understood", tone: "260" },
  { label: "Finding decision makers", done: "3 verified contacts", tone: "220" },
  { label: "Generating outreach", done: "Personalized email ready", tone: "300" },
  { label: "Sending sequence", done: "Delivered · 2 opens", tone: "160" },
  { label: "Awaiting reply", done: "Positive reply from Sarah", tone: "150" },
  { label: "Booking meeting", done: "Thursday, 2:00 PM PT", tone: "260" },
];

function WorkflowStage() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduce) {
      setStep(WORKFLOW_STEPS.length - 1);
      return;
    }
    const id = setInterval(() => {
      setStep((s) => (s + 1) % (WORKFLOW_STEPS.length + 2));
    }, 1800);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="relative">
      {/* Glow */}
      <div className="absolute inset-x-10 -inset-y-8 rounded-[32px] bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.22_260/0.4)_0%,transparent_70%)] blur-2xl" />
      {/* Frame */}
      <div className="relative rounded-2xl border border-white/[0.08] bg-[oklch(0.14_0_0/0.7)] backdrop-blur-xl shadow-[0_40px_120px_-30px_oklch(0.05_0_0)] overflow-hidden">
        {/* Chrome */}
        <div className="flex items-center gap-2 h-9 px-4 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
            <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
          </div>
          <div className="ml-4 flex items-center gap-1.5 text-[11px] text-foreground-subtle font-mono">
            <Sparkles className="h-3 w-3 text-[oklch(0.75_0.15_260)]" />
            salesos.ai / agents / autonomous-run
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr]">
          {/* Left: agent log */}
          <div className="p-5 md:p-7 border-b md:border-b-0 md:border-r border-white/[0.06]">
            <div className="text-[11px] uppercase tracking-[0.14em] text-foreground-subtle mb-4 font-mono">
              Agent activity
            </div>
            <ul className="space-y-2.5">
              {WORKFLOW_STEPS.map((s, i) => {
                const active = i === step;
                const done = i < step;
                return (
                  <li
                    key={i}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-all ${
                      active
                        ? "bg-white/[0.05] border border-white/10"
                        : "border border-transparent"
                    }`}
                  >
                    <StatusDot state={done ? "done" : active ? "active" : "idle"} tone={s.tone} />
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate ${
                          done
                            ? "text-foreground-muted"
                            : active
                              ? "text-foreground"
                              : "text-foreground-subtle"
                        }`}
                      >
                        {done ? s.done : s.label + (active ? "…" : "")}
                      </div>
                    </div>
                    {done && <Check className="h-3.5 w-3.5 text-[oklch(0.75_0.18_150)]" />}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Right: dynamic canvas */}
          <div className="relative p-5 md:p-7 min-h-[340px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={Math.min(step, WORKFLOW_STEPS.length - 1)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <WorkflowCanvas step={Math.min(step, WORKFLOW_STEPS.length - 1)} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ state, tone }: { state: "idle" | "active" | "done"; tone: string }) {
  if (state === "done")
    return (
      <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.75_0.18_150)] shadow-[0_0_8px_oklch(0.75_0.18_150)]" />
    );
  if (state === "active")
    return (
      <span className="relative flex h-2 w-2">
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping"
          style={{ background: `oklch(0.7 0.18 ${tone})` }}
        />
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ background: `oklch(0.75 0.18 ${tone})` }}
        />
      </span>
    );
  return <span className="h-1.5 w-1.5 rounded-full bg-white/15" />;
}

function WorkflowCanvas({ step }: { step: number }) {
  // Step-specific micro visualization
  switch (step) {
    case 0:
      return <CanvasResearch />;
    case 1:
      return <CanvasContacts />;
    case 2:
      return <CanvasEmail />;
    case 3:
      return <CanvasSending />;
    case 4:
      return <CanvasReply />;
    default:
      return <CanvasMeeting />;
  }
}

function MiniCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">{children}</div>
  );
}

function CanvasResearch() {
  return (
    <div className="space-y-3">
      <MiniCard>
        <div className="text-[11px] uppercase tracking-[0.14em] text-foreground-subtle font-mono mb-2">
          Acme Corp
        </div>
        {[
          "Enterprise SaaS · 2,400 employees",
          "Series D · $180M funding",
          "Recently launched AI platform",
        ].map((t, i) => (
          <motion.div
            key={t}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.15 }}
            className="text-[13px] text-foreground-muted py-1"
          >
            · {t}
          </motion.div>
        ))}
      </MiniCard>
    </div>
  );
}

function CanvasContacts() {
  const people = [
    { n: "Sarah Chen", t: "VP Sales" },
    { n: "Marcus Ito", t: "Head of RevOps" },
    { n: "Priya Ravi", t: "Director, GTM" },
  ];
  return (
    <div className="space-y-2">
      {people.map((p, i) => (
        <motion.div
          key={p.n}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.12 }}
          className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3"
        >
          <div
            className="h-8 w-8 rounded-full grid place-items-center text-[11px] font-medium text-white"
            style={{ background: `oklch(0.4 0.15 ${220 + i * 30})` }}
          >
            {p.n
              .split(" ")
              .map((x) => x[0])
              .join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-foreground truncate">{p.n}</div>
            <div className="text-[11px] text-foreground-subtle truncate">{p.t}</div>
          </div>
          <Check className="h-3.5 w-3.5 text-[oklch(0.75_0.18_150)]" />
        </motion.div>
      ))}
    </div>
  );
}

function CanvasEmail() {
  const lines = [
    "Hi Sarah — noticed Acme just launched",
    "your AI platform. Congrats on the",
    "Series D. We help RevOps teams like",
    "yours automate outbound research.",
    "Worth a 15-min chat next week?",
  ];
  return (
    <MiniCard>
      <div className="text-[11px] uppercase tracking-[0.14em] text-foreground-subtle font-mono mb-2">
        To: sarah@acme.com
      </div>
      <div className="text-[13px] text-foreground font-medium mb-3">Congrats on the Series D</div>
      <div className="space-y-1">
        {lines.map((l, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="text-[13px] text-foreground-muted"
          >
            {l}
          </motion.div>
        ))}
      </div>
    </MiniCard>
  );
}

function CanvasSending() {
  return (
    <div className="space-y-3">
      <MiniCard>
        <div className="flex items-center justify-between text-[12px] text-foreground-muted mb-3">
          <span>Sequence · Day 1</span>
          <span className="text-[oklch(0.75_0.18_150)]">Delivered</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "72%" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full bg-gradient-to-r from-[oklch(0.6_0.2_260)] to-[oklch(0.75_0.2_300)]"
          />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["124", "Sent"],
            ["48", "Opens"],
            ["7", "Replies"],
          ].map(([v, k]) => (
            <div key={k} className="rounded-lg bg-white/[0.02] py-2">
              <div className="text-[15px] font-semibold">{v}</div>
              <div className="text-[10px] uppercase tracking-wider text-foreground-subtle">{k}</div>
            </div>
          ))}
        </div>
      </MiniCard>
    </div>
  );
}

function CanvasReply() {
  return (
    <MiniCard>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-7 w-7 rounded-full bg-[oklch(0.4_0.15_260)] grid place-items-center text-[11px] text-white font-medium">
          SC
        </div>
        <div className="text-[12px] text-foreground-muted">Sarah Chen replied</div>
      </div>
      <div className="text-[13px] text-foreground leading-relaxed">
        "This is interesting — happy to chat. Does Thursday afternoon work?"
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-[oklch(0.75_0.18_150)]">
        <Sparkles className="h-3 w-3" /> AI classified as positive intent
      </div>
    </MiniCard>
  );
}

function CanvasMeeting() {
  return (
    <MiniCard>
      <div className="text-[11px] uppercase tracking-[0.14em] text-foreground-subtle font-mono mb-3">
        Meeting booked
      </div>
      <div className="rounded-lg border border-white/[0.08] bg-gradient-to-br from-[oklch(0.2_0.05_260)] to-[oklch(0.14_0_0)] p-4">
        <div className="text-[13px] font-medium">Discovery · Sarah Chen</div>
        <div className="mt-1 text-[12px] text-foreground-muted">Thursday · 2:00 – 2:30 PM PT</div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-foreground-subtle">
          <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.75_0.18_150)]" />
          Added to your calendar · brief prepared by AI
        </div>
      </div>
    </MiniCard>
  );
}

/* ---------------- Logo strip ---------------- */

function LogoStrip() {
  const logos = [
    "Google",
    "Gmail",
    "Outlook",
    "Slack",
    "HubSpot",
    "Salesforce",
    "Apollo",
    "Zapier",
  ];
  return (
    <section className="relative py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center text-[11px] uppercase tracking-[0.18em] text-foreground-subtle mb-8">
          Works with the tools your team already uses
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70">
          {logos.map((l) => (
            <div key={l} className="text-[15px] font-medium tracking-tight text-foreground-muted">
              {l}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Scroll Story ---------------- */

const STORY = [
  {
    kicker: "01 · Wake",
    title: "AI wakes up when your team sleeps.",
    copy: "Overnight, agents scan your pipeline, prioritize accounts, and stage the day.",
    img: dashboardImg,
  },
  {
    kicker: "02 · Research",
    title: "Deep research on every account.",
    copy: "Live web research, structured intelligence, and ICP fit — all cited.",
    img: researchImg,
  },
  {
    kicker: "03 · Intelligence",
    title: "Company intelligence, connected.",
    copy: "Every signal linked to the accounts and people that matter.",
    img: companiesImg,
  },
  {
    kicker: "04 · Buyers",
    title: "Discovers real decision makers.",
    copy: "Verified contacts with confidence scores. Never fabricated.",
    img: leadsImg,
  },
  {
    kicker: "05 · Outreach",
    title: "Writes outreach that sounds like you.",
    copy: "Personalized on research, tuned to tone, aware of context.",
    img: emailsImg,
  },
  {
    kicker: "06 · Campaigns",
    title: "Launches multi-touch campaigns.",
    copy: "Sequences, A/B variants, spam-safe — approved by you, sent by AI.",
    img: campaignsImg,
  },
  {
    kicker: "07 · Meetings",
    title: "Books meetings and preps briefs.",
    copy: "Handles scheduling, prep docs, and follow-ups end-to-end.",
    img: meetingsImg,
  },
  {
    kicker: "08 · Signal",
    title: "Every reply becomes revenue signal.",
    copy: "AI classifies intent, updates CRM, and forecasts what's next.",
    img: analyticsImg,
  },
];

function ScrollStory() {
  return (
    <section id="story" className="relative py-28">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          kicker="The autonomous loop"
          title="Watch it work, end to end."
          copy="Nine steps. One command. Zero busywork."
        />
        <div className="mt-24 space-y-40">
          {STORY.map((s, i) => (
            <StoryPanel key={i} index={i} data={s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StoryPanel({ index, data }: { index: number; data: (typeof STORY)[number] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 60, reduce ? 0 : -60]);
  const rot = useTransform(scrollYProgress, [0, 1], [reduce ? 0 : 6, reduce ? 0 : -6]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.96, 1, 0.98]);
  const smoothY = useSpring(y, { stiffness: 60, damping: 20 });
  const flip = index % 2 === 1;

  return (
    <div
      ref={ref}
      className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
        flip ? "lg:[&>div:first-child]:order-2" : ""
      }`}
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="text-[11px] uppercase tracking-[0.2em] text-[oklch(0.75_0.15_260)] font-mono">
          {data.kicker}
        </div>
        <h3 className="mt-4 text-[32px] md:text-[44px] leading-[1.05] tracking-[-0.03em] font-semibold text-foreground">
          {data.title}
        </h3>
        <p className="mt-5 max-w-md text-[15px] text-foreground-muted leading-relaxed">
          {data.copy}
        </p>
      </motion.div>

      <motion.div style={{ y: smoothY, scale }} className="relative">
        <div className="absolute -inset-8 rounded-[32px] bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.22_260/0.28)_0%,transparent_70%)] blur-2xl" />
        <motion.div
          style={{ rotate: rot }}
          className="relative rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl overflow-hidden shadow-[0_40px_100px_-30px_oklch(0.05_0_0)]"
        >
          <div className="flex items-center gap-1.5 h-8 px-4 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="h-2 w-2 rounded-full bg-white/10" />
            <div className="h-2 w-2 rounded-full bg-white/10" />
            <div className="h-2 w-2 rounded-full bg-white/10" />
          </div>
          <img
            src={data.img}
            alt={data.title}
            loading="lazy"
            decoding="async"
            className="block w-full h-auto"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}

function SectionHeader({ kicker, title, copy }: { kicker: string; title: string; copy?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-[11px] uppercase tracking-[0.2em] text-[oklch(0.75_0.15_260)] font-mono">
        {kicker}
      </div>
      <h2 className="mt-4 text-[36px] md:text-[56px] leading-[1.02] tracking-[-0.035em] font-semibold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
        {title}
      </h2>
      {copy && <p className="mt-4 text-[15px] text-foreground-muted">{copy}</p>}
    </div>
  );
}

/* ---------------- Comparison ---------------- */

function Comparison() {
  const traditional = [
    "Research accounts",
    "Enrich contacts",
    "Write email",
    "Send follow-up",
    "Book meeting",
    "Update CRM",
  ];
  return (
    <section id="compare" className="relative py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader kicker="Before / After" title="Stop managing sales. Let AI run it." />
        <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8">
            <div className="text-[12px] uppercase tracking-[0.18em] text-foreground-subtle font-mono mb-6">
              Traditional sales
            </div>
            <ul className="space-y-3">
              {traditional.map((t, i) => (
                <li key={t} className="flex items-center gap-3 text-[14px] text-foreground-muted">
                  <span className="h-6 w-6 rounded-md border border-white/10 grid place-items-center text-[10px] font-mono text-foreground-subtle">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {t}
                  <span className="ml-auto text-[11px] text-foreground-subtle">manual</span>
                </li>
              ))}
              <li className="pt-4 mt-4 border-t border-white/[0.06] text-[12px] text-foreground-subtle">
                Hours per account · context lost between tools
              </li>
            </ul>
          </div>

          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-8 overflow-hidden">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,oklch(0.55_0.22_260/0.35)_0%,transparent_70%)] blur-2xl" />
            <div className="text-[12px] uppercase tracking-[0.18em] text-[oklch(0.75_0.15_260)] font-mono mb-6">
              SalesOS AI
            </div>
            <div className="rounded-xl border border-white/10 bg-[oklch(0.14_0_0/0.6)] p-4 font-mono text-[13px] text-foreground-muted">
              <span className="text-[oklch(0.75_0.18_150)]">$</span> run outbound --account acme.com
            </div>
            <ul className="mt-4 space-y-3">
              {["Research", "Enrich", "Personalize", "Send", "Follow up", "Book", "Log to CRM"].map(
                (t) => (
                  <li key={t} className="flex items-center gap-3 text-[14px] text-foreground">
                    <Check className="h-4 w-4 text-[oklch(0.75_0.18_150)]" />
                    {t}
                    <span className="ml-auto text-[11px] text-foreground-subtle">autonomous</span>
                  </li>
                ),
              )}
            </ul>
            <div className="pt-4 mt-4 border-t border-white/[0.06] text-[12px] text-foreground-subtle">
              Minutes per account · everything in one place
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Integrations ---------------- */

function Integrations() {
  const items = [
    "Google",
    "Gmail",
    "Outlook",
    "Slack",
    "HubSpot",
    "Salesforce",
    "Pipedrive",
    "Apollo",
    "Zapier",
    "Supabase",
    "Notion",
    "Linear",
  ];
  return (
    <section id="integrations" className="relative py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader
          kicker="Integrations"
          title="Plugs into your revenue stack."
          copy="Native connections to the tools your team relies on every day."
        />
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((n) => (
            <div
              key={n}
              className="group rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-5 transition hover:bg-white/[0.05] hover:border-white/10"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/10 grid place-items-center text-[12px] font-semibold">
                  {n[0]}
                </div>
                <div className="text-[14px] text-foreground">{n}</div>
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-foreground-subtle opacity-0 group-hover:opacity-100 transition" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Social proof (layout only) ---------------- */

function SocialProof() {
  return (
    <section className="relative py-28">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeader kicker="Trusted by builders of pipeline" title="Loved by revenue teams." />
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 min-h-[220px] flex flex-col"
            >
              <div className="text-[13px] text-foreground-subtle italic">
                Customer testimonial coming soon.
              </div>
              <div className="mt-auto flex items-center gap-3 pt-6">
                <div className="h-8 w-8 rounded-full bg-white/[0.06]" />
                <div>
                  <div className="h-2 w-24 rounded bg-white/[0.06] mb-1.5" />
                  <div className="h-2 w-16 rounded bg-white/[0.04]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

const FAQS = [
  {
    q: "How autonomous is SalesOS AI really?",
    a: "Fully autonomous with human-in-the-loop approvals where it matters. AI handles research, drafting, sequencing, and follow-ups — you approve what goes out.",
  },
  {
    q: "Where does the data come from?",
    a: "Live web research, your connected CRM, and enrichment providers. Every claim is cited. Nothing is fabricated.",
  },
  {
    q: "Does it work with our existing CRM?",
    a: "Native integrations with HubSpot, Salesforce, and Pipedrive. Bi-directional sync with clear audit trails.",
  },
  {
    q: "Is our data secure?",
    a: "Enterprise-grade: SOC2-aligned practices, encryption at rest and in transit, granular workspace roles, and full audit logs.",
  },
  {
    q: "How long does setup take?",
    a: "Under 10 minutes. Connect your inbox and CRM, pick an ICP, and let the agents start working overnight.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative py-32">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeader kicker="Answers" title="Questions, answered." />
        <div className="mt-16 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="text-[15px] text-foreground font-medium">{f.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-foreground-muted transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 text-[14px] text-foreground-muted leading-relaxed">
                        {f.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Final CTA ---------------- */

function FinalCTA() {
  return (
    <section className="relative py-40">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <div className="relative">
          <div className="absolute inset-x-0 -inset-y-16 bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.22_260/0.28)_0%,transparent_70%)] blur-3xl" />
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="relative text-[48px] md:text-[88px] leading-[0.98] tracking-[-0.04em] font-semibold bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent"
          >
            Let AI build
            <br />
            your pipeline.
          </motion.h2>
          <div className="relative mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-medium text-[oklch(0.11_0_0)] hover:shadow-[0_0_60px_oklch(0.85_0.12_260/0.4)] transition"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-7 text-[15px] text-foreground hover:bg-white/[0.06] transition"
            >
              Sign in
            </Link>
          </div>
          <div className="relative mt-8 text-[12px] text-foreground-subtle">
            Free to start · No credit card required
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */

function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/[0.06] py-14">
      <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <LogoMark />
          <span className="text-[13px] font-medium">SalesOS AI</span>
          <span className="ml-2 text-[12px] text-foreground-subtle">
            © {new Date().getFullYear()}
          </span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-foreground-muted">
          <Link to="/privacy" className="hover:text-foreground transition">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-foreground transition">
            Terms
          </Link>
          <Link to="/security" className="hover:text-foreground transition">
            Security
          </Link>
          <Link to="/login" className="hover:text-foreground transition">
            Sign in
          </Link>
          <Link to="/signup" className="hover:text-foreground transition">
            Start free
          </Link>
        </nav>
      </div>
    </footer>
  );
}
