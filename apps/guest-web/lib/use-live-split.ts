"use client";

import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

/**
 * Calls `onChange` when anything about this split moves — someone claims an
 * item, gives their name, or the host confirms a payment.
 *
 * Guests hold no table grants, so they cannot be told *what* changed; the
 * subscription carries only the fact that something did, and the caller
 * re-reads through the security-definer RPC. That keeps realtime from becoming
 * a way around RLS.
 *
 * Polling stays as a fallback. Realtime over a flaky mobile connection drops
 * silently, and a guest staring at a stale bill is worse than a wasted request,
 * so the poll runs slowly while the socket is healthy and quickly when it isn't.
 */
export function useLiveSplit(splitId: string | null, onChange: () => void, enabled = true) {
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    if (!splitId || !enabled) return;

    let live = false;
    const fire = () => latest.current();

    const channel = supabase
      .channel(`split:${splitId}`)
      // claims and guests carry split_id directly; payments reach it only
      // through guests, so it is filtered client-side by re-reading.
      .on("postgres_changes", { event: "*", schema: "public", table: "claims" }, fire)
      .on("postgres_changes", { event: "*", schema: "public", table: "guests", filter: `split_id=eq.${splitId}` }, fire)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, fire)
      .subscribe((status) => {
        live = status === "SUBSCRIBED";
      });

    // One timer, two cadences: every 5s while the socket is down, every 30s
    // once it is up. A healthy connection should not still be polling hard.
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      if (!live || ticks % 6 === 0) fire();
    }, 5000);

    return () => {
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [splitId, enabled]);
}
