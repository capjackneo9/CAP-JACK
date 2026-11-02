import type { Permission } from "../rbac";

export const SUBMISSION_STATUSES = [
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "SCHEDULED", "BROADCAST_COMPLETED",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SCHEDULED: "Scheduled",
  BROADCAST_COMPLETED: "Broadcast completed",
};

interface Transition { to: SubmissionStatus; permission: Permission | "public" }

const TRANSITIONS: Record<SubmissionStatus, Transition[]> = {
  DRAFT: [{ to: "SUBMITTED", permission: "public" }],
  SUBMITTED: [{ to: "UNDER_REVIEW", permission: "submissions.review" }, { to: "REJECTED", permission: "submissions.approve" }],
  UNDER_REVIEW: [
    { to: "APPROVED", permission: "submissions.approve" },
    { to: "REJECTED", permission: "submissions.approve" },
    { to: "SUBMITTED", permission: "submissions.review" },
  ],
  APPROVED: [{ to: "SCHEDULED", permission: "submissions.approve" }, { to: "REJECTED", permission: "submissions.approve" }],
  REJECTED: [{ to: "UNDER_REVIEW", permission: "submissions.approve" }],
  SCHEDULED: [{ to: "BROADCAST_COMPLETED", permission: "submissions.approve" }, { to: "APPROVED", permission: "submissions.approve" }],
  BROADCAST_COMPLETED: [],
};

export function allowedTransitions(from: SubmissionStatus): Transition[] {
  return TRANSITIONS[from] ?? [];
}

export interface TransitionContext {
  from: SubmissionStatus;
  to: SubmissionStatus;
  permissions: Permission[];
  rightsConfirmed: boolean;
  broadcastPermission: boolean;
  /** Present for audit only — payment NEVER influences editorial decisions. */
  paid?: boolean;
}

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export function checkTransition(ctx: TransitionContext): TransitionResult {
  const t = allowedTransitions(ctx.from).find((x) => x.to === ctx.to);
  if (!t) return { ok: false, reason: `Cannot move from ${ctx.from} to ${ctx.to}` };
  if (t.permission !== "public" && !ctx.permissions.includes(t.permission)) {
    return { ok: false, reason: `Requires ${t.permission}` };
  }
  if ((ctx.to === "APPROVED" || ctx.to === "SCHEDULED") && (!ctx.rightsConfirmed || !ctx.broadcastPermission)) {
    return { ok: false, reason: "Rights and broadcast permission must be confirmed before approval" };
  }
  return { ok: true };
}

/** Payment completion only ever moves payment state; it never changes editorial status. */
export function statusAfterPayment(current: SubmissionStatus): SubmissionStatus {
  return current;
}
