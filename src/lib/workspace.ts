/**
 * Opportunity Workspace: stage gates + tasks for the Pulse / Tasks views.
 */
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, Timestamp, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AssignedPerson, Opportunity } from "./firestore";
import { differenceInCalendarDays, format } from "date-fns";

export type TaskLane = "Sales" | "Technical" | "Development";
export type TaskStatus = "todo" | "doing" | "blocked" | "done";
export type TaskSource = "internal" | "customer";
export type DueBucket = "over" | "today" | "soon" | "later" | "done";

export interface StageGate {
  id: string;
  text: string;
  done: boolean;
  ownerLabel: string;
}

export interface OpportunityTask {
  id: string;
  opportunityId: string;
  title: string;
  lane: TaskLane;
  responsible: AssignedPerson;
  assistants: AssignedPerson[];
  dueDate: Date | null;
  status: TaskStatus;
  source: TaskSource;
  createdById: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

function toDate(val: Timestamp | Date | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  return val;
}

export function parseStageGates(raw: unknown): StageGate[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((g, i) => {
    const row = g as Record<string, unknown>;
    return {
      id: String(row.id || `g${i}`),
      text: String(row.text || ""),
      done: !!row.done,
      ownerLabel: String(row.ownerLabel || ""),
    };
  }).filter((g) => g.text.trim());
}

export async function saveStageGates(opportunityId: string, gates: StageGate[]): Promise<void> {
  await updateDoc(doc(db, "opportunities", opportunityId), {
    stageGates: gates,
    updatedAt: serverTimestamp(),
  });
}

function docToTask(snap: { id: string; data: () => Record<string, unknown> }): OpportunityTask {
  const d = snap.data();
  const assistants = Array.isArray(d.assistants) ? (d.assistants as AssignedPerson[]) : [];
  return {
    id: snap.id,
    opportunityId: (d.opportunityId as string) || "",
    title: (d.title as string) || "",
    lane: (d.lane as TaskLane) || "Sales",
    responsible: (d.responsible as AssignedPerson) || { id: "", name: "" },
    assistants,
    dueDate: toDate(d.dueDate as Timestamp | null),
    status: (d.status as TaskStatus) || "todo",
    source: (d.source as TaskSource) || "internal",
    createdById: (d.createdById as string) || "",
    createdByName: (d.createdByName as string) || "",
    createdAt: toDate(d.createdAt as Timestamp) || new Date(),
    updatedAt: toDate(d.updatedAt as Timestamp) || new Date(),
  };
}

export async function getOpportunityTasks(opportunityId: string): Promise<OpportunityTask[]> {
  const snap = await getDocs(
    query(collection(db, "opportunity_tasks"), where("opportunityId", "==", opportunityId)),
  );
  const list = snap.docs.map(docToTask);
  list.sort((a, b) => {
    const ad = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bd = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return ad - bd;
  });
  return list;
}

export async function getOpenOpportunityTasks(): Promise<OpportunityTask[]> {
  const snap = await getDocs(collection(db, "opportunity_tasks"));
  return snap.docs.map(docToTask).filter((t) => t.status !== "done");
}

export async function createOpportunityTask(
  data: Omit<OpportunityTask, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, "opportunity_tasks"), {
    opportunityId: data.opportunityId,
    title: data.title,
    lane: data.lane,
    responsible: data.responsible,
    assistants: data.assistants,
    dueDate: data.dueDate ? Timestamp.fromDate(data.dueDate) : null,
    status: data.status,
    source: data.source,
    createdById: data.createdById,
    createdByName: data.createdByName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateOpportunityTask(
  id: string,
  data: Partial<Pick<OpportunityTask, "title" | "lane" | "responsible" | "assistants" | "dueDate" | "status" | "source">>,
): Promise<void> {
  const payload: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (data.dueDate !== undefined) {
    payload.dueDate = data.dueDate ? Timestamp.fromDate(data.dueDate) : null;
  }
  await updateDoc(doc(db, "opportunity_tasks", id), payload);
}

export async function deleteOpportunityTask(id: string): Promise<void> {
  await deleteDoc(doc(db, "opportunity_tasks", id));
}

export function taskDueBucket(task: OpportunityTask, today = new Date()): DueBucket {
  if (task.status === "done") return "done";
  if (!task.dueDate) return "later";
  const days = differenceInCalendarDays(task.dueDate, today);
  if (days < 0) return "over";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "later";
}

export function taskDueLabel(task: OpportunityTask, today = new Date()): string {
  if (task.status === "done") return "done";
  if (!task.dueDate) return "no due date";
  const days = differenceInCalendarDays(task.dueDate, today);
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} late`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `in ${days} days`;
}

export function overdueTaskCount(tasks: OpportunityTask[]): number {
  return tasks.filter((t) => taskDueBucket(t) === "over").length;
}

export type OppHealth = "ok" | "risk" | "hot";

export function opportunityHealth(opp: Opportunity, tasks: OpportunityTask[]): OppHealth {
  const overdue = overdueTaskCount(tasks);
  if (overdue >= 2) return "hot";
  if (overdue >= 1) return "risk";
  if (!opp.lastActivityDate) return "ok";
  const idle = differenceInCalendarDays(new Date(), opp.lastActivityDate);
  if (idle >= 11) return "hot";
  if (idle >= 7) return "risk";
  return "ok";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function fmtShortDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return format(d, "dd MMM");
}

export const TASK_LANES: TaskLane[] = ["Sales", "Technical", "Development"];
export const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "blocked", "done"];
