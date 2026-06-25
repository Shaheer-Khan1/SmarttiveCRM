import {
  collection, doc, getDocs, getDoc, getDocFromServer, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp, serverTimestamp, writeBatch,
  limit, setDoc, type QueryConstraint,
} from "firebase/firestore";
import { db, storage, auth } from "./firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER";
  createdAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  industry?: string;
  country?: string;
  city?: string;
  contact?: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignedPerson {
  id: string;
  name: string;
}

export interface Opportunity {
  id: string;
  title: string;
  customerId: string;
  customerName: string;
  status: "ACTIVE" | "WON" | "LOST" | "ON_HOLD";
  holdReason?: string;
  solution?: string;
  value?: number | null;
  currency?: string;
  nextStep?: string;
  notes?: string;
  tags: string[];
  assignedTo: AssignedPerson[];
  initiatedById?: string;
  initiatedByName?: string;
  lastActivityDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Comment {
  id: string;
  opportunityId: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
}

export interface Activity {
  id: string;
  opportunityId: string;
  type: string;
  date: Date;
  summary: string;
  notes?: string;
  createdById?: string;
  createdByName?: string;
  attachments?: FileAttachment[];
  createdAt: Date;
}

export interface FileAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType?: string;
  opportunityId?: string;
  activityId?: string;
  createdAt: Date;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDate(val: Timestamp | Date | null | undefined): Date {
  if (!val) return new Date();
  if (val instanceof Timestamp) return val.toDate();
  return val;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDocFromServer(doc(db, "users", uid));
    if (!snap.exists()) return null;

    // JSON roundtrip forces Firebase's internal proxy/getter into a true plain object.
    // Timestamps are handled separately via the replacer.
    const raw = snap.data();
    const jsonStr = JSON.stringify(raw, (_, val) => {
      // Convert Firestore Timestamps to ISO string so they survive JSON
      if (val && typeof val === "object" && "seconds" in val && "nanoseconds" in val) {
        return new Date(val.seconds * 1000).toISOString();
      }
      return val;
    });
    const data = JSON.parse(jsonStr) as Record<string, string>;

    return {
      id: snap.id,
      name: data.name ?? "",
      email: data.email ?? "",
      role: (data.role as "ADMIN" | "MANAGER") ?? "ADMIN",
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
    };
  } catch (err) {
    console.error("[getUserProfile] Error:", err);
    return null;
  }
}

export async function getUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, "users"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as UserProfile));
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>) {
  await updateDoc(doc(db, "users", uid), data);
}

export async function deleteUserProfile(uid: string) {
  await deleteDoc(doc(db, "users", uid));
}

// ─── Customers ───────────────────────────────────────────────────────────────

export async function getCustomers(): Promise<Customer[]> {
  const snap = await getDocs(query(collection(db, "customers"), orderBy("name")));
  return snap.docs.map((d) => ({
    id: d.id, ...d.data(),
    createdAt: toDate(d.data().createdAt),
    updatedAt: toDate(d.data().updatedAt),
  } as Customer));
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const snap = await getDoc(doc(db, "customers", id));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { id: snap.id, ...d, createdAt: toDate(d.createdAt), updatedAt: toDate(d.updatedAt) } as Customer;
}

export async function createCustomer(data: Omit<Customer, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const ref = await addDoc(collection(db, "customers"), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCustomer(id: string, data: Partial<Customer>) {
  await updateDoc(doc(db, "customers", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteCustomer(id: string) {
  await deleteDoc(doc(db, "customers", id));
}

// ─── Opportunities ────────────────────────────────────────────────────────────

export async function getOpportunities(filters?: { status?: string; customerId?: string }): Promise<Opportunity[]> {
  const constraints: QueryConstraint[] = [orderBy("updatedAt", "desc")];
  if (filters?.status && filters.status !== "ALL") constraints.unshift(where("status", "==", filters.status));
  if (filters?.customerId) constraints.unshift(where("customerId", "==", filters.customerId));
  const snap = await getDocs(query(collection(db, "opportunities"), ...constraints));
  return snap.docs.map(docToOpportunity);
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const snap = await getDoc(doc(db, "opportunities", id));
  if (!snap.exists()) return null;
  return docToOpportunity(snap);
}

function docToOpportunity(snap: { id: string; data: () => Record<string, unknown> }): Opportunity {
  const d = snap.data();
  // Migrate legacy single-assign fields to the assignedTo array format
  let assignedTo: AssignedPerson[] = [];
  if (Array.isArray(d.assignedTo)) {
    assignedTo = d.assignedTo as AssignedPerson[];
  } else if (d.assignedToId && d.assignedToName) {
    assignedTo = [{ id: d.assignedToId as string, name: d.assignedToName as string }];
  }
  return {
    id: snap.id,
    ...d,
    assignedTo,
    tags: Array.isArray(d.tags) ? d.tags : [],
    lastActivityDate: d.lastActivityDate ? toDate(d.lastActivityDate as Timestamp) : null,
    createdAt: toDate(d.createdAt as Timestamp),
    updatedAt: toDate(d.updatedAt as Timestamp),
  } as Opportunity;
}

export async function createOpportunity(data: Omit<Opportunity, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const ref = await addDoc(collection(db, "opportunities"), {
    ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateOpportunity(id: string, data: Partial<Opportunity>) {
  await updateDoc(doc(db, "opportunities", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteOpportunity(id: string) {
  const [actSnap, commentSnap] = await Promise.all([
    getDocs(query(collection(db, "activities"), where("opportunityId", "==", id))),
    getDocs(collection(db, "opportunities", id, "comments")),
  ]);
  const batch = writeBatch(db);
  actSnap.docs.forEach((d) => batch.delete(d.ref));
  commentSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "opportunities", id));
  await batch.commit();
}

// ─── Activities ───────────────────────────────────────────────────────────────

export async function getActivities(opportunityId: string): Promise<Activity[]> {
  const snap = await getDocs(
    query(collection(db, "activities"), where("opportunityId", "==", opportunityId), orderBy("date", "desc"))
  );
  return snap.docs.map(docToActivity);
}

function docToActivity(snap: { id: string; data: () => Record<string, unknown> }): Activity {
  const d = snap.data();
  return {
    id: snap.id,
    ...d,
    date: toDate(d.date as Timestamp),
    createdAt: toDate(d.createdAt as Timestamp),
    attachments: (d.attachments || []) as FileAttachment[],
  } as Activity;
}

export async function createActivity(data: {
  opportunityId: string;
  type: string;
  date: Date;
  summary: string;
  notes?: string;
}): Promise<string> {
  const user = auth.currentUser;
  const userProfile = user ? await getUserProfile(user.uid) : null;

  const ref = await addDoc(collection(db, "activities"), {
    ...data,
    date: Timestamp.fromDate(data.date),
    createdById: user?.uid || "",
    createdByName: userProfile?.name || "Unknown",
    attachments: [],
    createdAt: serverTimestamp(),
  });

  // Update opportunity's lastActivityDate
  await updateDoc(doc(db, "opportunities", data.opportunityId), {
    lastActivityDate: Timestamp.fromDate(data.date),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function deleteActivity(id: string, opportunityId: string) {
  await deleteDoc(doc(db, "activities", id));

  // Recalculate lastActivityDate
  const snap = await getDocs(
    query(collection(db, "activities"), where("opportunityId", "==", opportunityId), orderBy("date", "desc"), limit(1))
  );
  const lastDate = snap.docs[0]?.data().date || null;
  await updateDoc(doc(db, "opportunities", opportunityId), {
    lastActivityDate: lastDate,
    updatedAt: serverTimestamp(),
  });
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getComments(opportunityId: string): Promise<Comment[]> {
  const snap = await getDocs(
    query(collection(db, "opportunities", opportunityId, "comments"), orderBy("createdAt", "asc"))
  );
  return snap.docs.map((d) => ({
    id: d.id,
    opportunityId,
    text: d.data().text as string,
    authorId: d.data().authorId as string,
    authorName: d.data().authorName as string,
    createdAt: toDate(d.data().createdAt as Timestamp),
  }));
}

export async function addComment(opportunityId: string, text: string, authorId: string, authorName: string): Promise<string> {
  const ref = await addDoc(collection(db, "opportunities", opportunityId, "comments"), {
    text, authorId, authorName, createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteComment(opportunityId: string, commentId: string): Promise<void> {
  await deleteDoc(doc(db, "opportunities", opportunityId, "comments", commentId));
}

// ─── File Upload ──────────────────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  opportunityId: string,
  activityId?: string
): Promise<FileAttachment> {
  const path = `uploads/${opportunityId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  const attachment: FileAttachment = {
    id: `${Date.now()}`,
    name: path,
    url,
    size: file.size,
    mimeType: file.type,
    opportunityId,
    activityId,
    createdAt: new Date(),
  };

  if (activityId) {
    // Add to activity attachments array
    const actSnap = await getDoc(doc(db, "activities", activityId));
    const existing = (actSnap.data()?.attachments || []) as FileAttachment[];
    await updateDoc(doc(db, "activities", activityId), {
      attachments: [...existing, { ...attachment, originalName: file.name }],
    });
  }

  return { ...attachment, name: file.name };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR MODULE
// ═══════════════════════════════════════════════════════════════════════════════

export type RecurrenceFreq = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface ReminderSettings {
  enabled: boolean;
  minutesBefore: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  allDay?: boolean;
  recurrence: RecurrenceFreq;
  recurrenceEndDate?: Date | null;
  attendees: AssignedPerson[];
  createdById: string;
  createdByName: string;
  relatedProjectId?: string | null;
  relatedProjectName?: string | null;
  reminder: ReminderSettings;
  status: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
  createdAt: Date;
}

function docToCalendarEvent(snap: { id: string; data: () => Record<string, unknown> }): CalendarEvent {
  const d = snap.data();
  return {
    id: snap.id,
    title: (d.title as string) || "",
    description: d.description as string | undefined,
    startDate: toDate(d.startDate as Timestamp),
    endDate: toDate(d.endDate as Timestamp),
    allDay: Boolean(d.allDay),
    recurrence: (d.recurrence as RecurrenceFreq) || "NONE",
    recurrenceEndDate: d.recurrenceEndDate ? toDate(d.recurrenceEndDate as Timestamp) : null,
    attendees: Array.isArray(d.attendees) ? (d.attendees as AssignedPerson[]) : [],
    createdById: (d.createdById as string) || "",
    createdByName: (d.createdByName as string) || "",
    relatedProjectId: (d.relatedProjectId as string) || null,
    relatedProjectName: (d.relatedProjectName as string) || null,
    reminder: (d.reminder as ReminderSettings) || { enabled: false, minutesBefore: 30 },
    status: (d.status as CalendarEvent["status"]) || "CONFIRMED",
    createdAt: toDate(d.createdAt as Timestamp),
  };
}

/** Admins see all events. Other users see events they created or are an attendee of. */
export async function getCalendarEvents(opts?: { userId?: string; isAdmin?: boolean }): Promise<CalendarEvent[]> {
  const snap = await getDocs(query(collection(db, "calendar_events"), orderBy("startDate", "asc")));
  let events = snap.docs.map(docToCalendarEvent);
  if (opts && !opts.isAdmin && opts.userId) {
    events = events.filter(
      (e) => e.createdById === opts.userId || e.attendees.some((a) => a.id === opts.userId)
    );
  }
  return events;
}

export async function createCalendarEvent(
  data: Omit<CalendarEvent, "id" | "createdAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "calendar_events"), {
    ...data,
    startDate: Timestamp.fromDate(data.startDate),
    endDate: Timestamp.fromDate(data.endDate),
    recurrenceEndDate: data.recurrenceEndDate ? Timestamp.fromDate(data.recurrenceEndDate) : null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCalendarEvent(id: string, data: Partial<CalendarEvent>): Promise<void> {
  const payload: Record<string, unknown> = { ...data };
  if (data.startDate) payload.startDate = Timestamp.fromDate(data.startDate);
  if (data.endDate) payload.endDate = Timestamp.fromDate(data.endDate);
  if (data.recurrenceEndDate !== undefined)
    payload.recurrenceEndDate = data.recurrenceEndDate ? Timestamp.fromDate(data.recurrenceEndDate) : null;
  await updateDoc(doc(db, "calendar_events", id), payload);
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await deleteDoc(doc(db, "calendar_events", id));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCT RESEARCH TRACKING MODULE
// ═══════════════════════════════════════════════════════════════════════════════

export type ProductType = "SOFTWARE" | "HARDWARE";
export type ProductPriority = "LOW" | "MEDIUM" | "HIGH";
export type ProductStatus =
  | "RESEARCH_STARTED"
  | "IN_PROGRESS"
  | "POC_ONGOING"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "INTEGRATED";

/** Research maturity ladder: L1 Discovery → L6 Production Adopted */
export type MaturityLevel = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";

/** PoC lifecycle stage: PoC-1 Concept Validation → PoC-6 Production Decision */
export type PocStage = "PoC-1" | "PoC-2" | "PoC-3" | "PoC-4" | "PoC-5" | "PoC-6";

export interface EvaluationScore {
  criterion: string;
  weight: number;
  score: number;
}

export type CompatibilityStatus = "COMPATIBLE" | "PARTIAL" | "INCOMPATIBLE" | "UNKNOWN";

export interface CompatibilityEntry {
  item: string;
  status: CompatibilityStatus;
  notes?: string;
}

export interface Vendor {
  id: string;
  name: string;
  website?: string;
  contactInfo?: string;
  supportEmail?: string;
  notes?: string;
  createdAt: Date;
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  category?: string;
  vendorId?: string | null;
  vendorName?: string | null;
  version?: string;
  website?: string;
  documentationLinks: string[];
  features: string[];
  specifications: string[];
  integrationComplexity?: string;
  supportedApis: string[];
  dependencies: string[];
  compatibility?: string;
  licenseType?: string;
  pricing?: string;
  supportInfo?: string;
  subscriptionDetails?: string;
  pros: string[];
  cons: string[];
  risks: string[];
  limitations: string[];
  comparisonNotes?: string;
  developmentStatus?: string;
  integrationStatus?: string;
  assignedDeveloperId?: string | null;
  assignedDeveloperName?: string | null;
  reviewerId?: string | null;
  reviewerName?: string | null;
  priority?: ProductPriority;
  notes?: string;
  status: ProductStatus;
  maturityLevel: MaturityLevel;
  scores: EvaluationScore[];
  compatibilityMatrix: CompatibilityEntry[];
  createdById: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductPOC {
  id: string;
  productId: string;
  ownerId?: string;
  owner: string;
  stage: PocStage;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  findings?: string;
  recommendations?: string;
  attachments: FileAttachment[];
  createdAt: Date;
}

export interface ProductComment {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  comment: string;
  createdAt: Date;
}

export interface ProductDocument {
  id: string;
  productId: string;
  documentName: string;
  fileUrl: string;
  storagePath: string;
  size?: number;
  uploadedById: string;
  uploadedByName: string;
  createdAt: Date;
}

export interface ActivityLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedById: string;
  performedByName: string;
  timestamp: Date;
  oldValue?: string;
  newValue?: string;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

// ─── Vendors ───────────────────────────────────────────────────────────────────

export async function getVendors(): Promise<Vendor[]> {
  const snap = await getDocs(query(collection(db, "vendors"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) } as Vendor));
}

export async function getVendor(id: string): Promise<Vendor | null> {
  const snap = await getDoc(doc(db, "vendors", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data(), createdAt: toDate(snap.data()!.createdAt) } as Vendor;
}

export async function createVendor(data: Omit<Vendor, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(collection(db, "vendors"), { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateVendor(id: string, data: Partial<Vendor>): Promise<void> {
  await updateDoc(doc(db, "vendors", id), data);
}

export async function deleteVendor(id: string): Promise<void> {
  await deleteDoc(doc(db, "vendors", id));
}

// ─── Products ──────────────────────────────────────────────────────────────────

function docToProduct(snap: { id: string; data: () => Record<string, unknown> }): Product {
  const d = snap.data();
  return {
    id: snap.id,
    name: (d.name as string) || "",
    type: (d.type as ProductType) || "SOFTWARE",
    category: d.category as string | undefined,
    vendorId: (d.vendorId as string) || null,
    vendorName: (d.vendorName as string) || null,
    version: d.version as string | undefined,
    website: d.website as string | undefined,
    documentationLinks: arr(d.documentationLinks),
    features: arr(d.features),
    specifications: arr(d.specifications),
    integrationComplexity: d.integrationComplexity as string | undefined,
    supportedApis: arr(d.supportedApis),
    dependencies: arr(d.dependencies),
    compatibility: d.compatibility as string | undefined,
    licenseType: d.licenseType as string | undefined,
    pricing: d.pricing as string | undefined,
    supportInfo: d.supportInfo as string | undefined,
    subscriptionDetails: d.subscriptionDetails as string | undefined,
    pros: arr(d.pros),
    cons: arr(d.cons),
    risks: arr(d.risks),
    limitations: arr(d.limitations),
    comparisonNotes: d.comparisonNotes as string | undefined,
    developmentStatus: d.developmentStatus as string | undefined,
    integrationStatus: d.integrationStatus as string | undefined,
    assignedDeveloperId: (d.assignedDeveloperId as string) || null,
    assignedDeveloperName: (d.assignedDeveloperName as string) || null,
    reviewerId: (d.reviewerId as string) || null,
    reviewerName: (d.reviewerName as string) || null,
    priority: (d.priority as ProductPriority) || "MEDIUM",
    notes: d.notes as string | undefined,
    status: (d.status as ProductStatus) || "RESEARCH_STARTED",
    maturityLevel: (d.maturityLevel as MaturityLevel) || "L1",
    scores: Array.isArray(d.scores) ? (d.scores as EvaluationScore[]) : [],
    compatibilityMatrix: Array.isArray(d.compatibilityMatrix) ? (d.compatibilityMatrix as CompatibilityEntry[]) : [],
    createdById: (d.createdById as string) || "",
    createdByName: (d.createdByName as string) || "",
    createdAt: toDate(d.createdAt as Timestamp),
    updatedAt: toDate(d.updatedAt as Timestamp),
  };
}

export interface ProductFilters {
  type?: ProductType;
  vendorId?: string;
  category?: string;
  status?: ProductStatus;
  assignedUserId?: string;
}

export async function getProducts(filters?: ProductFilters): Promise<Product[]> {
  const snap = await getDocs(query(collection(db, "products"), orderBy("updatedAt", "desc")));
  let products = snap.docs.map(docToProduct);
  if (filters?.type) products = products.filter((p) => p.type === filters.type);
  if (filters?.vendorId) products = products.filter((p) => p.vendorId === filters.vendorId);
  if (filters?.category) products = products.filter((p) => p.category === filters.category);
  if (filters?.status) products = products.filter((p) => p.status === filters.status);
  if (filters?.assignedUserId)
    products = products.filter(
      (p) => p.assignedDeveloperId === filters.assignedUserId || p.reviewerId === filters.assignedUserId
    );
  return products;
}

export async function getProduct(id: string): Promise<Product | null> {
  const snap = await getDoc(doc(db, "products", id));
  if (!snap.exists()) return null;
  return docToProduct(snap);
}

export async function createProduct(
  data: Omit<Product, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, "products"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await logActivity({
    entityType: "product",
    entityId: ref.id,
    action: "Created product",
    performedById: data.createdById,
    performedByName: data.createdByName,
    newValue: data.name,
  });
  return ref.id;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  await updateDoc(doc(db, "products", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteProduct(id: string): Promise<void> {
  const [pocSnap, commentSnap, docSnap] = await Promise.all([
    getDocs(query(collection(db, "product_pocs"), where("productId", "==", id))),
    getDocs(query(collection(db, "product_comments"), where("productId", "==", id))),
    getDocs(query(collection(db, "product_documents"), where("productId", "==", id))),
  ]);
  const batch = writeBatch(db);
  pocSnap.docs.forEach((d) => batch.delete(d.ref));
  commentSnap.docs.forEach((d) => batch.delete(d.ref));
  docSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "products", id));
  await batch.commit();
}

// ─── Product POCs ────────────────────────────────────────────────────────────

export async function getProductPOCs(productId: string): Promise<ProductPOC[]> {
  const snap = await getDocs(query(collection(db, "product_pocs"), where("productId", "==", productId)));
  return snap.docs
    .map((d) => ({
      id: d.id,
      productId,
      ownerId: d.data().ownerId as string | undefined,
      owner: (d.data().owner as string) || "",
      stage: (d.data().stage as PocStage) || "PoC-1",
      status: (d.data().status as ProductPOC["status"]) || "NOT_STARTED",
      findings: d.data().findings as string | undefined,
      recommendations: d.data().recommendations as string | undefined,
      attachments: (d.data().attachments || []) as FileAttachment[],
      createdAt: toDate(d.data().createdAt as Timestamp),
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** All POCs across products — used by dashboard aggregations. */
export async function getAllPOCs(): Promise<ProductPOC[]> {
  const snap = await getDocs(collection(db, "product_pocs"));
  return snap.docs.map((d) => ({
    id: d.id,
    productId: (d.data().productId as string) || "",
    ownerId: d.data().ownerId as string | undefined,
    owner: (d.data().owner as string) || "",
    stage: (d.data().stage as PocStage) || "PoC-1",
    status: (d.data().status as ProductPOC["status"]) || "NOT_STARTED",
    findings: d.data().findings as string | undefined,
    recommendations: d.data().recommendations as string | undefined,
    attachments: (d.data().attachments || []) as FileAttachment[],
    createdAt: toDate(d.data().createdAt as Timestamp),
  }));
}

export async function createProductPOC(
  data: Omit<ProductPOC, "id" | "createdAt">,
  performedBy: { id: string; name: string }
): Promise<string> {
  const ref = await addDoc(collection(db, "product_pocs"), { ...data, createdAt: serverTimestamp() });
  await logActivity({
    entityType: "poc",
    entityId: data.productId,
    action: "Created POC",
    performedById: performedBy.id,
    performedByName: performedBy.name,
    newValue: data.owner,
  });
  return ref.id;
}

export async function updateProductPOC(id: string, data: Partial<ProductPOC>): Promise<void> {
  await updateDoc(doc(db, "product_pocs", id), data);
}

export async function deleteProductPOC(id: string): Promise<void> {
  await deleteDoc(doc(db, "product_pocs", id));
}

// ─── Product Comments ────────────────────────────────────────────────────────

export async function getProductComments(productId: string): Promise<ProductComment[]> {
  const snap = await getDocs(query(collection(db, "product_comments"), where("productId", "==", productId)));
  return snap.docs
    .map((d) => ({
      id: d.id,
      productId,
      userId: (d.data().userId as string) || "",
      userName: (d.data().userName as string) || "",
      comment: (d.data().comment as string) || "",
      createdAt: toDate(d.data().createdAt as Timestamp),
    }))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export async function addProductComment(
  productId: string,
  comment: string,
  userId: string,
  userName: string
): Promise<string> {
  const ref = await addDoc(collection(db, "product_comments"), {
    productId, comment, userId, userName, createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteProductComment(id: string): Promise<void> {
  await deleteDoc(doc(db, "product_comments", id));
}

// ─── Product Documents ─────────────────────────────────────────────────────────

export async function getProductDocuments(productId: string): Promise<ProductDocument[]> {
  const snap = await getDocs(query(collection(db, "product_documents"), where("productId", "==", productId)));
  return snap.docs
    .map((d) => ({
      id: d.id,
      productId,
      documentName: (d.data().documentName as string) || "",
      fileUrl: (d.data().fileUrl as string) || "",
      storagePath: (d.data().storagePath as string) || "",
      size: d.data().size as number | undefined,
      uploadedById: (d.data().uploadedById as string) || "",
      uploadedByName: (d.data().uploadedByName as string) || "",
      createdAt: toDate(d.data().createdAt as Timestamp),
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function uploadProductDocument(
  file: File,
  productId: string,
  uploadedBy: { id: string; name: string }
): Promise<ProductDocument> {
  const storagePath = `products/${productId}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const fileUrl = await getDownloadURL(storageRef);
  const docRef = await addDoc(collection(db, "product_documents"), {
    productId,
    documentName: file.name,
    fileUrl,
    storagePath,
    size: file.size,
    uploadedById: uploadedBy.id,
    uploadedByName: uploadedBy.name,
    createdAt: serverTimestamp(),
  });
  return {
    id: docRef.id, productId, documentName: file.name, fileUrl, storagePath,
    size: file.size, uploadedById: uploadedBy.id, uploadedByName: uploadedBy.name, createdAt: new Date(),
  };
}

export async function deleteProductDocument(docId: string, storagePath: string): Promise<void> {
  try {
    if (storagePath) await deleteObject(ref(storage, storagePath));
  } catch {
    // file may already be gone; continue removing the metadata
  }
  await deleteDoc(doc(db, "product_documents", docId));
}

// ─── Activity Logs (Audit Trail) ───────────────────────────────────────────────

export async function logActivity(entry: Omit<ActivityLog, "id" | "timestamp">): Promise<void> {
  await addDoc(collection(db, "activity_logs"), {
    ...entry,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    timestamp: serverTimestamp(),
  });
}

export async function getActivityLogs(filters?: { entityType?: string; entityId?: string }): Promise<ActivityLog[]> {
  const constraints = [];
  if (filters?.entityType) constraints.push(where("entityType", "==", filters.entityType));
  if (filters?.entityId) constraints.push(where("entityId", "==", filters.entityId));
  const snap = await getDocs(query(collection(db, "activity_logs"), ...constraints));
  return snap.docs
    .map((d) => ({
      id: d.id,
      entityType: (d.data().entityType as string) || "",
      entityId: (d.data().entityId as string) || "",
      action: (d.data().action as string) || "",
      performedById: (d.data().performedById as string) || "",
      performedByName: (d.data().performedByName as string) || "",
      timestamp: toDate(d.data().timestamp as Timestamp),
      oldValue: (d.data().oldValue as string) || undefined,
      newValue: (d.data().newValue as string) || undefined,
    }))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// ─── Notifications ─────────────────────────────────────────────────────────────

export async function createNotification(
  recipientIds: string[],
  title: string,
  body?: string,
  link?: string
): Promise<void> {
  const unique = [...new Set(recipientIds.filter(Boolean))];
  if (unique.length === 0) return;
  const batch = writeBatch(db);
  for (const recipientId of unique) {
    const nRef = doc(collection(db, "notifications"));
    batch.set(nRef, {
      recipientId,
      title,
      body: body ?? null,
      link: link ?? null,
      read: false,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const snap = await getDocs(query(collection(db, "notifications"), where("recipientId", "==", userId)));
  return snap.docs
    .map((d) => ({
      id: d.id,
      recipientId: (d.data().recipientId as string) || "",
      title: (d.data().title as string) || "",
      body: (d.data().body as string) || undefined,
      link: (d.data().link as string) || undefined,
      read: Boolean(d.data().read),
      createdAt: toDate(d.data().createdAt as Timestamp),
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, "notifications"), where("recipientId", "==", userId), where("read", "==", false))
  );
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardData() {
  const [oppSnap, custSnap, actSnap] = await Promise.all([
    getDocs(query(collection(db, "opportunities"), orderBy("updatedAt", "desc"))),
    getDocs(collection(db, "customers")),
    getDocs(query(collection(db, "activities"), orderBy("date", "desc"), limit(500))),
  ]);

  const opportunities = oppSnap.docs.map(docToOpportunity);
  const activities = actSnap.docs.map(docToActivity);
  const totalCustomers = custSnap.size;

  return { opportunities, activities, totalCustomers };
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchAll(q: string): Promise<{
  customers: Customer[];
  opportunities: Opportunity[];
  activities: Activity[];
}> {
  const qLower = q.toLowerCase();

  const [custSnap, oppSnap, actSnap] = await Promise.all([
    getDocs(collection(db, "customers")),
    getDocs(collection(db, "opportunities")),
    getDocs(query(collection(db, "activities"), orderBy("date", "desc"), limit(200))),
  ]);

  const customers = custSnap.docs
    .map((d) => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt), updatedAt: toDate(d.data().updatedAt) } as Customer))
    .filter((c) =>
      [c.name, c.industry, c.country, c.city, c.notes].some((f) => f?.toLowerCase().includes(qLower))
    );

  const opportunities = oppSnap.docs
    .map(docToOpportunity)
    .filter((o) =>
      [o.title, o.solution, o.notes, o.nextStep, o.customerName, o.tags.join(" ")].some((f) => f?.toLowerCase().includes(qLower))
    );

  const activities = actSnap.docs
    .map(docToActivity)
    .filter((a) =>
      [a.summary, a.notes, a.type].some((f) => f?.toLowerCase().includes(qLower))
    );

  return { customers: customers.slice(0, 10), opportunities: opportunities.slice(0, 20), activities: activities.slice(0, 20) };
}

// ─── Demo Data Deletion ───────────────────────────────────────────────────────

const DEMO_CUSTOMER_NAMES = ["KFUPM", "Saudi Aramco", "Ministry of Communications"];
const DEMO_VENDOR_NAMES = ["Genetec", "Milestone Systems", "Axis Communications", "Dell Technologies"];
const DEMO_PRODUCT_NAMES = [
  "Genetec Security Center",
  "Milestone XProtect",
  "Axis P3265-LVE Camera",
  "Dell PowerEdge R760 Server",
  "OrcaTwin Digital Twin",
];

export interface DemoDeletionResult {
  customers: number;
  opportunities: number;
  activities: number;
  products: number;
  vendors: number;
  events: number;
}

export async function deleteDemoData(): Promise<DemoDeletionResult> {
  const result: DemoDeletionResult = { customers: 0, opportunities: 0, activities: 0, products: 0, vendors: 0, events: 0 };
  const refsToDelete: import("firebase/firestore").DocumentReference[] = [];

  // CRM demo data
  const custSnap = await getDocs(query(collection(db, "customers"), where("name", "in", DEMO_CUSTOMER_NAMES)));
  const customerIds = custSnap.docs.map((d) => d.id);
  result.customers = custSnap.docs.length;
  custSnap.docs.forEach((d) => refsToDelete.push(d.ref));

  if (customerIds.length > 0) {
    const oppSnap = await getDocs(query(collection(db, "opportunities"), where("customerId", "in", customerIds)));
    const opportunityIds = oppSnap.docs.map((d) => d.id);
    result.opportunities = oppSnap.docs.length;
    oppSnap.docs.forEach((d) => refsToDelete.push(d.ref));

    for (let i = 0; i < opportunityIds.length; i += 10) {
      const chunk = opportunityIds.slice(i, i + 10);
      const actSnap = await getDocs(query(collection(db, "activities"), where("opportunityId", "in", chunk)));
      result.activities += actSnap.docs.length;
      actSnap.docs.forEach((d) => refsToDelete.push(d.ref));
    }
  }

  // Product research demo data (products + their POCs / comments / documents)
  const prodSnap = await getDocs(query(collection(db, "products"), where("name", "in", DEMO_PRODUCT_NAMES)));
  const productIds = prodSnap.docs.map((d) => d.id);
  result.products = prodSnap.docs.length;
  prodSnap.docs.forEach((d) => refsToDelete.push(d.ref));

  for (let i = 0; i < productIds.length; i += 10) {
    const chunk = productIds.slice(i, i + 10);
    const [pocSnap, commentSnap, docSnap, logSnap] = await Promise.all([
      getDocs(query(collection(db, "product_pocs"), where("productId", "in", chunk))),
      getDocs(query(collection(db, "product_comments"), where("productId", "in", chunk))),
      getDocs(query(collection(db, "product_documents"), where("productId", "in", chunk))),
      getDocs(query(collection(db, "activity_logs"), where("entityId", "in", chunk))),
    ]);
    [pocSnap, commentSnap, docSnap, logSnap].forEach((s) => s.docs.forEach((d) => refsToDelete.push(d.ref)));
  }

  // Demo vendors
  const vendorSnap = await getDocs(query(collection(db, "vendors"), where("name", "in", DEMO_VENDOR_NAMES)));
  result.vendors = vendorSnap.docs.length;
  vendorSnap.docs.forEach((d) => refsToDelete.push(d.ref));

  // Demo calendar events (tagged with isDemo)
  const eventSnap = await getDocs(query(collection(db, "calendar_events"), where("isDemo", "==", true)));
  result.events = eventSnap.docs.length;
  eventSnap.docs.forEach((d) => refsToDelete.push(d.ref));

  for (let i = 0; i < refsToDelete.length; i += 500) {
    const b = writeBatch(db);
    for (const r of refsToDelete.slice(i, i + 500)) b.delete(r);
    await b.commit();
  }

  return result;
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

export async function seedDemoData(adminUid: string, adminName: string) {
  const batch = writeBatch(db);
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  // Customers
  const kfupmRef = doc(collection(db, "customers"));
  batch.set(kfupmRef, { name: "KFUPM", industry: "Higher Education", country: "Saudi Arabia", city: "Dhahran", contact: "Dr. Ahmed Al-Rashid", email: "procurement@kfupm.edu.sa", notes: "King Fahd University of Petroleum & Minerals", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  const aramcoRef = doc(collection(db, "customers"));
  batch.set(aramcoRef, { name: "Saudi Aramco", industry: "Oil & Gas", country: "Saudi Arabia", city: "Dhahran", contact: "Mohammed Al-Ghamdi", notes: "Major prospect – large infrastructure projects", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  const mocRef = doc(collection(db, "customers"));
  batch.set(mocRef, { name: "Ministry of Communications", industry: "Government", country: "Saudi Arabia", city: "Riyadh", contact: "Eng. Khalid Al-Otaibi", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  await batch.commit();

  // Opportunities
  const psimRef = doc(collection(db, "opportunities"));
  const adminPerson = { id: adminUid, name: adminName };
  await setDoc(psimRef, { title: "PSIM + OrcaTwin Platform", customerId: kfupmRef.id, customerName: "KFUPM", status: "ACTIVE", solution: "PSIM, OrcaTwin Digital Twin", assignedTo: [adminPerson], nextStep: "Submit technical proposal after completing PoC demo", tags: ["Chand", "Mitesh"], notes: "KFUPM campus security integration project. High priority.", value: 850000, currency: "SAR", lastActivityDate: Timestamp.fromDate(daysAgo(2)), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  const parkingRef = doc(collection(db, "opportunities"));
  await setDoc(parkingRef, { title: "Smart Parking System", customerId: kfupmRef.id, customerName: "KFUPM", status: "ACTIVE", solution: "Smart Parking Management", assignedTo: [adminPerson], nextStep: "Follow up with facilities team on site survey date", tags: ["Abu Saud"], value: 320000, currency: "SAR", lastActivityDate: Timestamp.fromDate(daysAgo(6)), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  const videoRef = doc(collection(db, "opportunities"));
  await setDoc(videoRef, { title: "Video Compression Solution", customerId: kfupmRef.id, customerName: "KFUPM", status: "ON_HOLD", holdReason: "Budget freeze until Q3 2026 – customer to revisit after internal review", solution: "Video Compression", assignedTo: [adminPerson], tags: ["Chand"], value: 175000, currency: "SAR", lastActivityDate: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  const aramcoOppRef = doc(collection(db, "opportunities"));
  await setDoc(aramcoOppRef, { title: "Perimeter Surveillance & Analytics", customerId: aramcoRef.id, customerName: "Saudi Aramco", status: "ACTIVE", solution: "AI Video Analytics, Perimeter Security", assignedTo: [adminPerson], nextStep: "Prepare ROI report requested by security director", tags: ["Mitesh", "Chand"], value: 2400000, currency: "SAR", lastActivityDate: Timestamp.fromDate(daysAgo(9)), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  const mocOppRef = doc(collection(db, "opportunities"));
  await setDoc(mocOppRef, { title: "Network Monitoring Platform", customerId: mocRef.id, customerName: "Ministry of Communications", status: "WON", solution: "NOC Platform, Network Analytics", assignedTo: [adminPerson], tags: ["Chand", "Abu Saud"], value: 680000, currency: "SAR", lastActivityDate: Timestamp.fromDate(daysAgo(15)), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  // Activities
  const activities = [
    { opportunityId: psimRef.id, type: "MEETING", date: daysAgo(2), summary: "Technical presentation to KFUPM IT department", notes: "Presented OrcaTwin demo to 8 stakeholders. Very positive feedback." },
    { opportunityId: psimRef.id, type: "DEMO", date: daysAgo(8), summary: "Live PoC demonstration of PSIM integration", notes: "Connected live camera feeds. Client impressed with response time." },
    { opportunityId: psimRef.id, type: "CALL", date: daysAgo(14), summary: "Initial discovery call with procurement team", notes: "Confirmed budget availability. Timeline: implementation by end of 2026." },
    { opportunityId: parkingRef.id, type: "EMAIL", date: daysAgo(6), summary: "Sent parking system brochure and case studies", notes: "Attached 3 case studies from GCC universities." },
    { opportunityId: parkingRef.id, type: "MEETING", date: daysAgo(20), summary: "Site visit to assess parking areas", notes: "Counted 1,200 parking spots across 4 zones." },
    { opportunityId: aramcoOppRef.id, type: "PROPOSAL", date: daysAgo(9), summary: "Submitted technical and commercial proposal", notes: "Total value: 2.4M SAR. Includes hardware, software, and 3-year support." },
    { opportunityId: aramcoOppRef.id, type: "MEETING", date: daysAgo(25), summary: "Requirements workshop with Aramco security team", notes: "Covered 47 requirements." },
    { opportunityId: mocOppRef.id, type: "OTHER", date: daysAgo(15), summary: "Contract signed and PO received", notes: "Project kickoff scheduled for next week." },
  ];

  const actBatch = writeBatch(db);
  for (const act of activities) {
    const actRef = doc(collection(db, "activities"));
    actBatch.set(actRef, { ...act, date: Timestamp.fromDate(act.date), createdById: adminUid, createdByName: adminName, attachments: [], createdAt: serverTimestamp() });
  }
  await actBatch.commit();

  await seedCalendarAndProductData(adminUid, adminName);
}

// ─── Calendar + Product Research seed ───────────────────────────────────────────

async function seedCalendarAndProductData(adminUid: string, adminName: string) {
  const now = new Date();
  const at = (dayOffset: number, hour: number, minute = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const adminPerson = { id: adminUid, name: adminName };

  // ── Calendar events ──
  const events = [
    {
      title: "Weekly Sales Standup", description: "Pipeline review with the team.",
      start: at(1, 9, 30), end: at(1, 10, 0), allDay: false,
      recurrence: "WEEKLY" as const, reminder: { enabled: true, minutesBefore: 30 },
    },
    {
      title: "KFUPM PoC Demo", description: "Live OrcaTwin demonstration on campus.",
      start: at(3, 13, 0), end: at(3, 15, 0), allDay: false,
      recurrence: "NONE" as const, reminder: { enabled: true, minutesBefore: 60 },
    },
    {
      title: "Aramco ROI Report — due", description: "Submit ROI report to security director.",
      start: at(5, 0, 0), end: at(5, 23, 59), allDay: true,
      recurrence: "NONE" as const, reminder: { enabled: true, minutesBefore: 1440 },
    },
    {
      title: "Vendor call: Genetec", description: "Licensing & roadmap discussion.",
      start: at(2, 16, 0), end: at(2, 16, 45), allDay: false,
      recurrence: "NONE" as const, reminder: { enabled: true, minutesBefore: 10 },
    },
  ];

  const evBatch = writeBatch(db);
  for (const e of events) {
    const evRef = doc(collection(db, "calendar_events"));
    evBatch.set(evRef, {
      title: e.title, description: e.description,
      startDate: Timestamp.fromDate(e.start), endDate: Timestamp.fromDate(e.end), allDay: e.allDay,
      recurrence: e.recurrence, recurrenceEndDate: null,
      attendees: [adminPerson],
      createdById: adminUid, createdByName: adminName,
      relatedProjectId: null, relatedProjectName: null,
      reminder: e.reminder, status: "CONFIRMED", isDemo: true,
      createdAt: serverTimestamp(),
    });
  }
  await evBatch.commit();

  // ── Vendors ──
  const vendorBatch = writeBatch(db);
  const genetecRef = doc(collection(db, "vendors"));
  vendorBatch.set(genetecRef, { name: "Genetec", website: "https://www.genetec.com", supportEmail: "support@genetec.com", contactInfo: "EMEA Partner Desk", notes: "Unified security platform vendor.", createdAt: serverTimestamp() });
  const milestoneRef = doc(collection(db, "vendors"));
  vendorBatch.set(milestoneRef, { name: "Milestone Systems", website: "https://www.milestonesys.com", supportEmail: "support@milestone.com", contactInfo: "", notes: "Open-platform VMS.", createdAt: serverTimestamp() });
  const axisRef = doc(collection(db, "vendors"));
  vendorBatch.set(axisRef, { name: "Axis Communications", website: "https://www.axis.com", supportEmail: "support@axis.com", contactInfo: "Gulf distributor", notes: "Network camera manufacturer.", createdAt: serverTimestamp() });
  const dellRef = doc(collection(db, "vendors"));
  vendorBatch.set(dellRef, { name: "Dell Technologies", website: "https://www.dell.com", supportEmail: "proSupport@dell.com", contactInfo: "", notes: "Server & infrastructure hardware.", createdAt: serverTimestamp() });
  await vendorBatch.commit();

  // ── Products ──
  const productBase = {
    documentationLinks: [] as string[], features: [] as string[], specifications: [] as string[],
    supportedApis: [] as string[], dependencies: [] as string[],
    pros: [] as string[], cons: [] as string[], risks: [] as string[], limitations: [] as string[],
    assignedDeveloperId: null as string | null, assignedDeveloperName: null as string | null,
    reviewerId: null as string | null, reviewerName: null as string | null,
    maturityLevel: "L1" as MaturityLevel,
    scores: [] as EvaluationScore[],
    compatibilityMatrix: [] as CompatibilityEntry[],
    createdById: adminUid, createdByName: adminName,
  };

  const products: { ref: ReturnType<typeof doc>; data: Record<string, unknown> }[] = [];

  const genetec = doc(collection(db, "products"));
  products.push({ ref: genetec, data: {
    ...productBase, name: "Genetec Security Center", type: "SOFTWARE", category: "VMS / PSIM",
    vendorId: genetecRef.id, vendorName: "Genetec", version: "5.12", website: "https://www.genetec.com/products/unified-security/security-center",
    documentationLinks: ["https://techdocs.genetec.com"],
    features: ["Unified video + access control", "Map-based monitoring", "Cloud archiving", "Privacy protector"],
    specifications: ["Windows Server 2019/2022", "SQL Server backend"],
    integrationComplexity: "Medium", supportedApis: ["REST", "WebSDK"], dependencies: ["SQL Server", ".NET"],
    compatibility: "ONVIF Profile S/T/G",
    licenseType: "Per-camera + SMA", pricing: "~USD 120 / camera channel", supportInfo: "24/7 Advantage plan", subscriptionDetails: "Annual SMA",
    pros: ["Mature unified platform", "Strong partner ecosystem"], cons: ["Higher TCO", "Windows-only server"],
    risks: ["Vendor lock-in"], limitations: ["No native Linux server"], comparisonNotes: "Strongest fit for large campus deployments.",
    developmentStatus: "Evaluation", integrationStatus: "Not started", priority: "HIGH", notes: "Primary candidate for KFUPM PSIM.",
    status: "UNDER_REVIEW", maturityLevel: "L4",
    scores: [
      { criterion: "Feature fit", weight: 5, score: 5 },
      { criterion: "Integration effort", weight: 4, score: 3 },
      { criterion: "Total cost of ownership", weight: 4, score: 2 },
      { criterion: "Vendor support", weight: 3, score: 5 },
    ],
    compatibilityMatrix: [
      { item: "Windows Server 2022", status: "COMPATIBLE" },
      { item: "ONVIF cameras", status: "COMPATIBLE" },
      { item: "Linux server", status: "INCOMPATIBLE", notes: "Windows-only backend" },
      { item: "OrcaTwin integration", status: "PARTIAL", notes: "Via WebSDK" },
    ],
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  } });

  const milestone = doc(collection(db, "products"));
  products.push({ ref: milestone, data: {
    ...productBase, name: "Milestone XProtect", type: "SOFTWARE", category: "VMS",
    vendorId: milestoneRef.id, vendorName: "Milestone Systems", version: "2024 R2", website: "https://www.milestonesys.com",
    features: ["Open platform", "Large device support", "Smart Client"],
    integrationComplexity: "Low", supportedApis: ["MIP SDK", "REST"],
    licenseType: "Device licenses", pricing: "Tiered (Essential/Express/Corporate)",
    pros: ["Open architecture", "Wide camera support"], cons: ["UI dated in places"],
    priority: "MEDIUM", developmentStatus: "Evaluation",
    status: "IN_PROGRESS", maturityLevel: "L2",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  } });

  const axisCam = doc(collection(db, "products"));
  products.push({ ref: axisCam, data: {
    ...productBase, name: "Axis P3265-LVE Camera", type: "HARDWARE", category: "IP Camera",
    vendorId: axisRef.id, vendorName: "Axis Communications", version: "P3265-LVE", website: "https://www.axis.com",
    features: ["2 MP", "Lightfinder 2.0", "Forensic WDR", "IK10 vandal resistant"],
    specifications: ["1/2.8\" sensor", "PoE", "-40°C to 60°C", "IP66/IK10"],
    integrationComplexity: "Low", supportedApis: ["ONVIF", "VAPIX"], dependencies: ["PoE switch"],
    compatibility: "ONVIF Profile S/G/T",
    licenseType: "Hardware purchase", pricing: "~USD 650 / unit", supportInfo: "5-year warranty",
    pros: ["Excellent low-light", "Rugged build"], cons: ["Premium price"],
    risks: ["Lead time on bulk orders"], priority: "HIGH",
    developmentStatus: "PoC", integrationStatus: "Bench testing",
    status: "POC_ONGOING", maturityLevel: "L4",
    scores: [
      { criterion: "Image quality", weight: 5, score: 5 },
      { criterion: "Durability", weight: 4, score: 5 },
      { criterion: "Price", weight: 3, score: 2 },
    ],
    compatibilityMatrix: [
      { item: "PoE+ switch", status: "COMPATIBLE" },
      { item: "Genetec VMS", status: "COMPATIBLE" },
      { item: "Milestone VMS", status: "COMPATIBLE" },
    ],
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  } });

  const dellServer = doc(collection(db, "products"));
  products.push({ ref: dellServer, data: {
    ...productBase, name: "Dell PowerEdge R760 Server", type: "HARDWARE", category: "Server",
    vendorId: dellRef.id, vendorName: "Dell Technologies", version: "R760", website: "https://www.dell.com",
    features: ["Dual 4th Gen Xeon", "Up to 8TB DDR5", "NVMe storage"],
    specifications: ["2U rack", "Redundant PSU", "iDRAC9"],
    integrationComplexity: "Low", pricing: "~USD 9,500 configured", supportInfo: "ProSupport Plus 5yr",
    pros: ["Reliable", "Great support"], cons: ["Power/cooling needs"],
    priority: "MEDIUM", developmentStatus: "Approved for procurement", integrationStatus: "Planned",
    status: "APPROVED", maturityLevel: "L5",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  } });

  const orcatwin = doc(collection(db, "products"));
  products.push({ ref: orcatwin, data: {
    ...productBase, name: "OrcaTwin Digital Twin", type: "SOFTWARE", category: "Digital Twin",
    vendorId: null, vendorName: null, version: "2.0",
    features: ["3D site modelling", "Live sensor overlay", "Incident playback"],
    integrationComplexity: "High", supportedApis: ["REST", "WebSocket"],
    pros: ["Differentiator in bids", "In-house control"], cons: ["Requires GPU compute"],
    priority: "HIGH", developmentStatus: "In production", integrationStatus: "Integrated with PSIM",
    status: "INTEGRATED", maturityLevel: "L6",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  } });

  const prodBatch = writeBatch(db);
  for (const p of products) prodBatch.set(p.ref, p.data);
  await prodBatch.commit();

  // ── POCs ──
  const pocBatch = writeBatch(db);
  pocBatch.set(doc(collection(db, "product_pocs")), {
    productId: axisCam.id, owner: adminName, ownerId: adminUid, stage: "PoC-4", status: "IN_PROGRESS",
    findings: "Low-light performance excellent at 0.1 lux; WDR handles backlit entrances well.",
    recommendations: "Proceed to pilot on 4 perimeter gates.", attachments: [], createdAt: serverTimestamp(),
  });
  pocBatch.set(doc(collection(db, "product_pocs")), {
    productId: genetec.id, owner: adminName, ownerId: adminUid, stage: "PoC-5", status: "COMPLETED",
    findings: "Unified workflow validated with 8 stakeholders.",
    recommendations: "Shortlist for KFUPM. Request formal quote.", attachments: [], createdAt: serverTimestamp(),
  });
  await pocBatch.commit();

  // ── Comments ──
  const cmtBatch = writeBatch(db);
  cmtBatch.set(doc(collection(db, "product_comments")), {
    productId: genetec.id, userId: adminUid, userName: adminName,
    comment: "Pricing is high but the unified platform offsets integration effort.", createdAt: serverTimestamp(),
  });
  cmtBatch.set(doc(collection(db, "product_comments")), {
    productId: axisCam.id, userId: adminUid, userName: adminName,
    comment: "Confirmed PoE budget on the new switches before bulk order.", createdAt: serverTimestamp(),
  });
  await cmtBatch.commit();

  // ── Activity log seed ──
  await logActivity({ entityType: "product", entityId: genetec.id, action: "Changed status", performedById: adminUid, performedByName: adminName, oldValue: "In Progress", newValue: "Under Review" });
  await logActivity({ entityType: "product", entityId: axisCam.id, action: "Created POC", performedById: adminUid, performedByName: adminName, newValue: adminName });
}
