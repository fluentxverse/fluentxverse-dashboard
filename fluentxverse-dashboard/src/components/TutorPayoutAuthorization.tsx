import { useEffect, useRef, useState } from "preact/hooks";
import { operations, operationError } from "../api/operations.api";
import { usdRateLabel } from "../api/compensation.api";
import { dateText, IconButton } from "./OperationsShared";
import "./TutorPayoutAuthorization.css";

interface Earning {
  bookingId: string;
  netCents: number;
  completionAt: string;
  status: string;
}
interface Reservation {
  batch: { id: string; totalCents: number; status: string; expiresAt: string };
  canCancel: boolean;
}
interface ProofStatus {
  authorization: null | { phase: string; expiresAt?: string; engineSubmissionId?: string };
  currentlyEligible: boolean;
}
interface Readiness {
  ready: boolean;
  reason?: string;
  submissionsEnabled?: boolean;
  releasePolicy?: string;
}
const phases: Record<string, string> = {
  proving: "Proving",
  review: "Review required",
  locally_proved: "Locally proved",
  submitting: "Submission outcome pending",
  submitted: "Submitted to zkVerify",
  native_finalized: "zkVerify finalized",
  receipt_verified: "Base receipt verified",
};

export function TutorPayoutAuthorization({ tutorId }: { tutorId: string }) {
  const [earnings, setEarnings] = useState<Earning[]>([]),
    [batches, setBatches] = useState<Reservation[]>([]),
    [details, setDetails] = useState<Record<string, ProofStatus>>({});
  const [ready, setReady] = useState<Readiness | null>(null),
    [selected, setSelected] = useState<string[]>([]);
  const [booking, setBooking] = useState(""),
    [approval, setApproval] = useState(""),
    [recipient, setRecipient] = useState(""),
    [reason, setReason] = useState("");
  const [cancel, setCancel] = useState(""),
    [cancelReason, setCancelReason] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const generation = useRef(0),
    working = useRef(false),
    reservationRequest = useRef<{ digest: string; id: string } | null>(null),
    cancelRequest = useRef("");
  const root = `/compensation/${encodeURIComponent(tutorId)}`;
  const payout = (id: string) => `${root}/payouts/${encodeURIComponent(id)}`;
  useEffect(() => {
    const v = ++generation.current;
    setSelected([]);
    setDetails({});
    setEarnings([]);
    setBatches([]);
    setReady(null);
    setBooking("");
    setApproval("");
    setRecipient("");
    setReason("");
    setCancel("");
    setError("");
    working.current = false;
    setBusy(false);
    reservationRequest.current = null;
    void load(v);
    return () => {
      generation.current++;
    };
  }, [tutorId]);
  async function load(v = generation.current) {
    setLoading(true);
    setError("");
    try {
      const e: Earning[] = await operations(root + "/earnings"),
        b: Reservation[] = await operations(root + "/payouts");
      const r: Readiness = await operations("/compensation/payout-authorization/readiness"),
        d: Record<string, ProofStatus> = {};
      for (const item of b) d[item.batch.id] = await operations(payout(item.batch.id) + "/authorization");
      if (v !== generation.current) return;
      setEarnings(e);
      setBatches(b);
      setDetails(d);
      setReady(r);
      setSelected((old) =>
        old.filter((id) => e.some((item) => item.bookingId === id && item.status === "unclaimed")),
      );
    } catch (e) {
      if (v === generation.current) {
        if ([401, 403, 404].includes((e as any)?.response?.status)) {
          setEarnings([]);
          setBatches([]);
          setDetails({});
          setSelected([]);
          setReady(null);
          setRecipient("");
          setReason("");
          setBooking("");
          setApproval("");
          setCancel("");
        }
        setError(operationError(e));
      }
    } finally {
      if (v === generation.current) setLoading(false);
    }
  }
  async function act(work: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    const v = generation.current;
    setBusy(true);
    setError("");
    try {
      await work();
      if (v === generation.current) await load(v);
    } catch (e) {
      if (v === generation.current) {
        await load(v);
        setError(operationError(e));
      }
    } finally {
      if (v === generation.current) {
        working.current = false;
        setBusy(false);
      }
    }
  }
  const disabled = loading || busy;
  return (
    <div className="payout-authorization">
      <header>
        <h3>Earnings & private authorization</h3>
        <IconButton icon="refresh" title="Reload earnings" disabled={disabled} onClick={() => void load()} />
      </header>
      <p className="payout-status" role="status">
        <span>{ready?.ready ? "Prover ready" : "Proving release not activated"}</span>
        <strong>Transfers disabled</strong>
      </p>
      {ready?.ready && (
        <p>{ready.releasePolicy === "self-operated" ? "Self-operated setup" : "Reviewed setup"}</p>
      )}
      {!ready?.ready && !loading && <p className="payout-muted">{ready?.reason}</p>}
      {error && (
        <p className="operations-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p role="status">Loading earnings...</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void act(async () => {
            await operations(root + "/earnings/" + encodeURIComponent(booking.trim()), "post", {
              reason: approval.trim(),
            });
          });
        }}
      >
        <fieldset disabled={disabled} className="payout-inputs">
          <legend>Approve completed lesson earnings</legend>
          <label>
            Booking ID
            <input
              required
              maxLength={128}
              value={booking}
              onInput={(e) => setBooking(e.currentTarget.value)}
            />
          </label>
          <label>
            Approval reason
            <input
              required
              maxLength={1000}
              value={approval}
              onInput={(e) => setApproval(e.currentTarget.value)}
            />
          </label>
          <button type="submit">
            <i className="ri-check-line" aria-hidden="true" />
            Approve earning
          </button>
        </fieldset>
      </form>
      <div className="operations-table-wrap">
        <table>
          <thead>
            <tr>
              <th aria-label="Select earning" />
              <th>Lesson</th>
              <th>Completed (PHT)</th>
              <th>USD earned</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {earnings.map((e) => (
              <tr key={e.bookingId}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${e.bookingId}`}
                    checked={selected.includes(e.bookingId)}
                    disabled={
                      disabled ||
                      e.status !== "unclaimed" ||
                      (selected.length === 4 && !selected.includes(e.bookingId))
                    }
                    onChange={(event) =>
                      setSelected((old) =>
                        event.currentTarget.checked
                          ? [...old, e.bookingId]
                          : old.filter((id) => id !== e.bookingId),
                      )
                    }
                  />
                </td>
                <td>{e.bookingId}</td>
                <td>{dateText(e.completionAt)}</td>
                <td>{usdRateLabel(e.netCents)}</td>
                <td>{e.status}</td>
              </tr>
            ))}
            {!earnings.length && (
              <tr>
                <td colSpan={5}>No approved earnings</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const input = {
              bookingIds: [...selected].sort(),
              recipient: recipient.trim(),
              reason: reason.trim(),
            },
            digest = JSON.stringify(input);
          if (reservationRequest.current?.digest !== digest)
            reservationRequest.current = { digest, id: crypto.randomUUID() };
          const requestId = reservationRequest.current!.id;
          void act(async () => {
            await operations(root + "/payouts", "post", { ...input, requestId });
          });
        }}
      >
        <fieldset disabled={disabled || !selected.length} className="payout-inputs">
          <legend>Reserve earnings ({selected.length} / 4)</legend>
          <label>
            Recipient wallet
            <input
              required
              maxLength={42}
              pattern="0x[a-fA-F0-9]{40}"
              value={recipient}
              onInput={(e) => setRecipient(e.currentTarget.value)}
              autoComplete="off"
            />
          </label>
          <label>
            Reservation reason
            <input
              required
              maxLength={1000}
              value={reason}
              onInput={(e) => setReason(e.currentTarget.value)}
            />
          </label>
          <button type="submit">
            <i className="ri-lock-line" aria-hidden="true" />
            Reserve{" "}
            {usdRateLabel(
              earnings.filter((e) => selected.includes(e.bookingId)).reduce((sum, e) => sum + e.netCents, 0),
            )}
          </button>
        </fieldset>
      </form>
      <h3>Authorization history</h3>
      <div className="operations-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Reservation</th>
              <th>USD</th>
              <th>Proof status</th>
              <th>Expires (PHT)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {batches.map(({ batch, canCancel }) => {
              const d = details[batch.id],
                a = d?.authorization,
                eligible = d?.currentlyEligible === true;
              return (
                <tr key={batch.id}>
                  <td>
                    {batch.id}
                    <small>{batch.status}</small>
                  </td>
                  <td>{usdRateLabel(batch.totalCents)}</td>
                  <td>
                    {a ? phases[a.phase] || "Review required" : "Not proved"}
                    {!eligible && <small>Not currently eligible</small>}
                  </td>
                  <td>{dateText(a?.expiresAt || batch.expiresAt)}</td>
                  <td>
                    <div className="payout-actions">
                      {!a && eligible && (
                        <button
                          type="button"
                          disabled={disabled || !ready?.ready}
                          onClick={() =>
                            void act(async () => {
                              await operations(payout(batch.id) + "/authorization", "post", {});
                            })
                          }
                        >
                          <i className="ri-shield-check-line" aria-hidden="true" />
                          Generate proof
                        </button>
                      )}
                      {a?.phase === "locally_proved" && eligible && ready?.submissionsEnabled && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            void act(async () => {
                              await operations(payout(batch.id) + "/authorization/submit", "post", {});
                            })
                          }
                        >
                          <i className="ri-upload-2-line" aria-hidden="true" />
                          Submit to zkVerify
                        </button>
                      )}
                      {a?.engineSubmissionId && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            void act(async () => {
                              await operations(payout(batch.id) + "/authorization/reconcile", "post", {});
                            })
                          }
                        >
                          <i className="ri-refresh-line" aria-hidden="true" />
                          Check receipt
                        </button>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setCancel(batch.id);
                            setCancelReason("");
                            cancelRequest.current = crypto.randomUUID();
                          }}
                        >
                          Cancel reservation
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!batches.length && (
              <tr>
                <td colSpan={5}>No payout reservations</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {cancel && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act(async () => {
              await operations(payout(cancel) + "/cancel", "post", {
                reason: cancelReason.trim(),
                requestId: cancelRequest.current,
              });
            });
          }}
        >
          <fieldset disabled={disabled} className="payout-inputs">
            <legend>Cancel reservation</legend>
            <label>
              Cancellation reason
              <input
                required
                maxLength={1000}
                value={cancelReason}
                onInput={(e) => setCancelReason(e.currentTarget.value)}
              />
            </label>
            <button type="button" onClick={() => setCancel("")}>
              Keep reservation
            </button>
            <button type="submit">Confirm cancellation</button>
          </fieldset>
        </form>
      )}
    </div>
  );
}
