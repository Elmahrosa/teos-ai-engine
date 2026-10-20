"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

interface ExitPopupProps {
  seatsTaken?: number;
  seatsTotal?: number;
}

export default function ExitPopup({
  seatsTaken = 37,
  seatsTotal = 50,
}: ExitPopupProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const triggered = useRef(false);
  const seatsLeft = seatsTotal - seatsTaken;
  const pct = Math.round((seatsTaken / seatsTotal) * 100);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 300);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const shown = sessionStorage.getItem("exit_popup_shown");
      if (shown) { setHasShown(true); return; }
    }

    function onMouseLeave(e: MouseEvent) {
      if (triggered.current) return;
      if (e.clientY <= 10) {
        triggered.current = true;
        sessionStorage.setItem("exit_popup_shown", "1");
        setHasShown(true);
        setTimeout(() => setOpen(true), 120);
      }
    }

    function onVisibilityChange() {
      if (triggered.current) return;
      if (document.visibilityState === "hidden") {
        triggered.current = true;
        sessionStorage.setItem("exit_popup_shown", "1");
        setHasShown(true);
      }
    }

    let lastY = window.scrollY;
    let lastDir = 0;
    let reversals = 0;
    function onScroll() {
      if (triggered.current) return;
      const y = window.scrollY;
      const dir = y < lastY ? -1 : 1;
      if (dir !== lastDir && dir === -1) reversals++;
      if (reversals >= 2 && window.scrollY < 300) {
        triggered.current = true;
        sessionStorage.setItem("exit_popup_shown", "1");
        setHasShown(true);
        setTimeout(() => setOpen(true), 200);
      }
      lastY = y;
      lastDir = dir;
    }

    const arm = setTimeout(() => {
      document.addEventListener("mouseleave", onMouseLeave);
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("scroll", onScroll, { passive: true });
    }, 8000);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(arm);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("keydown", onKey);
    };
  }, [close]);

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes overlayIn  { from{opacity:0} to{opacity:1} }
        @keyframes overlayOut { from{opacity:1} to{opacity:0} }
        @keyframes modalIn    { from{opacity:0;transform:scale(.94) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes modalOut   { from{opacity:1;transform:scale(1) translateY(0)}     to{opacity:0;transform:scale(.94) translateY(16px)} }
        @keyframes shimmerX   { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes livepulse  { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes fillBar    { from{width:0} to{width:${pct}%} }

        .exit-overlay {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          background: rgba(0,0,0,.78);
          backdrop-filter: blur(12px);
          animation: ${closing ? "overlayOut" : "overlayIn"} .3s ease both;
        }
        .exit-modal {
          width: 100%; max-width: 480px;
          background: linear-gradient(145deg, #0E0E18, #131321);
          border: 1px solid rgba(201,168,76,.35);
          border-radius: 28px;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,.7), 0 0 0 1px rgba(123,79,191,.15);
          animation: ${closing ? "modalOut" : "modalIn"} .35s cubic-bezier(.16,1,.3,1) both;
          position: relative;
        }
        .exit-glow {
          position: absolute; width: 320px; height: 320px;
          border-radius: 50%; filter: blur(70px); pointer-events: none;
          background: #7B4FBF; opacity: .12;
          top: -80px; right: -80px;
        }
        .exit-glow2 {
          position: absolute; width: 200px; height: 200px;
          border-radius: 50%; filter: blur(60px); pointer-events: none;
          background: #C9A84C; opacity: .08;
          bottom: -40px; left: -40px;
        }
        .exit-top {
          background: linear-gradient(90deg, #3D1F80, #7B4FBF, #3D1F80);
          padding: 10px 20px;
          text-align: center;
          font-family: 'Space Mono', monospace;
          font-size: 0.62rem;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,.85);
          text-transform: uppercase;
        }
        .exit-body { padding: 32px 28px 28px; position: relative; }
        .exit-close {
          position: absolute; top: 16px; right: 16px;
          width: 32px; height: 32px;
          border-radius: 50%;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.1);
          color: rgba(255,255,255,.4);
          font-size: 0.85rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all .2s;
          -webkit-tap-highlight-color: transparent;
        }
        .exit-close:hover { background: rgba(255,255,255,.12); color: rgba(255,255,255,.8); }
        .exit-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 14px; border-radius: 99px;
          border: 1px solid rgba(201,168,76,.3);
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.1em;
          color: #C9A84C; text-transform: uppercase;
          margin-bottom: 20px;
        }
        .exit-live {
          width: 6px; height: 6px; border-radius: 50%; background: #4ade80;
          animation: livepulse 1.5s ease infinite;
        }
        .exit-title {
          font-family: 'Cinzel', serif;
          font-weight: 900;
          font-size: clamp(1.6rem, 5vw, 2.2rem);
          line-height: 1.1;
          margin-bottom: 10px;
          color: rgba(255,255,255,.92);
        }
        .exit-shimmer {
          background: linear-gradient(90deg, #C9A84C, #E8C96B, #C9A84C, #E8C96B);
          background-size: 240%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmerX 2.8s linear infinite;
        }
        .exit-sub {
          font-family: 'Crimson Pro', serif;
          font-size: 1rem;
          color: rgba(255,255,255,.5);
          line-height: 1.6;
          margin-bottom: 22px;
        }
        .exit-seat-row {
          display: flex; justify-content: space-between;
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; letter-spacing: 0.08em;
          color: #C9A84C; margin-bottom: 6px;
        }
        .exit-track {
          height: 5px; border-radius: 99px;
          background: rgba(255,255,255,.06); overflow: hidden;
          margin-bottom: 22px;
        }
        .exit-fill {
          height: 100%; border-radius: 99px;
          background: linear-gradient(90deg, #7B4FBF, #C9A84C);
          animation: fillBar .9s .2s cubic-bezier(.16,1,.3,1) both;
        }
        .exit-price-row {
          display: flex; align-items: baseline; gap: 10px;
          margin-bottom: 20px;
        }
        .exit-price {
          font-family: 'Cinzel', serif; font-weight: 900;
          font-size: 3rem; line-height: 1;
        }
        .exit-orig {
          font-family: 'Space Mono', monospace;
          font-size: 0.7rem; color: rgba(255,255,255,.25);
          text-decoration: line-through;
        }
        .exit-onetime {
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem; color: rgba(255,255,255,.3);
          letter-spacing: 0.08em;
        }
        .exit-features {
          display: flex; flex-direction: column; gap: 7px;
          margin-bottom: 22px;
        }
        .exit-feat {
          display: flex; gap: 8px; align-items: flex-start;
          font-family: 'Crimson Pro', serif;
          font-size: 0.95rem; color: rgba(255,255,255,.68);
        }
        .exit-feat-check { color: #C9A84C; flex-shrink: 0; margin-top: 1px; }
        .exit-btn-primary {
          display: block; width: 100%;
          padding: 16px;
          border-radius: 16px;
          background: linear-gradient(135deg, #C9A84C, #A07030);
          color: #040404;
          font-family: 'Space Mono', monospace;
          font-weight: 700; font-size: 0.72rem;
          letter-spacing: 0.14em; text-transform: uppercase;
          text-align: center; text-decoration: none;
          border: none; cursor: pointer;
          transition: all .2s;
          margin-bottom: 10px;
        }
        .exit-btn-primary:hover { box-shadow: 0 8px 28px rgba(201,168,76,.38); }
        .exit-btn-ghost {
          display: block; width: 100%;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.08);
          background: transparent;
          color: rgba(255,255,255,.3);
          font-family: 'Space Mono', monospace;
          font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase;
          text-align: center; text-decoration: none;
          cursor: pointer; transition: all .2s;
        }
        .exit-btn-ghost:hover { background: rgba(255,255,255,.04); color: rgba(255,255,255,.5); }
        .exit-note {
          text-align: center;
          font-family: 'Space Mono', monospace;
          font-size: 0.55rem; letter-spacing: 0.08em;
          color: rgba(255,255,255,.18);
          margin-top: 10px;
        }
      `}</style>

      <div className="exit-overlay" onClick={e => { if (e.target === e.currentTarget) close(); }}>
        <div className="exit-modal" role="dialog" aria-modal="true" aria-label="Special offer">
          <div className="exit-glow" />
          <div className="exit-glow2" />

          <div className="exit-top">
            🔥 Wait — you're about to miss this
          </div>

          <div className="exit-body">
            <button className="exit-close" onClick={close} aria-label="Close">✕</button>

            <div className="exit-badge">
              <span className="exit-live" />
              Founder Lifetime Offer
            </div>

            <h2 className="exit-title">
              {seatsLeft} seats left<br />
              <span className="exit-shimmer">at this price. Ever.</span>
            </h2>

            <p className="exit-sub">
              When these {seatsLeft} seats fill — the lifetime offer closes permanently.
              Price goes up after TikTok + video upgrades ship.
            </p>

            <div className="exit-seat-row">
              <span>{seatsTaken} claimed</span>
              <span>{seatsLeft} remaining</span>
            </div>
            <div className="exit-track">
              <div className="exit-fill" style={{ width: `${pct}%` }} />
            </div>

            <div className="exit-price-row">
              <div className="exit-price exit-shimmer">$149</div>
              <div>
                <div className="exit-orig">$348/yr value</div>
                <div className="exit-onetime">one-time · forever</div>
              </div>
            </div>

            <div className="exit-features">
              {[
                "Everything in Pro — forever",
                "All future upgrades included free",
                "TikTok + AI video scripts — next upgrade",
                "Image generation — next upgrade",
                "Priority support forever",
                "Pi Network payment accepted",
              ].map(f => (
                <div key={f} className="exit-feat">
                  <span className="exit-feat-check">✓</span>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <a
              href="https://dodo.pe/relh2gradr9"
              target="_blank"
              rel="noopener noreferrer"
              className="exit-btn-primary"
              onClick={close}
            >
              🔥 Claim Pro Lifetime — $149
            </a>

            <button className="exit-btn-ghost" onClick={close}>
              No thanks, I'll pay more later
            </button>

            <p className="exit-note">
              SECURE CHECKOUT VIA DODO PAYMENTS · PI NETWORK ACCEPTED
            </p>
          </div>
        </div>
      </div>
    </>
  );
}