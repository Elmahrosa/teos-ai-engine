"use client";

import { useState, useEffect } from "react";

export interface SeatsData {
  taken: number;
  total: number;
  left: number;
  pct: number;
  soldOut: boolean;
  loading: boolean;
}

const FALLBACK: SeatsData = {
  taken: 37,
  total: 50,
  left: 13,
  pct: 74,
  soldOut: false,
  loading: true,
};

export function useSeats(): SeatsData {
  const [data, setData] = useState<SeatsData>(FALLBACK);

  useEffect(() => {
    let cancelled = false;

    async function fetchSeats() {
      try {
        const res = await fetch("/api/seats", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) {
          setData({ ...json, loading: false });
        }
      } catch {
        if (!cancelled) {
          setData(prev => ({ ...prev, loading: false }));
        }
      }
    }

    fetchSeats();
    const interval = setInterval(fetchSeats, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return data;
}
