import { PLANS } from "@/lib/plans";
import Link from "next/link";

export default function PricingPage() {
  const plans = Object.values(PLANS);

  return (
    <div className="min-h-screen bg-bg">
      <header className="glass">
        <div className="section-container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-gold-500 to-gold-700 text-bg text-xs font-black">T</div>
            <span className="text-lg font-bold">Teos <span className="text-gold-500">AI</span></span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-xs text-[#5a5870] hover:text-[#e8e6f0]">Sign in</Link>
          </div>
        </div>
      </header>

      <section className="section-container py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-4">Choose your plan</h1>
          <p className="text-[#8a88a0] max-w-md mx-auto">Start free. Upgrade when you are ready to scale your content engine.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`rounded-xl border p-6 transition-all ${
                plan.highlight
                  ? "border-gold-500/40 bg-gold-500/5 shadow-lg shadow-gold-500/10"
                  : "border-white/[0.08] bg-bg-card"
              }`}
            >
              {plan.badge && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  plan.id === "free" ? "bg-white/10 text-[#8a88a0]" :
                  plan.highlight ? "bg-gold-500/20 text-gold-500" :
                  "bg-teal-500/10 text-teal-400"
                }`}>{plan.badge}</span>
              )}

              <h3 className="text-lg font-bold mt-4">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-2xl font-black">{plan.price}</span>
                <span className="text-xs text-[#8a88a0] ml-1">{plan.period}</span>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="text-sm text-[#c0bec8] flex items-start gap-2">
                    <span className="text-gold-500 mt-0.5">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {plan.id !== "free" && plan.dodLink && (
                <a
                  href={plan.dodLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-6 block w-full text-center py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    plan.highlight
                      ? "bg-gold-500 text-bg hover:bg-gold-400"
                      : "bg-white/10 text-[#e8e6f0] hover:bg-white/15"
                  }`}
                >
                  Get started
                </a>
              )}
              {plan.id === "free" && (
                <Link href="/signup" className="mt-6 block w-full text-center py-2.5 rounded-lg text-sm font-semibold bg-white/10 text-[#e8e6f0] hover:bg-white/15 transition-all">
                  Start free
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className="section-container py-8 text-center text-xs text-[#5a5870]">
        <p>Built in Alexandria, Egypt. Powered by sovereign AI infrastructure.</p>
      </footer>
    </div>
  );
}