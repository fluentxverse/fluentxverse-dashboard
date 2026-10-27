import type { AdminArtName } from '../components/AdminArt';

export type GuideTopic = 'Business' | 'Operations' | 'Technology' | 'Privacy';
export type GuideBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'steps'; items: string[] }
  | { kind: 'note'; title: string; text: string }
  | { kind: 'table'; headings: string[]; rows: string[][] };
export type GuideChapter = { id: string; title: string; summary: string; topic: GuideTopic; art: AdminArtName; blocks: GuideBlock[] };
const p = (text: string): GuideBlock => ({ kind: 'paragraph', text });
const h = (text: string): GuideBlock => ({ kind: 'heading', text });
const list = (...items: string[]): GuideBlock => ({ kind: 'list', items });
const steps = (...items: string[]): GuideBlock => ({ kind: 'steps', items });
const note = (title: string, text: string): GuideBlock => ({ kind: 'note', title, text });
const table = (headings: string[], rows: string[][]): GuideBlock => ({ kind: 'table', headings, rows });

export const guideReviewedOn = '2026-10-13';
export const guideChapters: GuideChapter[] = [
  { id: 'business-model', title: 'The business in plain English', topic: 'Business', art: 'community',
    summary: 'A human-led English learning service, supported by software and carefully scoped verification.', blocks: [
      p('FluentXVerse connects students who want to improve their English with tutors who deliver live, one-to-one lessons. The central product is the learning experience: a suitable tutor, a reliable appointment, useful material, practice, and feedback. Technology supports that experience; it is not a substitute for a good teacher.'),
      p('The business brings together two groups. Students need convenient access to lessons they can trust. Tutors need suitable students, clear availability rules, teaching resources, and understandable working arrangements. The platform coordinates the relationship and handles the operational work around each lesson.'),
      h('What creates value'),
      list('For students: tutor discovery, convenient scheduling, structured practice, and a record of lessons and feedback.', 'For tutors: a place to publish availability, manage lessons, use shared materials, and understand performance expectations.', 'For the business: consistent service delivery, repeat learning relationships, reviewable records, and a way to investigate problems.'),
      p('The existing business positioning focuses on Filipino English tutors and learners in markets such as Japan, Korea, and Vietnam. These are intended audiences, not a claim that we have measured market share or established operations in every country.'),
      note('The commercial promise', 'Sell the quality and reliability of the lesson. Do not promise guaranteed fluency, accreditation, investment returns, automatic earnings, or universal recognition of a digital credential. A technical feature is not evidence of those outcomes.'),
    ] },
  { id: 'apps-and-people', title: 'The apps and the people behind them', topic: 'Operations', art: 'home',
    summary: 'Each workspace has a different job and a different level of authority.', blocks: [
      table(['Workspace', 'Who uses it', 'Its responsibility'], [
        ['Public website', 'Visitors and prospective customers', 'Explain the service, introduce the company, and provide application or contact routes.'],
        ['Student app', 'Learners', 'Browse tutors, sign in, book lessons, enter the classroom, use materials, and review lesson information.'],
        ['Tutor app', 'Applicants and working tutors', 'Complete onboarding, manage availability, deliver lessons, submit notes, and inspect performance.'],
        ['Admin dashboard', 'Authorized staff', 'Review applications, manage lessons and issues, maintain materials, inspect evidence, and perform permitted account or finance actions.'],
        ['GMR Engine', 'Authorized technical and finance operators', 'Manage project wallets, approved blockchain actions, proof submissions, and their execution records.'],
      ]),
      p('A student account is not a tutor account, and neither is an administrator account. The server checks the signed-in person and their permission for each protected action. A hidden button alone is not a security control.'),
      p('The admin dashboard is the business control room. The Engine is the technical execution room. Staff should decide whether an action is justified using business records before an authorized operator performs a financial or blockchain operation. An Engine success message cannot replace the underlying approval.'),
      p('In the Engine, FluentXVerse is presented as one project with separate feature modules. Private Lesson Passes, Anonymous Reviews, and Review Tallies retain their own permissions and proof rules. Grouping them in the menu does not merge their wallets, keys, or authorizations.'),
    ] },
  { id: 'student-journey', title: 'A student journey, from discovery to follow-up', topic: 'Operations', art: 'training',
    summary: 'What happens before, during, and after a lesson.', blocks: [
      steps('Discover: a visitor can browse tutor profiles and available schedules. An attempt to make a booking requires sign-in or registration.', 'Choose: the student selects a tutor and a suitable open slot. The displayed timezone matters; the same lesson must represent the same actual moment in both apps.', 'Reserve and confirm: the server checks availability, overlapping bookings, tutor eligibility, booking restrictions, and the applicable trial or paid-access rule. A temporary hold is not yet a confirmed lesson.', 'Prepare: the lesson page provides the appointment, tutor information, classroom access, and relevant lesson actions. Device preparation does not mean the classroom is already open.', 'Learn: the assigned student and tutor meet within the authorized lesson window, using live media, chat, and teaching materials.', 'Follow up: attendance and lesson outcome are recorded. Tutors provide lesson notes where required, and eligible students can provide feedback.'),
      p('A standard lesson is 25 minutes, scheduled within a 30-minute calendar slot. The remaining time helps separate appointments. The classroom allows a bounded three-minute wrap-up, but that is not a change to the advertised lesson duration.'),
      p('Completion, attendance, notes, feedback, and payment are separate records. A student can complete a lesson without submitting optional feedback. A submitted issue does not automatically cancel a lesson or prove that the tutor was at fault.'),
      note('An ordinary example', 'A student books an 18:00 Philippine-time lesson. A student in Japan sees the corresponding 19:00 Japan-time appointment. Both should reach the same booking, not two independent schedules.'),
    ] },
  { id: 'tutor-onboarding', title: 'How tutors qualify and begin teaching', topic: 'Operations', art: 'community',
    summary: 'Assessment, human approval, and technical credentials serve different purposes.', blocks: [
      p('Tutor onboarding combines an application and profile, a written assessment, a speaking assessment, and a human interview or approval process. Administrators review the evidence and the applicant status rather than treating registration alone as permission to teach.'),
      p('Written assessments use stored questions and answers. Speaking submissions are transcribed and assessed using the transcript. Interview results and profile approvals are human decisions. Each stage should retain who made the decision, when it was made, and which attempt it concerns.'),
      p('The private screening design checks approved, signed results against a defined policy. The documented pilot thresholds are at least 90 for written and 85 for speaking, plus the required profile and interview approvals. Those thresholds belong to a specific screening policy; changing them requires a new reviewed policy, not an unexplained change to a badge.'),
      h('Three separate meanings'),
      list('Qualified to teach: the application has met the platform requirements and is allowed to offer lessons.', 'Proof generated or submitted: the technical process has produced or sent evidence. It may still be waiting for verification or destination confirmation.', 'Credential verified: the evidence satisfies the approved verification process, including the required destination receipt, validity period, and revocation checks.'),
      note('What screening cannot prove', 'It does not establish that the AI graded correctly, that the applicant personally answered every question, that speech was live, or that a qualification is accepted by a school or regulator. The issuer remains accountable for the assessment and its approvals.'),
    ] },
  { id: 'scheduling', title: 'Availability, booking, and classroom timing', topic: 'Operations', art: 'schedule',
    summary: 'The calendar is a controlled promise of availability, not just a set of colored cells.', blocks: [
      p('Tutors publish 30-minute slots. An unpublished slot is not an offer to students. A published slot can be open, temporarily held, booked, closed, or already past. Tutors normally open a slot at least 11 minutes before its start.'),
      p('Availability confirmation is separate from actually entering a booked lesson. The normal confirmation window runs from 35 to 11 minutes before the first selected slot. Consecutive slots can be confirmed together within the supported grouping rules; a confirmed earlier neighbor can affect which later slots belong to that group.'),
      table(['Moment', 'What the rule means'], [
        ['11 minutes before start', 'An unconfirmed open slot stops being bookable. Missing confirmation on an unbooked slot can create a TA-302 event.'],
        ['5 minutes before start', 'A tutor-confirmed slot reaches its final booking cutoff. Student cancellation is already closed at this boundary.'],
        ['Up to 5 minutes early', 'Assigned participants may enter the classroom to prepare. Lesson communication is authorized from the scheduled start.'],
        ['Scheduled end', 'The lesson is due to finish. Participants can use the short wrap-up if they need it.'],
        ['3 minutes after end', 'The classroom authorization window closes. Provider cleanup can require retrying if an external service is unavailable.'],
      ]),
      p('A temporary checkout hold lasts up to seven minutes, bounded by the lesson start. The final booking must still pass server checks. Two users clicking the same slot does not authorize two bookings; the server serializes the claim and rejects conflicts.'),
      note('Do not use your laptop clock as the authority', 'The server controls deadlines. Timezones are display choices, and browser clocks can be wrong. Investigate the stored booking time and server evidence when a customer reports a timing problem.'),
    ] },
  { id: 'attendance-and-issues', title: 'Attendance, cancellations, and issue reports', topic: 'Operations', art: 'schedule',
    summary: 'Record what happened before deciding what it means.', blocks: [
      p('Students can cancel a confirmed lesson only before the five-minute pre-start deadline. Operations staff have a separate, audited support cancellation route before the actual start. Rescheduling must find a valid open slot with the same tutor and must not create an overlap; it also closes before the source lesson reaches its last five minutes.'),
      p('A cancellation or reschedule revokes the old classroom authorization. Someone who entered early should not keep using that room after the booking is cancelled. Chat and call access must also reflect the current booking, not just a timer that reached the start time.'),
      p('For a booked lesson, confirming availability in the schedule is not enough to establish attendance. The attendance process uses classroom-entry evidence within the scheduled lesson. Automatic no-show classification is made after the lesson rather than treating a late arrival as a final absence immediately.'),
      list('TA-301 describes booked tutor absence, including a declared absence or no qualifying classroom entry during the scheduled lesson.', 'TA-302 describes an unbooked open slot without the required availability confirmation.', 'TA-303 describes a short-notice withdrawal of an unbooked opening. The current rule distinguishes withdrawals at least 48 hours ahead and limits reopening after a short-notice event.'),
      p('Students and tutors can report lesson problems such as lateness, connection trouble, or other service concerns through the eligible lesson report flow. Reporting availability is time- and booking-dependent. Reports enter a review queue with assignment, priority, private staff updates, and a reporter-visible resolution.'),
      note('Evidence is not a verdict', 'Room entry, browser-reported media connection, a complaint, and a QA recording are different evidence sources. None alone proves teaching quality. Manual corrections require a reason; revoking a penalty preserves its history rather than deleting the event.'),
    ] },
  { id: 'commercial-access', title: 'Trial lessons, paid access, and revenue', topic: 'Business', art: 'pay',
    summary: 'The platform supports different access modes; they must not be confused with one another.', blocks: [
      p('The commercial model is access to teaching, not speculation on a token. Paid packages or lesson credits, when enabled, connect a disclosed purchase to a defined teaching entitlement. The platform must explain the lesson access, price, conditions, and refund handling before taking payment.'),
      p('The October 13 source configuration defaults to trial booking and hides ticket purchasing. That source change is not proof of what every running deployment has enabled. Operators must check the deployed booking mode before promising a free trial or selling a paid package.'),
      table(['Mode', 'How lesson access works', 'Important boundary'], [
        ['Trial', 'The authenticated account receives a limited allowance; the source default is one trial lesson.', 'No wallet, ticket transfer, or private pass is required to make an eligible trial booking.'],
        ['Historical ticket flow', 'Basic or Premium ticket holdings and applicable booking rules represent paid lesson access.', 'Keep existing balances and finance history. Do not silently convert or erase previous purchases.'],
        ['Private lesson passes', 'A proof-backed, single-use entitlement can authorize an eligible paid booking.', 'Intake is gated and remains parked in trial mode; implemented code is not a completed paid launch.'],
      ]),
      p('An early trial cancellation at least one hour before the stored start can restore the trial allowance. A later student cancellation does not. Support cancellations have their own restoration handling. This is separate from the five-minute deadline for whether a student may cancel at all.'),
      p('A completed or no-show trial consumes the allowance. Account creation alone is not proof of a unique human, so multiple-account abuse remains an operational risk. A trial does not automatically create paid revenue, a token refund, or a payable tutor earning.'),
      h('The business costs behind a lesson'),
      list('Tutor compensation and the staff time needed for recruiting, support, and quality review.', 'Live-call infrastructure, storage, AI requests, payment processing, and any applicable proof or blockchain fees.', 'Acquisition, refunds, promotions, unfilled tutor availability, and the cost of maintaining reliable systems.'),
      note('Pricing and margin discipline', 'Do not quote a fixed tutor share, package price, profit margin, or payout schedule from this guide. Those must come from the approved commercial agreement and current finance records. Selling credits, consuming credits, earning revenue, and paying a tutor are separate events.'),
    ] },
  { id: 'finance-and-compensation', title: 'Tutor compensation and financial controls', topic: 'Business', art: 'pay',
    summary: 'A rate setting is not an earnings ledger, and an earnings ledger is not a completed payout.', blocks: [
      p('Finance-authorized administrators can set an individual tutor base rate in USD. The amount is stored precisely in cents, with the previous amount, administrator, date, reason, and version. An unset rate is different from a zero rate.'),
      p('Changes are protected against two administrators overwriting each other. A stale save is rejected and must be reviewed against the current version. A repeated request with the same identifier returns the original change rather than creating a second financial event.'),
      p('The current compensation milestone manages rates and their history. It does not calculate completed-lesson earnings, lock a rate at booking time, transfer pay, or prove a payout with zero-knowledge technology. Do not multiply old lessons by the latest rate and call that a historical earned amount.'),
      steps('Agree the commercial terms and define which lesson outcomes are payable.', 'Create an approved lesson-level earnings record using the appropriate rate version and a clear dispute or refund rule.', 'Review and authorize the payout batch, including adjustments and the destination.', 'Execute the approved transfer and reconcile its actual outcome before marking the payout complete.'),
      p('The later steps describe the required direction of an earnings and payout system, not a claim that an automatic payroll feature is already running. A custodial project wallet also does not prove that the tutor alone controls a payment entitlement.'),
      note('Avoid paying twice', 'If a refund or transfer result is uncertain, retain its original operation identifier and inspect the transaction history. Sending a new transaction to fix a missing success screen can create a duplicate payment. Existing payout-pool templates are not an approved, audited private payroll service and should not be funded on that assumption.'),
    ] },
  { id: 'materials-and-ai', title: 'Learning materials and the role of AI', topic: 'Technology', art: 'training',
    summary: 'The tutor leads the lesson; content tools and AI support preparation and feedback.', blocks: [
      p('The material system organizes lessons into courses, levels, chapters, and individual lesson pages. Tracks include conversation-focused practice, Business English, Young Learners, discussion questions, and Daily Dispatch. A course name in an editor does not mean every possible lesson is published or available to students.'),
      p('Administrators create and review material, while tutors use the teaching view and students see the learning view. These may contain different information: tutor guidance, answer keys, and internal notes should not appear in a student preview simply because they belong to the same lesson.'),
      p('AI tools assist with structured content drafts, grammar corrections, vocabulary explanations, and pronunciation guidance. Speaking-assessment services transcribe submitted audio and then grade the transcript. A pronunciation suggestion or a transcript score is not an independently validated measurement of the original voice or delivery.'),
      list('Human review checks level, usefulness, factual accuracy, cultural suitability, and whether the lesson actually fits its learning objective.', 'Assessments should follow a defined rubric. Preserve the attempt and its approval evidence rather than replacing it with a cached pass label.', 'Only send information needed for the task to a provider. A classroom recording and a content-writing prompt are different processing activities.'),
      p('The business benefit is more consistent preparation and a reusable curriculum. It is not a guaranteed reduction in costs or a proven learning gain until the business measures those outcomes. Learners still need meaningful conversation, correction, and a tutor who adapts to their level.'),
      note('AI is assistance, not an authority', 'Models can produce plausible mistakes. A zero-knowledge proof about a signed assessment does not prove that an AI model ran correctly or that its educational judgment was accurate. The current implementation does not establish zkML or independently verified AI execution.'),
    ] },
  { id: 'service-architecture', title: 'How the technology fits together', topic: 'Technology', art: 'home',
    summary: 'Think of a reception desk, an operations office, a meeting service, and a secure execution service.', blocks: [
      p('The browser apps are the reception desks: they present information and collect actions. The application server is the operations office: it checks identity and permissions, enforces deadlines, and coordinates the records. The live-media provider carries the call. The Engine handles approved proof and blockchain execution.'),
      table(['Component', 'Plain-language role', 'Why it matters'], [
        ['SolidJS student and tutor apps', 'The interfaces learners and tutors interact with.', 'Changing the frontend technology must preserve booking, consent, account, and classroom behavior.'],
        ['Preact admin dashboard', 'The staff workspace.', 'Operators see and act on protected business records according to their permissions.'],
        ['Application API', 'The rule-checking service behind the screens.', 'It is responsible for booking ownership, availability, attendance, and business approvals.'],
        ['Memgraph and PostgreSQL', 'Structured record stores.', 'They retain business relationships and operational state; not all data is stored on a blockchain.'],
        ['Seaweed storage', 'A file store for material and protected media.', 'Public lesson media and private QA recordings require different access paths.'],
        ['Cloudflare Workers', 'The delivery layer for the web apps.', 'It serves deployed interfaces; publishing an interface alone does not deploy the application API or activate a proof feature.'],
        ['GMR Engine and Vault', 'The controlled execution and key-handling services.', 'The browser should receive results, not signing keys or server credentials.'],
      ]),
      p('A successful page load only tells us that the interface loaded. The API, authentication provider, call provider, databases, storage, and blockchain readers can fail independently. This is why a system can display a tutor profile while a booking request or a balance lookup is unavailable.'),
      p('Durable records help the service recover after a restart. Operations that might be repeated need a stable identifier so the system can recognize a retry. Missing evidence should lead to a pending or unavailable state, not a fabricated confirmation.'),
    ] },
  { id: 'accounts-and-security', title: 'Accounts, permissions, and security', topic: 'Privacy', art: 'community',
    summary: 'Sign-in establishes an account session, not unlimited permission or proof of a unique person.', blocks: [
      p('Student sign-in can use supported identity-provider routes, with Privy supporting authentication and embedded-wallet capabilities where applicable. The platform API must still confirm the application session and role. Successfully signing in to an outside provider does not automatically authorize a lesson or financial action.'),
      p('Privy can help users use a wallet without beginning with specialist wallet software. That does not make every service a cryptocurrency service, remove custody questions, or require a wallet for an eligible trial booking. Device backups and account recovery need clear instructions appropriate to the specific feature.'),
      table(['Staff capability', 'Typical responsibility'], [
        ['Support', 'Cases, reasoned attendance corrections, and bounded lesson-note recovery.'],
        ['Operations', 'Lesson cancellation or rescheduling, penalty review, and booking restrictions.'],
        ['QA', 'Confidential survey comments and authorized recording review.'],
        ['Finance', 'Compensation rates, transactions, and refund approval or reconciliation.'],
        ['Superadmin', 'Capability assignment and wider platform administration.'],
      ]),
      p('Permissions must be checked against the current administrator record, not just an old login token. Finance and recording access should remain restricted even if a staff member can open ordinary account records. Changing a capability requires an audit reason.'),
      list('Protect signing keys, encryption keys, backup files, and recovery phrases. Never share them in chat, screenshots, support tickets, or a public repository.', 'Use the smallest set of permissions needed for a job and review staff access when responsibilities change.', 'Keep a reviewable history for sensitive actions. A reason field should explain the business decision, not merely say "fixed".'),
    ] },
  { id: 'calls-and-recordings', title: 'Live calls, recordings, and consent', topic: 'Privacy', art: 'schedule',
    summary: 'A live lesson and a retained recording are separate services with separate safeguards.', blocks: [
      p('New lesson room mappings use the configured classroom media provider, including Cloudflare RealtimeKit. Existing mapped rooms keep their original provider so a configuration change cannot split an active lesson. Interviews use a separate peer-to-peer call path with relay assistance where needed.'),
      p('Application signaling coordinates room access, chat, materials, and attendance alongside the media connection. Being present in the application room is different from the browser claiming that audio and video are connected. Support should inspect both without confusing one with the other.'),
      p('The tutor engagement policy requires a separate signed recording agreement before teaching work begins. General terms acceptance is not that signature. This standing tutor policy does not give permission to record a student who declines or withdraws their required consent.'),
      p('The classroom recording controls currently check versioned permission from both assigned participants and their declared authority, along with actual media presence and the authorized lesson window. A recorded adult or guardian declaration is not independent proof of guardianship. Staff must ensure that the agreement collection process and the runtime checks match the approved operating policy.'),
      p('QA recordings are intended for restricted service review, not public marketing or unrestricted staff playback. The archive encrypts recordings and uses authenticated administrator playback instead of public media links. Access, deletion, and review activity are recorded.'),
      note('Retention and external providers', 'The documented archive setting is 30 days; provider copies and backups have their own retention handling. Failed archiving, provider outages, and delayed deletion need monitoring. These recordings are not end-to-end encrypted from the media provider, and no blanket zero-retention claim should be made.'),
    ] },
  { id: 'privacy-and-proofs', title: 'Privacy and proofs, without the jargon', topic: 'Privacy', art: 'growth',
    summary: 'Prove a narrow statement while revealing less of the information behind it.', blocks: [
      p('Ordinary verification often asks someone to reveal the underlying information: an exam score, a student identity, or a list of purchases. A zero-knowledge proof can instead show that a defined rule was satisfied without revealing every private input used to check it.'),
      p('For example, a tutor credential can show that approved results met the required thresholds without publishing the exact scores and recording. The result is only as meaningful as the rule, the approved software, and the trustworthiness of the original assessment and issuer.'),
      h('Four ideas that explain most of the system'),
      list('A commitment is a sealed digital reference to information. A later check can verify that the information matches without making the original contents public. Adding randomness prevents guessing a small set of possible ratings or values.', 'A proof is evidence that a particular calculation or rule was satisfied. It does not prove everything about a person, lesson, or business.', 'A nullifier is a one-use marker. It helps reject a repeated use of the same review entitlement or lesson pass without putting a student name in the public marker.', 'A receipt is evidence that the required verification result reached the required place. A receipt must match the exact proof, network, and destination.'),
      p('Privacy is not all-or-nothing. The platform may know who enrolled, a device can hold a secret, a provider may observe network traffic, and a public commitment can remain visible. Encryption protects stored contents from someone without the key; it does not prevent an authorized operator from processing them.'),
      note('What not to claim', 'Do not describe the platform as completely anonymous, impossible to track, fully decentralized, independently audited, or able to prove learning quality. These statements are broader than the current design establishes.'),
    ] },
  { id: 'privacy-features', title: 'The privacy feature workflows', topic: 'Privacy', art: 'growth',
    summary: 'Screening, anonymous feedback, and private lesson access each solve a different problem.', blocks: [
      h('Privately verifiable tutor screening'),
      p('The screening design turns approved assessment and human-review evidence into a verifiable credential. Sharing is opt-in and exposes the approved public statement rather than exact scores, audio, answers, or internal notes. Expiry and revocation still need correct issuer and application handling. A credential tied to a tutor is not an anonymity feature.'),
      h('Anonymous verified reviews'),
      p('An eligible student enrolls after an owned, completed lesson with qualifying attendance. The browser creates a private identity for a tutor-and-month group and sends only a commitment during enrollment. That enrollment is still associated with the account; the later review submission is designed to avoid a direct account identifier.'),
      p('The pilot freezes membership after the month closes and needs at least five eligible members. Its supported review window is the first seven days of the following month. Feedback uses structured ratings and topics, not identifying comments. The student must retain the private identity or its backup; losing it is not a reason to create a second review entitlement.'),
      h('Provable review tallies'),
      p('A tally is a batch summary: review count, rating distribution, and topic counts. The proof can establish that the arithmetic and the opened feedback commitments match the selected batch. It does not prove that reviewers were honest or that the operator enrolled people fairly.'),
      p('Completeness is a separate issue. In the newer bridge-only source design, the accepted-review list comes from platform records, checked against individual verification receipts. That is not an independent proof that the platform did not omit a submission. Historical contract-based batches and new bridge-only batches must be labeled according to their own evidence, not mixed.'),
      h('Private lesson passes'),
      p('A private pass is a single-use lesson entitlement designed to reduce publicly attributable credit balances and spending histories. It is not private payment processing: the platform still knows the booking, and ordinary payment providers or transfers can expose financial information. Paid-pass intake remains gated, and trial booking does not require this pass.'),
      note('Keep the boundaries separate', 'An eligible review is not proof of call duration. A tally is not proof of honest sentiment. A pass is not proof of learning. A credential is not a legally recognized certificate merely because a proof verified.'),
    ] },
  { id: 'engine-and-networks', title: 'The Engine, networks, and wallet balances', topic: 'Technology', art: 'pay',
    summary: 'Know which network an action uses, which account pays, and what a success state actually means.', blocks: [
      p('The Engine is the controlled service used for technical operations such as approved contract actions and verification-proof submissions. The business platform supplies authorized records and decisions; the Engine executes the permitted technical operation and keeps its result.'),
      table(['Network or account', 'Purpose', 'Balance unit'], [
        ['Base project wallet', 'The EVM signing wallet used for permitted actions on Base mainnet.', 'ETH for native gas. A 0x address can have different balances on different chains.'],
        ['zkVerify verification account', 'The native account used to pay for proof verification.', 'VFY on mainnet; tVFY on Volta testnet. This is not the project 0x wallet.'],
        ['Testnet', 'An environment for integration checks and trials.', 'Test assets are not customer revenue or a real tutor payout.'],
        ['Mainnet', 'A network where transactions and fees use real assets.', 'Funding a wallet does not activate the application or approve a feature rollout.'],
      ]),
      p('The FluentXVerse Engine projects use Base mainnet as their EVM destination and zkVerify mainnet for native proof verification, with aggregation domain 2. Historical receipts retain their original networks. Archived and disabled workflows are not activated by this configuration change. Selecting a network for a balance lookup only reads information; submitting a proof is a separate potentially fee-paying action.'),
      steps('Prepare the exact approved proof and public statement.', 'Verify and submit it to the intended zkVerify network.', 'Wait for the required verification and, where used, aggregation publication.', 'Wait for the relay to publish the matching receipt to the destination bridge.', 'Check the destination evidence and complete the application-specific acceptance or publication step.'),
      p('A proof transaction can finalize while the destination bridge receipt is still missing. The product must remain pending in that situation. In the bridge-only design, the application reads the existing bridge rather than deploying its own feature contract, but it still depends on the receipt being relayed.'),
      note('Pending is not failure, and failure is not permission to resend', 'An unknown result needs reconciliation. Do not change the network, issue a replacement entitlement, or send a new paid transaction just to clear a waiting screen. Check the original operation and the exact required destination.'),
    ] },
  { id: 'performance-and-growth', title: 'What we measure, and why', topic: 'Business', art: 'growth',
    summary: 'Use clearly defined measures to understand service health, not just large numbers.', blocks: [
      p('The core operating funnel is discovery, booking, attendance, useful learning, and repeat engagement. Improving one stage while damaging the next is not real progress: more bookings with more cancellations can increase support work without improving the business.'),
      table(['Measure', 'What it can tell us', 'What to watch out for'], [
        ['Bookable and booked slots', 'Published supply and how much of it is reserved.', 'Unpublished calendar cells are not bookable supply. A booking count is not a completed lesson count.'],
        ['Attendance and teaching time', 'Whether lessons were delivered and how much eligible time was recorded.', 'Entry evidence does not prove attention or educational effectiveness.'],
        ['Cancellation ratio', 'The share of elapsed published slot opportunities affected by valid tutor cancellation or absence codes.', 'The shared calculator counts a physical slot once, excludes future opportunities, and handles revoked or contradictory penalties. It is not a student-cancellation percentage.'],
        ['Lesson-note timeliness', 'Whether required notes reach students within their deadline.', 'A reopened late submission does not become an on-time submission.'],
        ['Feedback response and topics', 'How many eligible students responded and what they report.', 'Missing feedback is not a low rating. A small or biased sample can be misleading.'],
        ['Revenue, refunds, and costs', 'The economics of delivering the service.', 'Wallet gas, purchased credits, recognized revenue, tutor earnings, and completed payouts are not interchangeable.'],
      ]),
      p('Student feedback covers audio and connection, end-of-lesson feedback, corrections, speaking pace, and difficulty for the learner. Improvement topics also cover background noise, start and end times, focus, and following the lesson request. These describe service experiences rather than independently measured ability.'),
      p('Business review should also track repeat bookings, trial-to-paid conversion where paid sales are enabled, tutor utilization, unresolved cases, and acquisition costs. These are recommended management measures, not a claim that every dashboard currently calculates them.'),
      note('Compare like with like', 'Keep the date range, timezone, eligibility rules, and sample size visible. Separate historical identity-linked ratings from published anonymous batches. A synthetic proof test is an engineering result, not a new customer or a real lesson.'),
    ] },
  { id: 'operating-playbook', title: 'The operating playbook', topic: 'Operations', art: 'home',
    summary: 'How staff use the dashboard to keep the service trustworthy.', blocks: [
      h('Daily service review'),
      list('Review active and upcoming lessons, missing-tutor alerts, room departures, and connection observations. Contact participants using the case record rather than guessing from a calendar color.', 'Check pending applications, interviews, required approvals, note deadlines, issue assignment, and overdue resolutions.', 'Finance checks pending refunds and uncertain transfers. QA reviews eligible recordings and feedback according to access and retention rules.'),
      h('When something goes wrong'),
      steps('Find the exact lesson or account and establish the stored time, booking state, attendance, and reported problem.', 'Distinguish a frontend problem, business-rule rejection, provider outage, and uncertain financial result.', 'Use the permitted corrective action and record a specific reason. A cancellation, attendance correction, penalty revocation, and refund are separate decisions.', 'Confirm the final state and communicate the outcome without exposing internal comments, another person\'s private information, or signing credentials.'),
      p('The lesson operations workspace connects live observations, schedules, notes, issues, feedback, performance, payments, and audit history. Tutor, student, and session records link to the underlying lesson or account so staff do not need to reconcile independent spreadsheets for routine cases.'),
      p('Content editors own the quality and publication of materials. Operations owns availability and lesson-policy decisions. QA owns restricted service evidence. Finance owns money decisions. Technical operators own deployment, integrations, secrets, and transaction reconciliation. A person may have several roles, but each responsibility should still be explicit.'),
      note('An exception should leave a trace', 'Do not delete history to make an account look clean, invent a missing approval, or relabel a pending proof as verified. Audited corrections make it possible to explain what changed and why.'),
    ] },
  { id: 'release-and-risks', title: 'What is ready, what is gated, and what comes next', topic: 'Technology', art: 'growth',
    summary: 'Source code, a deployed service, and an approved commercial launch are three different milestones.', blocks: [
      table(['Area', 'How to describe it responsibly'], [
        ['Core lessons and administration', 'Implemented workflows for accounts, tutor review, schedules, classrooms, lesson operations, materials, and issue handling. Availability still depends on running services and permissions.'],
        ['Trial and bridge-only source changes', 'Reviewed source defaults introduced October 13. Check the actual deployed mode; this guide does not assert those changes are already active everywhere.'],
        ['Tutor compensation', 'Administrator-set USD rates and rate-change history. Automatic earnings, payable ledgers, and payout execution are separate milestones.'],
        ['Private lesson passes', 'Implemented, gated pilot work with documented testnet evidence and unresolved activation dependencies. Not a general paid-access or mainnet launch.'],
        ['Anonymous reviews and provable tallies', 'Scoped pilot work. The documented tally deployment is disabled; real cohort acceptance, destination receipts, and approved publication remain necessary.'],
        ['Private tutor screening', 'Evidence-bound credential design with opt-in sharing and approved-artifact requirements. Mainnet rollout and independent audit are not established by the implementation.'],
        ['Engine mainnet connectivity', 'General mainnet reads and submission support. Not automatic mainnet permission for every module or an end-to-end mainnet product release.'],
      ]),
      p('The principal dependencies are honest source records, properly reviewed proving software, protected keys and backups, reliable identity and call providers, correctly configured networks, and a working receipt relay. Operator privacy, security, and business procedures remain essential even when a mathematical proof is valid.'),
      h('Before expanding a pilot'),
      list('Confirm the booking and commercial mode, customer notices, recording agreement collection, and support ownership.', 'Test the full path with approved artifacts and real destination evidence, including expiry, cancellation, duplicate use, outage, and recovery cases.', 'Review security and privacy independently where appropriate; specify retention, backup, key recovery, and incident response.', 'Establish revenue reconciliation, payable earnings, refund controls, and payout approval before making financial automation claims.'),
      p('The longer-term direction can include broader subjects, partner verification of selected credentials, and stronger private financial settlement. These are possible developments, not current universal partner acceptance or a promise of grant funding.'),
      note('Use this as an orientation, not a live status board', 'This guide is based on reviewed code and internal implementation records as of October 13, 2026. Feature flags, current agreements, approved releases, and the actual account or lesson record take precedence. It does not replace the Privacy Policy, Terms of Service, or a signed engagement.'),
    ] },
];

export const guideGlossary = [
  ['Availability', 'A time a tutor has offered to students. A calendar cell that was never published is not an offered slot.'],
  ['Booking', 'A confirmed reservation connecting one student, one tutor, and one scheduled lesson.'],
  ['Attendance', 'A recorded participation status supported by the platform\'s evidence and correction process.'],
  ['Trial allowance', 'The limited number of eligible trial bookings permitted for an account.'],
  ['Lesson credit or ticket', 'A paid-access record used by an enabled commercial flow, not a learning outcome or an investment.'],
  ['Base rate', 'An agreed tutor compensation input. It is not itself a completed earning or payout.'],
  ['API', 'The service an app contacts to read records or request an action. It is where server-side rules are checked.'],
  ['Feature flag', 'A setting that enables a feature or selects a mode. Code can exist while the feature stays disabled.'],
  ['Wallet', 'An account used to hold assets or authorize network actions. Its network and custody arrangement matter.'],
  ['Gas', 'The native-network fee paid for an action. A gas balance is an operating balance, not business revenue.'],
  ['Testnet / mainnet', 'A testing network / a network using real assets. The same address can have a separate balance on each.'],
  ['ZK proof', 'Mathematical evidence for a specific rule, designed to reveal less of the private input information.'],
  ['Issuer', 'The organization or service making and signing a claim, such as an approved assessment result.'],
  ['Commitment', 'A sealed digital reference that binds information without openly publishing all of its contents.'],
  ['Nullifier', 'A one-use marker that prevents replaying a particular entitlement or review.'],
  ['Cohort', 'A fixed group of eligible people, such as students associated with a tutor and a month.'],
  ['Aggregation', 'A verification-service batch of proof receipts. This is different from calculating a review average.'],
  ['Bridge / relay', 'The destination service and the publication process that make verification receipts available to another chain.'],
  ['Finality', 'The network state required before the application treats a transaction or receipt as sufficiently settled.'],
  ['Reconciliation', 'Checking the original records and execution result to resolve an uncertain operation without paying or acting twice.'],
  ['Revocation', 'Withdrawing the validity of a previously issued credential or permission while preserving its history.'],
  ['Audit trail', 'A record of who performed a sensitive action, when, and why. It is not the same as an independent security audit.'],
] as const;

export const guideReferences = [
  { title: 'zkVerify: proof lifecycle', href: 'https://docs.zkverify.io/handbook/zk-proof-lifecycle/zk-proof-lifecycle', detail: 'Verification, optional aggregation, and destination consumption are separate stages.' },
  { title: 'Privy: authentication overview', href: 'https://docs.privy.io/authentication', detail: 'Background on identity-provider sign-in and wallet-related capabilities.' },
  { title: 'Cloudflare: RealtimeKit recording', href: 'https://developers.cloudflare.com/realtime/realtimekit/recording-guide/', detail: 'How the media provider handles composite recordings; platform permission and retention rules are additional controls.' },
  { title: 'ERC-1155: multi-token standard', href: 'https://eips.ethereum.org/EIPS/eip-1155', detail: 'The standard used by historical ticket designs. It does not define our booking, refund, or teaching rules.' },
];

export function chapterText(chapter: GuideChapter): string {
  return [chapter.title, chapter.summary, ...chapter.blocks.flatMap(block => {
    if (block.kind === 'list' || block.kind === 'steps') return block.items;
    if (block.kind === 'table') return [...block.headings, ...block.rows.flat()];
    return block.kind === 'note' ? [block.title, block.text] : [block.text];
  })].join(' ');
}

export function filterGuide(query: string, topic: GuideTopic | 'All' = 'All') {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return guideChapters.filter(chapter => (topic === 'All' || chapter.topic === topic) && words.every(word => chapterText(chapter).toLowerCase().includes(word)));
}

export const guideReadingMinutes = Math.ceil((guideChapters.map(chapterText).join(' ') + ' ' + guideGlossary.flat().join(' ')).split(/\s+/).length / 220);
