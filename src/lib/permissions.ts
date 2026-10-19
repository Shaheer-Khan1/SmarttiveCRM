import type { MeetingNote } from "./crm";
import type { CalendarEvent, Opportunity, OpportunityStage, Product, UserProfile } from "./firestore";

export function isAdmin(profile: UserProfile | null | undefined): boolean {
  return profile?.role === "ADMIN";
}

export function isManager(profile: UserProfile | null | undefined): boolean {
  return profile?.role === "MANAGER";
}

export function isDeveloper(profile: UserProfile | null | undefined): boolean {
  return profile?.role === "DEVELOPER";
}

/** Owner / Co-Owner may only be Admin or Manager. */
export function isOwnerEligible(profile: UserProfile | null | undefined): boolean {
  return isAdmin(profile) || isManager(profile);
}

export function ownerEligibleUsers(users: UserProfile[]): UserProfile[] {
  return users.filter((u) => u.role === "ADMIN" || u.role === "MANAGER");
}

export function isOwner(opp: Opportunity | null | undefined, userId: string | undefined): boolean {
  if (!opp || !userId) return false;
  return opp.owner?.id === userId;
}

export function isCoOwner(opp: Opportunity | null | undefined, userId: string | undefined): boolean {
  if (!opp || !userId) return false;
  return opp.coOwner?.id === userId;
}

export function isOpportunityCreator(
  opp: Opportunity | null | undefined,
  userId: string | undefined,
): boolean {
  if (!opp || !userId) return false;
  return opp.initiatedById === userId;
}

/** All signed-in roles may create opps, notes, calendar events, and research. */
export function canCreateCrmRecords(profile: UserProfile | null | undefined): boolean {
  return isAdmin(profile) || isManager(profile) || isDeveloper(profile);
}

/**
 * Managers and Admins can create/manage CRM data (customers, vendors, catalog, tags).
 * User management stays Admin-only.
 */
export function canManageCrmData(profile: UserProfile | null | undefined): boolean {
  return isAdmin(profile) || isManager(profile);
}

export function canManageUsers(profile: UserProfile | null | undefined): boolean {
  return isAdmin(profile);
}

/**
 * Delete policy:
 * - Admin: anything
 * - Manager: only records they created
 * - Developer: never
 */
export function canDeleteRecord(
  profile: UserProfile | null | undefined,
  createdById: string | undefined | null,
  userId: string | undefined,
): boolean {
  if (!userId || isDeveloper(profile)) return false;
  if (isAdmin(profile)) return true;
  if (isManager(profile)) return !!createdById && createdById === userId;
  return false;
}

/**
 * Full field/stage edits.
 * Admin/Manager: any opportunity.
 * Developer: only opportunities they created (initiatedBy).
 */
export function canEditOpportunity(
  opp: Opportunity | null | undefined,
  profile: UserProfile | null | undefined,
  userId: string | undefined,
): boolean {
  if (!opp || !userId) return false;
  if (isAdmin(profile) || isManager(profile)) return true;
  if (isDeveloper(profile)) return isOpportunityCreator(opp, userId);
  return false;
}

/**
 * Comments, activities, PoC updates.
 * Admin/Manager: always. Developer: on opportunities they created.
 */
export function canContributeToOpportunity(
  opp: Opportunity | null | undefined,
  profile: UserProfile | null | undefined,
  userId: string | undefined,
): boolean {
  if (!opp || !userId) return false;
  if (isAdmin(profile) || isManager(profile)) return true;
  if (isDeveloper(profile)) return isOpportunityCreator(opp, userId);
  return false;
}

/** Only Admin / Manager may assign or reassign Owner. */
export function canChangeOwner(profile: UserProfile | null | undefined): boolean {
  return isAdmin(profile) || isManager(profile);
}

/** Only Admin / Manager may set Co-Owner. */
export function canChangeCoOwner(
  _opp: Opportunity | null | undefined,
  profile: UserProfile | null | undefined,
  _userId: string | undefined,
): boolean {
  return isAdmin(profile) || isManager(profile);
}

export function canAddPocUpdate(
  opp: Opportunity | null | undefined,
  profile: UserProfile | null | undefined,
  userId: string | undefined,
): boolean {
  return canContributeToOpportunity(opp, profile, userId);
}

export function canReopenCompletedPoc(profile: UserProfile | null | undefined): boolean {
  return isAdmin(profile);
}

/** Reopen a closed stage or move backward. Admin only. */
export function canLeaveTerminalStage(profile: UserProfile | null | undefined): boolean {
  return isAdmin(profile);
}

/** Happy-path order. Closed Lost is an exit, not the step after Closed Won. */
export const FORWARD_STAGES: OpportunityStage[] = [
  "LEAD",
  "QUALIFICATION",
  "POC",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
];

export function nextOpportunityStage(from: OpportunityStage): OpportunityStage | null {
  const i = FORWARD_STAGES.indexOf(from);
  if (i < 0 || i >= FORWARD_STAGES.length - 1) return null;
  return FORWARD_STAGES[i + 1];
}

export type StageMoveKind = "same" | "forward" | "back" | "lost" | "blocked";

export function stageMoveKind(from: OpportunityStage, to: OpportunityStage): StageMoveKind {
  if (from === to) return "same";
  if (to === "CLOSED_LOST") {
    if (from === "CLOSED_LOST") return "same";
    if (from === "CLOSED_WON") return "back";
    return "lost";
  }
  if (from === "CLOSED_LOST") return "back";
  const fromIdx = FORWARD_STAGES.indexOf(from);
  const toIdx = FORWARD_STAGES.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return "blocked";
  if (toIdx === fromIdx + 1) return "forward";
  if (toIdx < fromIdx) return "back";
  return "blocked";
}

/**
 * One step forward (or mark lost) for anyone who can edit the opportunity.
 * Any move backward, including leaving Closed Won / Closed Lost, is admin-only.
 * Skipping ahead is never allowed.
 */
export function canChangeStage(
  from: string,
  to: string,
  profile: UserProfile | null | undefined,
  canEdit: boolean,
): boolean {
  const kind = stageMoveKind(from as OpportunityStage, to as OpportunityStage);
  if (kind === "same") return true;
  if (kind === "forward" || kind === "lost") return canEdit;
  if (kind === "back") return isAdmin(profile);
  return false;
}

export function isReadOnlyViewer(
  opp: Opportunity | null | undefined,
  profile: UserProfile | null | undefined,
  userId: string | undefined,
): boolean {
  return !canEditOpportunity(opp, profile, userId);
}

export function isProductCreator(
  product: Product | null | undefined,
  userId: string | undefined,
): boolean {
  if (!product || !userId) return false;
  return product.createdById === userId;
}

/** Admin: all. Creator (Manager/Developer): own research. */
export function canEditProduct(
  product: Product | null | undefined,
  profile: UserProfile | null | undefined,
  userId: string | undefined,
): boolean {
  if (!product || !userId) return false;
  if (isAdmin(profile)) return true;
  if (isManager(profile) || isDeveloper(profile)) return isProductCreator(product, userId);
  return false;
}

export function canDeleteProduct(
  product: Product | null | undefined,
  profile: UserProfile | null | undefined,
  userId: string | undefined,
): boolean {
  return canDeleteRecord(profile, product?.createdById, userId);
}

/** Comments / uploads / PoC when admin/manager, creator, or assigned developer/reviewer. */
export function canContributeToProduct(
  product: Product | null | undefined,
  profile: UserProfile | null | undefined,
  userId: string | undefined,
): boolean {
  if (!product || !userId) return false;
  if (isAdmin(profile) || isManager(profile)) return true;
  if (isProductCreator(product, userId)) return true;
  return (
    product.assignedDeveloperId === userId ||
    product.reviewerId === userId
  );
}

export function canEditMeetingNoteRecord(
  note: MeetingNote | null | undefined,
  profile: UserProfile | null | undefined,
  userId: string | undefined,
): boolean {
  if (!note || !userId) return false;
  if (isAdmin(profile)) return true;
  if (isDeveloper(profile)) return note.createdById === userId;
  // Manager: creator or collaborator
  const perm = note.permissions.find((p) => p.userId === userId);
  if (!perm) return note.createdById === userId;
  return perm.role === "CREATOR" || perm.role === "COLLABORATOR";
}

/** Admin/Manager: any event. Developer: only events they created. */
export function canEditCalendarEvent(
  event: CalendarEvent | null | undefined,
  profile: UserProfile | null | undefined,
  userId: string | undefined,
): boolean {
  if (!event || !userId) return false;
  if (isAdmin(profile) || isManager(profile)) return true;
  if (isDeveloper(profile)) return event.createdById === userId;
  return false;
}
