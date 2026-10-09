"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface StickyCTAProps {
  seatsTaken?: number;
  seatsTotal?: number;
}

export default function StickyCTA({
  seatsTaken = 37,
  seatsTotal = 50,
}: StickyCTAProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("sticky_dismissed") ? true : false;
  });
  const pricingRef = useRef<Element | null>(null);

  useEffect(() => {
    if (dismissed) {
      return;
    }
    if (typeof window !== "undefined") {
      const showTimer = setTimeout(() => setVisible(true), 3000);

      const pricingEl = document.getElementById("pricing");
      if (pricingEl) pricingRef.current = pricingEl;

      const observer = new IntersectionObserver(
        ([entry]) => {
          setVisible(!entry.isIntersecting);
        },
        { threshold: 0.15 }
      );
      if (pricingRef.current) observer.observe(pricingRef.current);

      function onScroll() {
        if (window.scrollY < 300) setVisible(false);
        else if (!dismissed) setVisible(true);
      }
      window.addEventListener("scroll", onScroll, { passive: true });

      return () => {
        clearTimeout(showTimer);
        observer.disconnect();
        window.removeEventListener("scroll", onScroll);
      };
    }
  }, [dismissed]);

  function dismiss() {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem("sticky_dismissed", "1");
  }

  const seatsLeft = seatsTotal - seatsTaken;
  const pct = Math.round((seatsTaken / seatsTotal) * 100);

  if (dismissed) return null;

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(0);    opacity: 1; }
          to   { transform: translateY(100%); opacity: 0; }
        }
        .sticky-bar {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 999;
        }
        @media (min-width: 768px) {
          .sticky-bar { display: none !important; }
        }
        .sticky-enter { animation: slideUp  0.35s cubic-bezier(.16,1,.3,1) both; }
        .sticky-exit  { animation: slideDown 0.3s ease both; }

        .sticky-inner {
          background: linear-gradient(135deg, #0C0C14, #111120);
          border-top: 1px solid rgba(201,168,76,.35);
          padding: 14px 18px 18px;
          box-shadow: 0 -12px 40px rgba(123,79,191,.2);
        }
        .sticky-bar-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .sticky-seats {
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,.35);
          text-transform: uppercase;
          white-space: nowrap;
        }
        .sticky-price {
          font-family: 'Cinzel', serif;
          font-weight: 900;
          font-size: 1.3rem;
          background: linear-gradient(90deg, #C9A84C, #E8C96B, #C9A84C);
          background-size: 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmerS 2.5s linear infinite;
          white-space: nowrap;
        }
        @keyframes shimmerS {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
        .sticky-cta {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 12px 16px;
          border-radius: 14px;
          background: linear-gradient(135deg, #C9A84C, #A07030);
          color: #040404;
          font-family: 'Space Mono', monospace;
          font-weight: 700;
          font-size: 0.68rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-decoration: none;
          border: none;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: box-shadow .2s;
        }
        .sticky-cta:active { box-shadow: 0 4px 20px rgba(201,168,76,.5); }
        .sticky-dismiss {
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 50%;
          color: rgba(255,255,255,.35);
          font-size: 0.75rem;
          cursor: pointer;
          flex-shrink: 0;
          -webkit-tap-highlight-color: transparent;
        }
        .sticky-bar-track {
          height: 3px;
          background: rgba(255,255,255,.06);
          border-radius: 99px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        .sticky-bar-fill {
          height: 100%;
          border-radius: 99px;
          background: linear-gradient(90deg, #7B4FBF, #C9A84C);
          transition: width 1.2s cubic-bezier(.16,1,.3,1);
        }
      `}</style>

      <div
        className={`sticky-bar ${visible ? "sticky-enter" : "sticky-exit"}`}
        style={{ display: visible || dismissed ? undefined : "none" }}
        aria-live="polite"
      >
        <div className="sticky-inner">
          <div className="sticky-bar-track">
            <div className="sticky-bar-fill" style={{ width: `${pct}%` }} />
          </div>

          <div className="sticky-bar-row">
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", flexShrink: 0 }}>
              <div className="sticky-price">$149</div>
              <div className="sticky-seats">
                {seatsLeft} of {seatsTotal} left
              </div>
            </div>

            <a
              href="https://dodo.pe/relh2gradr9"
              target="_blank"
              rel="noopener noreferrer"
              className="sticky-cta"
            >
              🔥 Claim Lifetime
            </a>

            <button
              className="sticky-dismiss"
              onClick={dismiss}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>

          <p style={{ textAlign: "center", fontFamily: "'Space Mono', monospace", fontSize: "0.55rem", color: "rgba(255,255,255,.2)", letterSpacing: "0.08em", marginTop: "8px" }}>
            PRICE RISES AFTER TIKTOK + VIDEO UPGRADE SHIPS
          </p>
        </div>
      </div>
    </>
  );
}
