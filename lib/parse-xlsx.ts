import * as XLSX from "xlsx";
import { parseProgressColumnValue, type PlannerProgressStatus } from "@/lib/planner-progress";

export interface Task {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress?: number;
  /** État discret colonne Progress (Planner : pas commencé / en cours / terminé). */
  progressStatus?: PlannerProgressStatus;
  assignedTo?: string;
  bucketName?: string;
  priority?: string;
  labels?: string;
  createdBy?: string;
  createdAt?: Date;
  dueDate?: Date;
  isRecurring?: boolean;
  isLate?: boolean;
  completedAt?: Date;
  executedBy?: string;
  checklistDone?: string;
  checklistTotal?: string;
  description?: string;
}

const EXCEL_EPOCH = new Date(1899, 11, 30);

function excelSerialToDate(serial: number): Date {
  const utc = EXCEL_EPOCH.getTime() + serial * 86400000;
  return new Date(utc);
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    if (value > 100000) return excelSerialToDate(value);
    return new Date(value);
  }
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return null;
    // Supporte explicitement les formats FR les plus fréquents: jj/mm/aaaa et jj-mm-aaaa
    const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
      const hour = m[4] ? parseInt(m[4], 10) : 0;
      const minute = m[5] ? parseInt(m[5], 10) : 0;
      const d = new Date(year, month - 1, day, hour, minute);
      if (
        d.getFullYear() === year &&
        d.getMonth() === month - 1 &&
        d.getDate() === day
      ) {
        return d;
      }
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Colonnes du fichier "Retroplanning Certification" : Task Name, Start date, Due date, Progress
const NAME_KEYS = [
  "task name",
  "tâche",
  "task",
  "libellé",
  "libelle",
  "nom",
  "name",
  "titre",
  "title",
  "activité",
  "activite",
];
const START_KEYS = [
  "start date",
  "date début",
  "date debut",
  "début",
  "debut",
  "start",
  "date de début",
];
const END_KEYS = [
  "due date",
  "date fin",
  "fin",
  "end",
  "échéance",
  "echeance",
  "date de fin",
  "due",
];
const PROGRESS_KEYS = [
  "progress",
  "progression",
  "%",
  "avancement",
  "pourcentage",
  "complete",
];
const ID_KEYS = ["id de tache", "id tâche", "id tache", "task id", "id"];
const ASSIGNED_KEYS = ["attribue a", "attribué à", "assigned to", "assigné", "assignee", "responsable"];
const BUCKET_KEYS = ["nom du compartiment", "bucket name", "bucket", "catégorie", "categorie", "liste"];
const PRIORITY_KEYS = ["priority", "priorité", "priorite"];
const LABELS_KEYS = ["labels", "étiquettes", "etiquettes", "tags", "label"];
const CREATED_BY_KEYS = ["cree par", "créé par", "created by", "author"];
const CREATED_AT_KEYS = ["date de creation", "date de création", "created at", "creation date"];
const DUE_DATE_KEYS = ["date d echeance", "date d'échéance", "date d’échéance", "due date", "echeance", "échéance"];
const RECURRING_KEYS = ["est periodique", "est périodique", "periodique", "périodique", "is recurring", "recurring"];
const LATE_KEYS = ["en retard", "is late", "retard"];
const FINISH_KEYS = ["date de fin", "end date", "finish date", "completed at", "date completion"];
const EXECUTED_BY_KEYS = ["execute par", "exécuté par", "executed by", "done by"];
const CHECKLIST_DONE_KEYS = [
  "elements de la liste de controle effectues",
  "éléments de la liste de contrôle effectués",
  "checklist done",
  "done checklist items",
];
const CHECKLIST_TOTAL_KEYS = [
  "elements de la liste de controle",
  "éléments de la liste de contrôle",
  "checklist items",
  "checklist total",
];
const DESCRIPTION_KEYS = ["description", "details", "détails"];

function normalize(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`´]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toText(value: unknown): string | undefined {
  const s = String(value ?? "").trim();
  return s || undefined;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const s = normalize(value);
    if (!s) return undefined;
    if (["true", "vrai", "oui", "yes", "1"].includes(s)) return true;
    if (["false", "faux", "non", "no", "0"].includes(s)) return false;
  }
  return undefined;
}

function findColumnIndex(
  headers: string[],
  keys: string[][]
): number {
  const normalized = headers.map(normalize);
  for (const keyList of keys) {
    for (const key of keyList) {
      const i = normalized.findIndex((h) => h.includes(key) || key.includes(h));
      if (i >= 0) return i;
    }
  }
  return -1;
}

export function parseXlsxFile(file: File): Promise<Task[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || !(data instanceof ArrayBuffer)) {
          reject(new Error("Impossible de lire le fichier"));
          return;
        }
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        if (!firstSheet) {
          reject(new Error("Aucune feuille trouvée"));
          return;
        }
        const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
          header: 1,
          defval: "",
        });
        if (!rows.length) {
          reject(new Error("Fichier vide"));
          return;
        }
        const headers = (rows[0] as unknown[]).map((c) => String(c ?? ""));
        const idIdx = findColumnIndex(headers, [ID_KEYS]);
        const nameIdx = findColumnIndex(headers, [NAME_KEYS]);
        const startIdx = findColumnIndex(headers, [START_KEYS]);
        const endIdx = findColumnIndex(headers, [END_KEYS]);
        const progressIdx = findColumnIndex(headers, [PROGRESS_KEYS]);
        const assignedIdx = findColumnIndex(headers, [ASSIGNED_KEYS]);
        const bucketIdx = findColumnIndex(headers, [BUCKET_KEYS]);
        const priorityIdx = findColumnIndex(headers, [PRIORITY_KEYS]);
        const labelsIdx = findColumnIndex(headers, [LABELS_KEYS]);
        const createdByIdx = findColumnIndex(headers, [CREATED_BY_KEYS]);
        const createdAtIdx = findColumnIndex(headers, [CREATED_AT_KEYS]);
        const dueDateIdx = findColumnIndex(headers, [DUE_DATE_KEYS]);
        const recurringIdx = findColumnIndex(headers, [RECURRING_KEYS]);
        const lateIdx = findColumnIndex(headers, [LATE_KEYS]);
        const finishIdx = findColumnIndex(headers, [FINISH_KEYS]);
        const executedByIdx = findColumnIndex(headers, [EXECUTED_BY_KEYS]);
        const checklistDoneIdx = findColumnIndex(headers, [CHECKLIST_DONE_KEYS]);
        const checklistTotalIdx = findColumnIndex(headers, [CHECKLIST_TOTAL_KEYS]);
        const descriptionIdx = findColumnIndex(headers, [DESCRIPTION_KEYS]);

        if (nameIdx < 0 || startIdx < 0 || endIdx < 0) {
          reject(
            new Error(
              "Colonnes requises non trouvées. Attendu : Tâche/Nom, Date début, Date fin (première ligne = en-têtes)."
            )
          );
          return;
        }

        const tasks: Task[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as unknown[];
          const name = String(row[nameIdx] ?? "").trim();
          if (!name) continue;

          const start = toDate(row[startIdx]);
          const dueDate = dueDateIdx >= 0 ? toDate(row[dueDateIdx]) : null;
          const end = toDate(row[endIdx]) ?? dueDate;
          if (!start || !end || end < start) continue;

          let progress: number | undefined;
          let progressStatus: PlannerProgressStatus | undefined;
          if (progressIdx >= 0) {
            const parsed = parseProgressColumnValue(row[progressIdx]);
            if (parsed.progress !== undefined) progress = parsed.progress;
            if (parsed.progressStatus !== undefined) progressStatus = parsed.progressStatus;
          }

          const assignedTo = assignedIdx >= 0 ? toText(row[assignedIdx]) : undefined;
          const bucketName = bucketIdx >= 0 ? toText(row[bucketIdx]) : undefined;
          const priority = priorityIdx >= 0 ? toText(row[priorityIdx]) : undefined;
          const labels = labelsIdx >= 0 ? toText(row[labelsIdx]) : undefined;
          const createdBy = createdByIdx >= 0 ? toText(row[createdByIdx]) : undefined;
          const createdAt = createdAtIdx >= 0 ? toDate(row[createdAtIdx]) ?? undefined : undefined;
          const isRecurring = recurringIdx >= 0 ? toBoolean(row[recurringIdx]) : undefined;
          const isLate = lateIdx >= 0 ? toBoolean(row[lateIdx]) : undefined;
          const completedAt = finishIdx >= 0 ? toDate(row[finishIdx]) ?? undefined : undefined;
          const executedBy = executedByIdx >= 0 ? toText(row[executedByIdx]) : undefined;
          const checklistDone = checklistDoneIdx >= 0 ? toText(row[checklistDoneIdx]) : undefined;
          const checklistTotal = checklistTotalIdx >= 0 ? toText(row[checklistTotalIdx]) : undefined;
          const description = descriptionIdx >= 0 ? toText(row[descriptionIdx]) : undefined;
          const taskId = idIdx >= 0 ? toText(row[idIdx]) : undefined;

          tasks.push({
            id: taskId || `task-${i}`,
            name,
            start,
            end,
            progress,
            progressStatus,
            assignedTo,
            bucketName,
            priority,
            labels,
            createdBy,
            createdAt,
            dueDate: dueDate ?? undefined,
            isRecurring,
            isLate,
            completedAt,
            executedBy,
            checklistDone,
            checklistTotal,
            description,
          });
        }

        if (!tasks.length) {
          reject(new Error("Aucune tâche valide (vérifiez les dates et noms)."));
          return;
        }
        resolve(tasks);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Erreur de lecture Excel"));
      }
    };
    reader.onerror = () => reject(new Error("Erreur de lecture du fichier"));
    reader.readAsArrayBuffer(file);
  });
}
