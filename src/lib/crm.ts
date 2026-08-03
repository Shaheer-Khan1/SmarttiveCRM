/**
 * CRM Opportunity extensions: Product Catalog, Tags, Opp Products/PoC,
 * Meeting Notes, and Opportunity audit events.
 */
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp, serverTimestamp, writeBatch,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AssignedPerson } from "./firestore";

function toDate(val: Timestamp | Date | null | undefined): Date {
  if (!val) return new Date();
  if (val instanceof Timestamp) return val.toDate();
  return val;
}

// ─── Stages & PoC ────────────────────────────────────────────────────────────

export type OpportunityStage =
  | "LEAD"
  | "QUALIFICATION"
  | "POC"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "CLOSED_WON"
  | "CLOSED_LOST";

export type OppPocStatus = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";

export const PIPELINE_STAGES: OpportunityStage[] = [
  "LEAD", "QUALIFICATION", "POC", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST",
];

export const TERMINAL_STAGES: OpportunityStage[] = ["CLOSED_WON", "CLOSED_LOST"];

export const POC_STATUS_FLOW: Record<OppPocStatus, OppPocStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS"],
  IN_PROGRESS: ["BLOCKED", "COMPLETED"],
  BLOCKED: ["IN_PROGRESS"],
  COMPLETED: [], // Admin reopen handled separately → IN_PROGRESS
};

// ─── Product Catalog ─────────────────────────────────────────────────────────

export interface CatalogProduct {
  id: string;
  name: string;
  active: boolean;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getCatalogProducts(opts?: { activeOnly?: boolean }): Promise<CatalogProduct[]> {
  const snap = await getDocs(query(collection(db, "product_catalog"), orderBy("name")));
  let list = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name as string,
      active: data.active !== false,
      color: (data.color as string) || "#3B82F6",
      createdAt: toDate(data.createdAt as Timestamp),
      updatedAt: toDate(data.updatedAt as Timestamp),
    };
  });
  if (opts?.activeOnly) list = list.filter((p) => p.active);
  return list;
}

export async function createCatalogProduct(data: { name: string; color: string; active?: boolean }): Promise<string> {
  const ref = await addDoc(collection(db, "product_catalog"), {
    name: data.name.trim(),
    color: data.color || "#3B82F6",
    active: data.active !== false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCatalogProduct(id: string, data: Partial<Pick<CatalogProduct, "name" | "color" | "active">>) {
  await updateDoc(doc(db, "product_catalog", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteCatalogProduct(id: string) {
  await deleteDoc(doc(db, "product_catalog", id));
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export interface CrmTag {
  id: string;
  name: string;
  usageCount: number;
  createdAt: Date;
}

function tagKey(name: string) {
  return name.trim().toLowerCase();
}

export async function getTags(): Promise<CrmTag[]> {
  const snap = await getDocs(query(collection(db, "tags"), orderBy("name")));
  return snap.docs.map((d) => ({
    id: d.id,
    name: d.data().name as string,
    usageCount: (d.data().usageCount as number) || 0,
    createdAt: toDate(d.data().createdAt as Timestamp),
  }));
}

export async function ensureTag(name: string): Promise<CrmTag> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tag name required");
  const all = await getTags();
  const found = all.find((t) => tagKey(t.name) === tagKey(trimmed));
  if (found) return found;
  const ref = await addDoc(collection(db, "tags"), {
    name: trimmed,
    nameLower: tagKey(trimmed),
    usageCount: 0,
    createdAt: serverTimestamp(),
  });
  return { id: ref.id, name: trimmed, usageCount: 0, createdAt: new Date() };
}

export async function adjustTagUsage(tagName: string, delta: number) {
  const trimmed = tagName.trim();
  if (!trimmed || delta === 0) return;
  const tag = await ensureTag(trimmed);
  const next = Math.max(0, tag.usageCount + delta);
  await updateDoc(doc(db, "tags", tag.id), { usageCount: next });
}

export async function syncOpportunityTags(prev: string[], next: string[]) {
  const prevSet = new Set(prev.map((t) => t.trim()).filter(Boolean));
  const nextSet = new Set(next.map((t) => t.trim()).filter(Boolean));
  for (const t of nextSet) if (!prevSet.has(t)) await adjustTagUsage(t, 1);
  for (const t of prevSet) if (!nextSet.has(t)) await adjustTagUsage(t, -1);
}

export async function renameTag(id: string, newName: string) {
  const trimmed = newName.trim();
  const snap = await getDoc(doc(db, "tags", id));
  if (!snap.exists()) return;
  const oldName = snap.data().name as string;
  await updateDoc(doc(db, "tags", id), { name: trimmed, nameLower: tagKey(trimmed) });
  const opps = await getDocs(query(collection(db, "opportunities"), where("tags", "array-contains", oldName)));
  const batch = writeBatch(db);
  opps.docs.forEach((d) => {
    const tags = ((d.data().tags as string[]) || []).map((t) => (t === oldName ? trimmed : t));
    batch.update(d.ref, { tags, updatedAt: serverTimestamp() });
  });
  await batch.commit();
}

export async function mergeTags(sourceId: string, targetId: string) {
  const [src, tgt] = await Promise.all([getDoc(doc(db, "tags", sourceId)), getDoc(doc(db, "tags", targetId))]);
  if (!src.exists() || !tgt.exists()) throw new Error("Tag not found");
  const sourceName = src.data().name as string;
  const targetName = tgt.data().name as string;
  const opps = await getDocs(query(collection(db, "opportunities"), where("tags", "array-contains", sourceName)));
  const batch = writeBatch(db);
  let moved = 0;
  opps.docs.forEach((d) => {
    const tags = new Set(((d.data().tags as string[]) || []).map((t) => (t === sourceName ? targetName : t)));
    batch.update(d.ref, { tags: Array.from(tags), updatedAt: serverTimestamp() });
    moved += 1;
  });
  const tgtCount = ((tgt.data().usageCount as number) || 0) + moved;
  batch.update(doc(db, "tags", targetId), { usageCount: tgtCount });
  batch.delete(doc(db, "tags", sourceId));
  await batch.commit();
}

export async function cleanupDuplicateTags(): Promise<number> {
  const all = await getTags();
  const byLower = new Map<string, CrmTag[]>();
  for (const t of all) {
    const k = tagKey(t.name);
    const arr = byLower.get(k) || [];
    arr.push(t);
    byLower.set(k, arr);
  }
  let merged = 0;
  for (const group of byLower.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => b.usageCount - a.usageCount);
    const keep = group[0];
    for (let i = 1; i < group.length; i++) {
      await mergeTags(group[i].id, keep.id);
      merged += 1;
    }
  }
  return merged;
}

// ─── Opportunity Products + PoC ──────────────────────────────────────────────

export interface OpportunityProduct {
  id: string;
  opportunityId: string;
  productId: string;
  productName: string;
  color: string;
  requiresPoc: boolean;
  pocStatus: OppPocStatus;
  lastUpdatedAt: Date | null;
  lastUpdatedById?: string | null;
  lastUpdatedByName?: string | null;
}

export interface PocUpdate {
  id: string;
  status: OppPocStatus;
  note: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
  isAdminOverride?: boolean;
}

export async function getOpportunityProducts(opportunityId: string): Promise<OpportunityProduct[]> {
  const snap = await getDocs(collection(db, "opportunities", opportunityId, "products"));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      opportunityId,
      productId: data.productId as string,
      productName: data.productName as string,
      color: (data.color as string) || "#3B82F6",
      requiresPoc: !!data.requiresPoc,
      pocStatus: (data.pocStatus as OppPocStatus) || "NOT_STARTED",
      lastUpdatedAt: data.lastUpdatedAt ? toDate(data.lastUpdatedAt as Timestamp) : null,
      lastUpdatedById: (data.lastUpdatedById as string) || null,
      lastUpdatedByName: (data.lastUpdatedByName as string) || null,
    };
  });
}

export async function setOpportunityProducts(
  opportunityId: string,
  products: Omit<OpportunityProduct, "id" | "opportunityId" | "lastUpdatedAt" | "lastUpdatedById" | "lastUpdatedByName">[],
) {
  const existing = await getDocs(collection(db, "opportunities", opportunityId, "products"));
  const byCatalogId = new Map(existing.docs.map((d) => [d.data().productId as string, d]));
  const keep = new Set(products.map((p) => p.productId));
  const batch = writeBatch(db);

  for (const d of existing.docs) {
    if (!keep.has(d.data().productId as string)) {
      batch.delete(d.ref);
    }
  }

  for (const p of products) {
    const prev = byCatalogId.get(p.productId);
    if (prev) {
      batch.update(prev.ref, {
        productName: p.productName,
        color: p.color,
        requiresPoc: p.requiresPoc,
      });
    } else {
      const ref = doc(collection(db, "opportunities", opportunityId, "products"));
      batch.set(ref, {
        productId: p.productId,
        productName: p.productName,
        color: p.color,
        requiresPoc: p.requiresPoc,
        pocStatus: p.pocStatus || "NOT_STARTED",
        lastUpdatedAt: null,
        lastUpdatedById: null,
        lastUpdatedByName: null,
      });
    }
  }
  await batch.commit();
}

export async function addOpportunityProduct(
  opportunityId: string,
  product: { productId: string; productName: string; color: string; requiresPoc: boolean },
): Promise<string> {
  const ref = await addDoc(collection(db, "opportunities", opportunityId, "products"), {
    ...product,
    pocStatus: "NOT_STARTED",
    lastUpdatedAt: null,
    lastUpdatedById: null,
    lastUpdatedByName: null,
  });
  return ref.id;
}

export async function removeOpportunityProduct(opportunityId: string, productDocId: string) {
  const updates = await getDocs(collection(db, "opportunities", opportunityId, "products", productDocId, "updates"));
  const batch = writeBatch(db);
  updates.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "opportunities", opportunityId, "products", productDocId));
  await batch.commit();
}

export async function getPocUpdates(opportunityId: string, productDocId: string): Promise<PocUpdate[]> {
  const snap = await getDocs(
    query(collection(db, "opportunities", opportunityId, "products", productDocId, "updates"), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    status: d.data().status as OppPocStatus,
    note: d.data().note as string,
    authorId: d.data().authorId as string,
    authorName: d.data().authorName as string,
    createdAt: toDate(d.data().createdAt as Timestamp),
    isAdminOverride: !!d.data().isAdminOverride,
  }));
}

export async function addPocUpdate(
  opportunityId: string,
  productDocId: string,
  data: { status: OppPocStatus; note: string; authorId: string; authorName: string; isAdminOverride?: boolean },
) {
  await addDoc(collection(db, "opportunities", opportunityId, "products", productDocId, "updates"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "opportunities", opportunityId, "products", productDocId), {
    pocStatus: data.status,
    lastUpdatedAt: serverTimestamp(),
    lastUpdatedById: data.authorId,
    lastUpdatedByName: data.authorName,
  });
}

// ─── Audit events ────────────────────────────────────────────────────────────

export type OpportunityEventType =
  | "CREATED"
  | "CLOSED"
  | "STAGE_CHANGED"
  | "OWNER_CHANGED"
  | "CO_OWNER_CHANGED"
  | "PRODUCT_ADDED"
  | "PRODUCT_REMOVED"
  | "POC_UPDATED"
  | "MEETING_ADDED"
  | "TAGS_EDITED"
  | "FILE_UPLOADED"
  | "ADMIN_OVERRIDE"
  | "UPDATED";

export interface OpportunityEvent {
  id: string;
  opportunityId: string;
  type: OpportunityEventType;
  message: string;
  actorId: string;
  actorName: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

export async function logOpportunityEvent(
  opportunityId: string,
  event: Omit<OpportunityEvent, "id" | "opportunityId" | "createdAt">,
) {
  await addDoc(collection(db, "opportunities", opportunityId, "events"), {
    ...event,
    createdAt: serverTimestamp(),
  });
}

export async function getOpportunityEvents(opportunityId: string): Promise<OpportunityEvent[]> {
  const snap = await getDocs(
    query(collection(db, "opportunities", opportunityId, "events"), orderBy("createdAt", "desc"), limit(100)),
  );
  return snap.docs.map((d) => ({
    id: d.id,
    opportunityId,
    type: d.data().type as OpportunityEventType,
    message: d.data().message as string,
    actorId: d.data().actorId as string,
    actorName: d.data().actorName as string,
    meta: d.data().meta as Record<string, unknown> | undefined,
    createdAt: toDate(d.data().createdAt as Timestamp),
  }));
}

// ─── Meeting Notes ───────────────────────────────────────────────────────────

export type NotePermissionRole = "CREATOR" | "READER" | "COLLABORATOR";

export interface NotePermission {
  userId: string;
  userName: string;
  role: NotePermissionRole;
}

export interface MeetingNote {
  id: string;
  title: string;
  body: string;
  meetingDate?: Date | null;
  attendees: AssignedPerson[];
  nextSteps?: string;
  opportunityId?: string | null;
  opportunityTitle?: string | null;
  country?: string | null;
  createdById: string;
  createdByName: string;
  permissions: NotePermission[];
  createdAt: Date;
  updatedAt: Date;
}

export async function getMeetingNotes(filters?: {
  opportunityId?: string;
  country?: string;
  standalone?: boolean;
}): Promise<MeetingNote[]> {
  // Avoid composite indexes: filter with at most one equality, sort in memory.
  let snap;
  if (filters?.opportunityId) {
    snap = await getDocs(
      query(collection(db, "meeting_notes"), where("opportunityId", "==", filters.opportunityId)),
    );
  } else if (filters?.country) {
    snap = await getDocs(
      query(collection(db, "meeting_notes"), where("country", "==", filters.country)),
    );
  } else {
    snap = await getDocs(query(collection(db, "meeting_notes"), orderBy("updatedAt", "desc")));
  }
  let list = snap.docs.map(docToMeetingNote);
  list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  if (filters?.standalone) list = list.filter((n) => !n.opportunityId);
  if (filters?.country && filters?.opportunityId) {
    list = list.filter((n) => n.country === filters.country);
  }
  return list;
}

export async function getMeetingNote(id: string): Promise<MeetingNote | null> {
  const snap = await getDoc(doc(db, "meeting_notes", id));
  if (!snap.exists()) return null;
  return docToMeetingNote(snap);
}

function docToMeetingNote(snap: { id: string; data: () => Record<string, unknown> }): MeetingNote {
  const d = snap.data();
  return {
    id: snap.id,
    title: (d.title as string) || "",
    body: (d.body as string) || "",
    meetingDate: d.meetingDate ? toDate(d.meetingDate as Timestamp) : null,
    attendees: Array.isArray(d.attendees) ? (d.attendees as AssignedPerson[]) : [],
    nextSteps: (d.nextSteps as string) || "",
    opportunityId: (d.opportunityId as string) || null,
    opportunityTitle: (d.opportunityTitle as string) || null,
    country: (d.country as string) || null,
    createdById: (d.createdById as string) || "",
    createdByName: (d.createdByName as string) || "",
    permissions: Array.isArray(d.permissions) ? (d.permissions as NotePermission[]) : [],
    createdAt: toDate(d.createdAt as Timestamp),
    updatedAt: toDate(d.updatedAt as Timestamp),
  };
}

export async function createMeetingNote(
  data: Omit<MeetingNote, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, "meeting_notes"), {
    ...data,
    meetingDate: data.meetingDate ? Timestamp.fromDate(data.meetingDate) : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (data.opportunityId) {
    await logOpportunityEvent(data.opportunityId, {
      type: "MEETING_ADDED",
      message: `Meeting note "${data.title}" added`,
      actorId: data.createdById,
      actorName: data.createdByName,
      meta: { noteId: ref.id },
    });
  }
  return ref.id;
}

export async function updateMeetingNote(id: string, data: Partial<MeetingNote>) {
  const payload: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  delete payload.id;
  delete payload.createdAt;
  if (data.meetingDate !== undefined) {
    payload.meetingDate = data.meetingDate ? Timestamp.fromDate(data.meetingDate) : null;
  }
  await updateDoc(doc(db, "meeting_notes", id), payload);
}

export async function deleteMeetingNote(id: string) {
  await deleteDoc(doc(db, "meeting_notes", id));
}

export function canEditMeetingNote(note: MeetingNote, userId: string, isAdminUser: boolean): boolean {
  if (isAdminUser) return true;
  const perm = note.permissions.find((p) => p.userId === userId);
  if (!perm) return note.createdById === userId;
  return perm.role === "CREATOR" || perm.role === "COLLABORATOR";
}
