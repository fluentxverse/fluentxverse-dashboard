import { useEffect, useState } from "preact/hooks";
import { apiClient } from "../api/apiClient";
import "../../../shared/ui/lesson-issue-threads.css";
const names: Record<string, string> = {
	queued: "Lesson ongoing",
	staff_initial: "Initial behavior review",
	awaiting_tutor: "Awaiting tutor",
	pending_ta301: "TA-301 scheduled",
	awaiting_admin: "Staff review",
	ta301: "TA-301",
	no_penalty: "No penalty",
	past: "PAST",
	cancelled: "Cancelled",
};
export default function StudentDisputes() {
	const [cases, setCases] = useState<any[]>([]),
		[error, setError] = useState(""),
		[busy, setBusy] = useState(false),
		[revision, setRevision] = useState(0),
		[filter, setFilter] = useState("open");
	const path = (id = "") => "/inbox/disputes/" + id;
	useEffect(() => {
		const c = new AbortController();
		const load = async () => {
			try {
				const r = await apiClient.get(path() + "?as=admin", {
					signal: c.signal,
				});
				if (!c.signal.aborted) {
					setCases(r.data.data);
					setError("");
				}
			} catch {
				if (!c.signal.aborted) setError("Could not load lesson cases.");
			}
		};
		void load();
		const timer = setInterval(() => void load(), 30000);
		return () => {
			c.abort();
			clearInterval(timer);
		};
	}, [revision]);
	const mutate = async (id: string, action: string, payload: any) => {
		if (busy) return;
		setBusy(true);
		try {
			await apiClient.post(path(id) + "/" + action + "?as=admin", payload);
			setRevision((v) => v + 1);
		} catch (e: any) {
			setError(
				e.response?.data?.error || "Could not save. Refresh before retrying.",
			);
		} finally {
			setBusy(false);
		}
	};
	const date = (v: string) =>
		new Date(v).toLocaleString("en-US", {
			timeZone: "Asia/Manila",
			dateStyle: "medium",
			timeStyle: "short",
		}) + " PHT";
	const closed = (c: any) =>
		["ta301", "no_penalty", "past", "cancelled"].includes(c.state);
	const visible = cases.filter(
		(c) => filter === "all" || (filter === "open" ? !closed(c) : closed(c)),
	);
	return (
		<section
			className="lesson-issue-threads"
			aria-label="Student dispute review"
		>
			<header>
				<h2>Student lesson cases</h2>
				<button disabled={busy} onClick={() => setRevision((v) => v + 1)}>
					<i className="ri-refresh-line" />
					Refresh
				</button>
			</header>
			<nav className="dispute-filters" aria-label="Case status">
				{["open", "closed", "all"].map((v) => (
					<button
						type="button"
						aria-pressed={filter === v}
						onClick={() => setFilter(v)}
					>
						{v === "open" ? "Open" : v === "closed" ? "Resolved" : "All"}
					</button>
				))}
			</nav>
			{error && <p role="alert">{error}</p>}
			{!visible.length && <p>No cases in this view.</p>}
			{visible.map((c) => (
				<details key={c.id}>
					<summary>
						{date(c.startsAt)} · {names[c.state] || c.state}
					</summary>
					<p>
						Lesson {c.bookingId} · Tutor {c.tutorId}
					</p>
					<a href={"/lesson-operations/" + encodeURIComponent(c.bookingId)}>
						Open classroom records
					</a>
					<h3>Student report</h3>
					<p className="issue-thread-body">{c.body}</p>
					{c.deadline && <p>Response deadline: {date(c.deadline)}</p>}
					{c.refundStatus && <p>Refund: {c.refundStatus}</p>}
					{c.nonresponse && (
						<p className="issue-thread-warning">
							TA-301 — No tutor reply within 24 hours
						</p>
					)}
					{c.decisionReason && (
						<p className="issue-thread-body">
							<strong>Decision</strong>
							<br />
							{c.decisionReason}
						</p>
					)}
					{c.replies.map((r: any) => (
						<div className="issue-thread-reply" key={r.id}>
							<strong>
								{r.role === "tutor"
									? "Tutor explanation (private)"
									: r.role === "student"
										? "Student follow-up"
										: "Staff to student"}
							</strong>
							<time> {date(r.createdAt)}</time>
							{(r.duration || r.reason) && (
								<p>
									Teaching time:{" "}
									{r.duration === "up_to_ten"
										? "10 minutes or less"
										: r.duration === "over_ten"
											? "More than 10 minutes"
											: "Not specified"}{" "}
									· Reason: {r.reason || "Not specified"}
								</p>
							)}
							<p className="issue-thread-body">{r.body}</p>
							<div className="issue-thread-images">
								{r.attachments?.map((a: any) => {
									const url =
										(apiClient.defaults.baseURL || "").replace(/\/$/, "") +
										path(c.id) +
										"/images/" +
										a.id +
										"?as=admin";
									return (
										<a href={url} target="_blank" rel="noopener noreferrer">
											<img
												src={url}
												alt="Private tutor evidence"
												loading="lazy"
											/>
										</a>
									);
								})}
							</div>
						</div>
					))}
					{c.state === "staff_initial" && (
						<form
							onSubmit={(e) => {
								e.preventDefault();
								const f = new FormData(e.currentTarget);
								void mutate(c.id, "request", { text: String(f.get("text")) });
							}}
						>
							<h3>Request tutor explanation</h3>
							<label>
								Message to tutor
								<textarea name="text" required maxLength={2000} />
							</label>
							<button disabled={busy}>
								<i className="ri-send-plane-line" />
								Send request (24-hour deadline)
							</button>
						</form>
					)}
					{["awaiting_tutor", "pending_ta301"].includes(c.state) && (
						<form
							onSubmit={(e) => {
								e.preventDefault();
								const f = new FormData(e.currentTarget);
								void mutate(c.id, "extend", {
									deadline: new Date(String(f.get("deadline"))).toISOString(),
									reason: String(f.get("reason")),
								});
							}}
						>
							<h3>Extend deadline</h3>
							<label>
								New deadline (your local time)
								<input type="datetime-local" name="deadline" required />
							</label>
							<label>
								Outage / extension reason
								<textarea name="reason" required maxLength={2000} />
							</label>
							<button disabled={busy}>
								<i className="ri-time-line" />
								Save extension
							</button>
						</form>
					)}
					<form
						className="issue-thread-decision"
						onSubmit={(e) => {
							e.preventDefault();
							const f = new FormData(e.currentTarget);
							if (!confirm("Apply this lesson decision and any refund?"))
								return;
							void mutate(c.id, "decision", {
								decision: String(f.get("decision")),
								reason: String(f.get("reason")),
								refund: f.get("refund") === "on",
								sys501: f.get("sys501") === "on",
								revision: c.decisionRevision,
							});
						}}
					>
						<h3>Staff decision</h3>
						<label>
							Outcome
							<select name="decision" aria-label="Outcome" required>
								<option value="">Select outcome</option>
								<option value="ta301">TA-301 (ticket refunded)</option>
								<option value="no_penalty">No penalty (tutor earns)</option>
								<option value="past">Delete slot (PAST)</option>
							</select>
						</label>
						<label>
							<input type="checkbox" name="refund" /> Refund student ticket
							without requiring TA-301
						</label>
						<label>
							<input type="checkbox" name="sys501" /> Record SYS-501
							compensation (choose No penalty)
						</label>
						<label>
							Decision explanation (sent to both parties)
							<textarea name="reason" required maxLength={2000} />
						</label>
						<button disabled={busy} aria-label="Apply decision">
							<i className="ri-check-line" aria-hidden="true" />
							Apply decision
						</button>
					</form>
					{c.studentDecision && (
						<form
							onSubmit={(e) => {
								e.preventDefault();
								const f = new FormData(e.currentTarget);
								void mutate(c.id, "followup", { text: String(f.get("text")) });
							}}
						>
							<label>
								Private message to student
								<textarea name="text" required maxLength={10000} />
							</label>
							<button disabled={busy}>
								<i className="ri-send-plane-line" />
								Send to student
							</button>
						</form>
					)}
				</details>
			))}
		</section>
	);
}
