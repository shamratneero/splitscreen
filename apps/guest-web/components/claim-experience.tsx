"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateSplit } from "@addasplit/split-engine";
import { QuantityStepper } from "./quantity-stepper";
import { getSessionId } from "@/lib/guest-session";
import {
  confirmGuestDetails,
  fetchPublicSplit,
  reportGuestPayment,
  setClaim,
  type PublicSplit,
} from "@/lib/split-repository";

type Stage = "claim" | "confirm" | "pay" | "done";
/**
 * Grouped by hand for the same reason as the date: prices render on the server
 * and again in the guest's browser, and toLocaleString("en-BD") is not
 * guaranteed to group identically in both (lakh vs thousand separators), which
 * fails hydration.
 */
const taka = (value: number) => {
  const sign = value < 0 ? "-" : "";
  const digits = String(Math.abs(Math.round(value)));
  return `${sign}৳${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "2026-09-07" reads as a database field; guests should see "7 Sep".
 *
 * Formatted by hand rather than with toLocaleDateString: this renders on the
 * server and again on the guest's phone, and the two ICU implementations
 * disagree ("Sep" vs "Sept"), which fails hydration. Parsed off the string so
 * the host's timezone can't shift the day either.
 */
const formatSplitDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, , month, day] = match;
  const name = MONTHS[Number(month) - 1];
  return name ? `${Number(day)} ${name}` : value;
};

export function ClaimExperience({ token, initialSplit }: { token: string; initialSplit: PublicSplit }) {
  const [split, setSplit] = useState<PublicSplit>(initialSplit);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("claim");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  /**
   * Copy with visible confirmation — a silent copy leaves people unsure it
   * worked. navigator.clipboard is secure-context only, so it is missing for
   * guests on a plain-HTTP LAN address; fall back to the legacy execCommand
   * path rather than leaving them unable to copy the payment number.
   */
  const copyValue = async (value: string, message: string) => {
    const legacyCopy = () => {
      const field = document.createElement("textarea");
      field.value = value;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      field.setSelectionRange(0, value.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(field);
      return ok;
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (!legacyCopy()) {
        throw new Error("copy rejected");
      }
      setCopied(message);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied("Couldn’t copy — press and hold the number to select it.");
      setTimeout(() => setCopied(null), 3000);
    }
  };

  // Identify this browser, then re-read the split so our own claims come back.
  useEffect(() => {
    const id = getSessionId(token);
    setSessionId(id);
    fetchPublicSplit(token, id)
      .then((fresh) => fresh && setSplit(fresh))
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [token]);

  const reload = useCallback(async () => {
    const fresh = await fetchPublicSplit(token, sessionId);
    if (fresh) setSplit(fresh);
  }, [token, sessionId]);

  /**
   * Once the guest is waiting on the host, nothing they do will refresh the
   * page — so poll until the host confirms. Also keeps availability honest
   * while people are still claiming.
   */
  useEffect(() => {
    if (!sessionId) return;
    if (split.myPaymentStatus === "CONFIRMED") return;
    const timer = setInterval(() => {
      reload().catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [sessionId, split.myPaymentStatus, reload]);

  const myGuestId = split.myGuestId;

  /** How many of each item this guest currently holds, straight from the server. */
  const myQuantities = useMemo(() => {
    const mine: Record<string, number> = {};
    if (!myGuestId) return mine;
    for (const claim of split.claims) {
      if (claim.guestId === myGuestId) mine[claim.itemId] = (mine[claim.itemId] ?? 0) + claim.quantity;
    }
    return mine;
  }, [split.claims, myGuestId]);

  /** Units still unclaimed by anyone else — this guest's own claims stay available to them. */
  const availability = useMemo(() => {
    const claimedByOthers: Record<string, number> = {};
    for (const claim of split.claims) {
      if (claim.guestId === myGuestId) continue;
      claimedByOthers[claim.itemId] = (claimedByOthers[claim.itemId] ?? 0) + claim.quantity;
    }
    return Object.fromEntries(
      split.items.map((item) => [item.id, item.quantity - (claimedByOthers[item.id] ?? 0)]),
    ) as Record<string, number>;
  }, [split.items, split.claims, myGuestId]);

  /**
   * The authoritative amount, from the same engine the host uses — VAT, service
   * charge and discount are prorated across every guest, not estimated locally.
   */
  const myTotals = useMemo(() => {
    if (!myGuestId) return { itemSubtotal: 0, vat: 0, serviceCharge: 0, discount: 0, total: 0 };
    try {
      const result = calculateSplit({
        items: split.items,
        claims: split.claims,
        guests: split.guests.map((guest) => ({ id: guest.id, displayName: guest.displayName ?? "" })),
        vat: split.split.vat,
        serviceCharge: split.split.serviceCharge,
        discount: split.split.discount,
        receiptTotal: split.split.receiptTotal,
      });
      const mine = result.guests.find((guest) => guest.id === myGuestId);
      return mine ?? { itemSubtotal: 0, vat: 0, serviceCharge: 0, discount: 0, total: 0 };
    } catch {
      return { itemSubtotal: 0, vat: 0, serviceCharge: 0, discount: 0, total: 0 };
    }
  }, [split, myGuestId]);

  const itemCount = Object.values(myQuantities).reduce((sum, value) => sum + value, 0);

  const update = async (itemId: string, quantity: number) => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      await setClaim(token, sessionId, itemId, quantity);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      await reload().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const submitName = async () => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      await confirmGuestDetails(token, sessionId, name.trim());
      await reload();
      setStage("pay");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const submitPayment = async (method: string) => {
    if (!sessionId) return;
    setBusy(true);
    setError(null);
    try {
      await reportGuestPayment(token, sessionId, method);
      await reload();
      setStage("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const banner = error ? <p className="quiet error">{error}</p> : null;
  const hostName = split.split.hostDisplayName?.trim() || "your host";

  if (stage === "confirm")
    return (
      <section className="screen">
        <header className="split-header">
          <p className="eyebrow">AddaSplit</p>
          <h1>Almost done</h1>
          <p>Tell your friends whose items these are.</p>
        </header>
        <label className="field">
          <span>Your name</span>
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Tanvir" />
        </label>
        <div className="summary">
          <span>You’ll pay</span>
          <strong>{taka(myTotals.total)}</strong>
          <dl>
            <div><dt>Items</dt><dd>{taka(myTotals.itemSubtotal)}</dd></div>
            <div><dt>VAT</dt><dd>{taka(myTotals.vat)}</dd></div>
            <div><dt>Service charge</dt><dd>{taka(myTotals.serviceCharge)}</dd></div>
            {myTotals.discount > 0 ? <div><dt>Discount</dt><dd>−{taka(myTotals.discount)}</dd></div> : null}
          </dl>
        </div>
        {banner}
        <footer className="bottom-bar">
          <button className="button" disabled={!name.trim() || itemCount === 0 || busy} onClick={submitName}>
            {busy ? "Saving…" : `Confirm ${taka(myTotals.total)}`}
          </button>
        </footer>
      </section>
    );

  if (stage === "pay")
    return (
      <section className="screen">
        <header className="split-header pay-header">
          <div className="success-mark small">✓</div>
          <h1>Thanks, {name.trim() || "friend"}!</h1>
          <p>Here’s how to pay.</p>
        </header>

        <div className="send-card">
          <span className="send-label">Send</span>
          <strong className="pay-amount">{taka(myTotals.total)}</strong>
          <span className="send-label">to {hostName}</span>
          <button className="text-button" onClick={() => copyValue(String(myTotals.total), "Amount copied")}>
            Copy amount
          </button>
        </div>

        {(
          [
            { key: "bkash", label: "bKash", number: split.split.hostBkash },
            { key: "nagad", label: "Nagad", number: split.split.hostNagad },
          ] as const
        )
          .filter((method) => method.number)
          .map((method) => (
            <div className={`payment-method ${method.key}`} key={method.key}>
              <b>{method.label}</b>
              <span className="number">{method.number}</span>
              <button className="text-button" onClick={() => copyValue(method.number!, `${method.label} number copied`)}>
                Copy
              </button>
            </div>
          ))}

        {!split.split.hostBkash && !split.split.hostNagad ? (
          <p className="quiet">{hostName} hasn’t added a payment number yet — ask them directly.</p>
        ) : null}

        <p className="quiet">
          Open your bKash or Nagad app and send the money, then tap below. {hostName} will confirm once it arrives.
        </p>
        {copied ? <p className="quiet copied">{copied}</p> : null}
        {banner}
        <footer className="bottom-bar">
          <button className="button" disabled={busy} onClick={() => submitPayment(split.split.hostBkash ? "bkash" : "nagad")}>
            {busy ? "Reporting…" : "I’ve sent it"}
          </button>
        </footer>
      </section>
    );

  if (stage === "done") {
    const confirmed = split.myPaymentStatus === "CONFIRMED";
    return (
      <section className="screen success">
        <div className={`success-mark${confirmed ? " confirmed" : ""}`}>✓</div>
        <p className="eyebrow">{confirmed ? "Payment confirmed" : "Payment reported"}</p>
        <h1>{confirmed ? "All settled" : "You’re all set"}</h1>
        <p>
          You claimed {itemCount} {itemCount === 1 ? "item" : "items"} as {name || "a guest"}.
        </p>
        <div className="summary">
          <span>Total</span>
          <strong>{taka(myTotals.total)}</strong>
          {confirmed ? (
            <p className="quiet settled">{hostName} confirmed they received your money.</p>
          ) : (
            <p className="quiet">Waiting for {hostName} to confirm — this updates on its own.</p>
          )}
        </div>
        <button className="secondary-button" onClick={() => setStage("claim")}>View full split</button>
      </section>
    );
  }

  return (
    <section className="screen">
      <header className="split-header">
        <p className="eyebrow">{split.split.restaurantName}</p>
        <h1>{formatSplitDate(split.split.splitDate)}</h1>
        <p>Tap what you had.</p>
      </header>
      <div className="items">
        {split.items.map((item) => (
          <article className="claim-row" key={item.id}>
            <div>
              <h2>{item.name}</h2>
              <p>{taka(item.unitPrice)} · {availability[item.id] ?? 0} available</p>
            </div>
            <QuantityStepper
              label={item.name}
              value={myQuantities[item.id] ?? 0}
              maximum={availability[item.id] ?? 0}
              // Taps before the session exists would be dropped silently.
              disabled={!sessionId || busy}
              onChange={(value) => update(item.id, value)}
            />
          </article>
        ))}
      </div>
      {banner}
      <footer className="bottom-bar">
        <div>
          <span>Your share</span>
          <strong>{taka(myTotals.total)}</strong>
        </div>
        <button className="button compact" disabled={itemCount === 0 || busy} onClick={() => setStage("confirm")}>
          Continue
        </button>
      </footer>
    </section>
  );
}
