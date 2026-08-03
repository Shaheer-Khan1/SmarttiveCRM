import {
  differenceInDays, formatDistanceToNow, format,
  addDays, addWeeks, addMonths, addYears, isSameDay, isBefore, isAfter,
} from "date-fns";
import type {
  CalendarEvent, ProductStatus, MaturityLevel, PocStage,
  EvaluationScore, CompatibilityStatus,
} from "./firestore";

export type FollowUpStatus = "HEALTHY" | "WARNING" | "RED_FLAG" | "NO_ACTIVITY";

export function getFollowUpStatus(lastActivityDate: Date | null): FollowUpStatus {
  if (!lastActivityDate) return "NO_ACTIVITY";
  const days = differenceInDays(new Date(), lastActivityDate);
  if (days < 5) return "HEALTHY";
  if (days < 7) return "WARNING";
  return "RED_FLAG";
}

export function getFollowUpLabel(status: FollowUpStatus): string {
  switch (status) {
    case "HEALTHY": return "Healthy";
    case "WARNING": return "Follow-up Needed";
    case "RED_FLAG": return "Red Flag";
    case "NO_ACTIVITY": return "No Activity";
  }
}

export function getFollowUpColors(status: FollowUpStatus) {
  switch (status) {
    case "HEALTHY": return { badge: "text-green-600 bg-green-50 border-green-200", dot: "bg-green-500" };
    case "WARNING": return { badge: "text-amber-600 bg-amber-50 border-amber-200", dot: "bg-amber-500" };
    case "RED_FLAG": return { badge: "text-red-600 bg-red-50 border-red-200", dot: "bg-red-500" };
    case "NO_ACTIVITY": return { badge: "text-gray-500 bg-gray-50 border-gray-200", dot: "bg-gray-400" };
  }
}

export function getStatusColors(status: string): string {
  switch (status) {
    case "ACTIVE":
    case "LEAD":
    case "QUALIFICATION": return "text-blue-700 bg-blue-50 border-blue-200";
    case "POC": return "text-indigo-700 bg-indigo-50 border-indigo-200";
    case "PROPOSAL":
    case "NEGOTIATION": return "text-violet-700 bg-violet-50 border-violet-200";
    case "WON":
    case "CLOSED_WON": return "text-green-700 bg-green-50 border-green-200";
    case "LOST":
    case "CLOSED_LOST": return "text-red-700 bg-red-50 border-red-200";
    case "ON_HOLD": return "text-amber-700 bg-amber-50 border-amber-200";
    default: return "text-gray-700 bg-gray-50 border-gray-200";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE": return "Active";
    case "WON": return "Won";
    case "LOST": return "Lost";
    case "ON_HOLD": return "On Hold";
    case "LEAD": return "Lead";
    case "QUALIFICATION": return "Qualification";
    case "POC": return "PoC";
    case "PROPOSAL": return "Proposal / Quoting";
    case "NEGOTIATION": return "Negotiation";
    case "CLOSED_WON": return "Closed Won";
    case "CLOSED_LOST": return "Closed Lost";
    default: return status;
  }
}

export const PIPELINE_STAGE_LABELS: Record<string, string> = {
  LEAD: "Lead",
  QUALIFICATION: "Qualification",
  POC: "PoC",
  PROPOSAL: "Proposal / Quoting",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost",
};

export const COUNTRIES = [
  "Saudi Arabia", "UAE", "Qatar", "Bahrain", "Kuwait", "Oman",
  "Egypt", "Jordan", "USA", "UK", "Other",
];

export const REGIONS = ["GCC", "MENA", "Europe", "Americas", "APAC", "Other"];

export const CATALOG_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#64748B",
];

export function getPocStatusLabel(status: string): string {
  switch (status) {
    case "NOT_STARTED": return "Not Started";
    case "IN_PROGRESS": return "In Progress";
    case "BLOCKED": return "Blocked";
    case "COMPLETED": return "Completed";
    case "FAILED": return "Failed";
    default: return status;
  }
}

export function getActivityTypeColor(type: string): string {
  const colors: Record<string, string> = {
    EMAIL: "bg-blue-100 text-blue-800",
    MEETING: "bg-purple-100 text-purple-800",
    CALL: "bg-green-100 text-green-800",
    PROPOSAL: "bg-orange-100 text-orange-800",
    QUOTATION: "bg-yellow-100 text-yellow-800",
    DEMO: "bg-pink-100 text-pink-800",
    POC: "bg-indigo-100 text-indigo-800",
    SITE_VISIT: "bg-teal-100 text-teal-800",
    FOLLOW_UP: "bg-cyan-100 text-cyan-800",
    OTHER: "bg-gray-100 text-gray-800",
  };
  return colors[type] || "bg-gray-100 text-gray-800";
}

export function getActivityTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    EMAIL: "✉️", MEETING: "🤝", CALL: "📞", PROPOSAL: "📄",
    QUOTATION: "💰", DEMO: "🖥️", POC: "🔬", SITE_VISIT: "🏢",
    FOLLOW_UP: "🔔", OTHER: "📌",
  };
  return icons[type] || "📌";
}

export function formatTimeAgo(date: Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const ACTIVITY_TYPES = [
  "EMAIL", "MEETING", "CALL", "PROPOSAL", "QUOTATION",
  "DEMO", "POC", "SITE_VISIT", "FOLLOW_UP", "OTHER",
] as const;

/** Category tags used in demo seed data (not people names). */
export const OPPORTUNITY_TAGS = [
  "Security",
  "Parking",
  "Video Analytics",
  "Networking",
  "Enterprise",
] as const;

export const CURRENCIES = ["SAR", "USD", "AED", "EUR", "GBP"];

// ─── Calendar ──────────────────────────────────────────────────────────────────

export interface EventOccurrence {
  event: CalendarEvent;
  start: Date;
  end: Date;
}

/**
 * Expand a recurring event into individual occurrences that fall within
 * [rangeStart, rangeEnd]. Non-recurring events return a single occurrence
 * if they intersect the range. A hard cap prevents runaway loops.
 */
export function expandRecurrence(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): EventOccurrence[] {
  const durationMs = event.endDate.getTime() - event.startDate.getTime();
  const occurrences: EventOccurrence[] = [];

  if (event.recurrence === "NONE") {
    if (!isAfter(event.startDate, rangeEnd) && !isBefore(event.endDate, rangeStart)) {
      occurrences.push({ event, start: event.startDate, end: event.endDate });
    }
    return occurrences;
  }

  const step = (d: Date): Date => {
    switch (event.recurrence) {
      case "DAILY": return addDays(d, 1);
      case "WEEKLY": return addWeeks(d, 1);
      case "MONTHLY": return addMonths(d, 1);
      case "YEARLY": return addYears(d, 1);
      default: return addDays(d, 1);
    }
  };

  const seriesEnd = event.recurrenceEndDate && isBefore(event.recurrenceEndDate, rangeEnd)
    ? event.recurrenceEndDate
    : rangeEnd;

  let cursor = new Date(event.startDate);
  let guard = 0;
  while (!isAfter(cursor, seriesEnd) && guard < 1000) {
    guard++;
    if (!isBefore(cursor, rangeStart)) {
      occurrences.push({ event, start: new Date(cursor), end: new Date(cursor.getTime() + durationMs) });
    }
    cursor = step(cursor);
  }
  return occurrences;
}

export function occurrencesOnDay(occurrences: EventOccurrence[], day: Date): EventOccurrence[] {
  return occurrences
    .filter((o) => isSameDay(o.start, day))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export const RECURRENCE_OPTIONS: { value: string; label: string }[] = [
  { value: "NONE", label: "Does not repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

export const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "At time of event" },
  { value: 10, label: "10 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 1440, label: "1 day before" },
];

// ─── Product Research Tracking ───────────────────────────────────────────────────

export const PRODUCT_STATUSES: ProductStatus[] = [
  "RESEARCH_STARTED", "IN_PROGRESS", "POC_ONGOING", "UNDER_REVIEW", "APPROVED", "REJECTED", "INTEGRATED",
];

export function getProductStatusLabel(status: ProductStatus): string {
  const labels: Record<ProductStatus, string> = {
    RESEARCH_STARTED: "Research Started",
    IN_PROGRESS: "In Progress",
    POC_ONGOING: "POC Ongoing",
    UNDER_REVIEW: "Under Review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    INTEGRATED: "Integrated",
  };
  return labels[status] || status;
}

export function getProductStatusColors(status: ProductStatus): string {
  const colors: Record<ProductStatus, string> = {
    RESEARCH_STARTED: "text-slate-700 bg-slate-50 border-slate-200",
    IN_PROGRESS: "text-blue-700 bg-blue-50 border-blue-200",
    POC_ONGOING: "text-indigo-700 bg-indigo-50 border-indigo-200",
    UNDER_REVIEW: "text-amber-700 bg-amber-50 border-amber-200",
    APPROVED: "text-green-700 bg-green-50 border-green-200",
    REJECTED: "text-red-700 bg-red-50 border-red-200",
    INTEGRATED: "text-purple-700 bg-purple-50 border-purple-200",
  };
  return colors[status] || "text-gray-700 bg-gray-50 border-gray-200";
}

export const POC_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "FAILED"] as const;

export function getPocStatusColors(status: string): string {
  switch (status) {
    case "COMPLETED": return "text-green-700 bg-green-50 border-green-200";
    case "IN_PROGRESS": return "text-blue-700 bg-blue-50 border-blue-200";
    case "BLOCKED": return "text-amber-700 bg-amber-50 border-amber-200";
    case "FAILED": return "text-red-700 bg-red-50 border-red-200";
    case "NOT_STARTED": return "text-gray-600 bg-gray-50 border-gray-200";
    default: return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

export const PRODUCT_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export function getPriorityColors(priority?: string): string {
  switch (priority) {
    case "HIGH": return "text-red-700 bg-red-50 border-red-200";
    case "MEDIUM": return "text-amber-700 bg-amber-50 border-amber-200";
    case "LOW": return "text-gray-600 bg-gray-50 border-gray-200";
    default: return "text-gray-600 bg-gray-50 border-gray-200";
  }
}

// ─── Research Maturity Ladder (L1 → L6) ──────────────────────────────────────────

export const MATURITY_LEVELS: { value: MaturityLevel; label: string; description: string }[] = [
  { value: "L1", label: "Discovery", description: "Initial identification and need framing" },
  { value: "L2", label: "Data Collection", description: "Gathering specs, pricing and references" },
  { value: "L3", label: "Technical Validation", description: "Validating fit and feasibility" },
  { value: "L4", label: "Prototype / PoC", description: "Hands-on proof of concept" },
  { value: "L5", label: "Integration Ready", description: "Approved and ready to integrate" },
  { value: "L6", label: "Production Adopted", description: "Live in production" },
];

export function getMaturityLabel(level: MaturityLevel): string {
  return MATURITY_LEVELS.find((m) => m.value === level)?.label || level;
}

export function getMaturityIndex(level: MaturityLevel): number {
  const i = MATURITY_LEVELS.findIndex((m) => m.value === level);
  return i < 0 ? 0 : i;
}

export function getMaturityColors(level: MaturityLevel): string {
  const idx = getMaturityIndex(level);
  const palette = [
    "text-slate-700 bg-slate-50 border-slate-200",
    "text-sky-700 bg-sky-50 border-sky-200",
    "text-blue-700 bg-blue-50 border-blue-200",
    "text-indigo-700 bg-indigo-50 border-indigo-200",
    "text-violet-700 bg-violet-50 border-violet-200",
    "text-green-700 bg-green-50 border-green-200",
  ];
  return palette[idx] || palette[0];
}

// ─── PoC Lifecycle (PoC-1 → PoC-6) ───────────────────────────────────────────────

export const POC_STAGES: { value: PocStage; label: string }[] = [
  { value: "PoC-1", label: "Concept Validation" },
  { value: "PoC-2", label: "Technical Feasibility" },
  { value: "PoC-3", label: "Prototype Build" },
  { value: "PoC-4", label: "Controlled Testing" },
  { value: "PoC-5", label: "Stakeholder Review" },
  { value: "PoC-6", label: "Production Decision" },
];

export function getPocStageLabel(stage: PocStage): string {
  return POC_STAGES.find((s) => s.value === stage)?.label || stage;
}

// ─── Evaluation Scoring ──────────────────────────────────────────────────────────

export function computeScore(scores: EvaluationScore[]): { weighted: number; max: number; pct: number } {
  if (!scores || scores.length === 0) return { weighted: 0, max: 0, pct: 0 };
  const weighted = scores.reduce((sum, s) => sum + s.weight * s.score, 0);
  const max = scores.reduce((sum, s) => sum + s.weight * 5, 0);
  const pct = max > 0 ? Math.round((weighted / max) * 100) : 0;
  return { weighted, max, pct };
}

export function getScoreColors(pct: number): string {
  if (pct >= 75) return "text-green-700 bg-green-50 border-green-200";
  if (pct >= 50) return "text-amber-700 bg-amber-50 border-amber-200";
  if (pct > 0) return "text-red-700 bg-red-50 border-red-200";
  return "text-gray-500 bg-gray-50 border-gray-200";
}

// ─── Technical Compatibility Matrix ──────────────────────────────────────────────

export const COMPATIBILITY_STATUSES: CompatibilityStatus[] = ["COMPATIBLE", "PARTIAL", "INCOMPATIBLE", "UNKNOWN"];

export function getCompatibilityColors(status: CompatibilityStatus): string {
  switch (status) {
    case "COMPATIBLE": return "text-green-700 bg-green-50 border-green-200";
    case "PARTIAL": return "text-amber-700 bg-amber-50 border-amber-200";
    case "INCOMPATIBLE": return "text-red-700 bg-red-50 border-red-200";
    default: return "text-gray-500 bg-gray-50 border-gray-200";
  }
}

export function getCompatibilityLabel(status: CompatibilityStatus): string {
  switch (status) {
    case "COMPATIBLE": return "Compatible";
    case "PARTIAL": return "Partial";
    case "INCOMPATIBLE": return "Incompatible";
    default: return "Unknown";
  }
}
