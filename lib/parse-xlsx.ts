import * as XLSX from "xlsx";

export interface Task {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress?: number;
  assignedTo?: string;
  bucketName?: string;
  priority?: string;
  labels?: string;
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
    const d = new Date(value);
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
const ASSIGNED_KEYS = ["assigned to", "assigné", "assignee", "responsable"];
const BUCKET_KEYS = ["bucket name", "bucket", "catégorie", "categorie", "liste"];
const PRIORITY_KEYS = ["priority", "priorité", "priorite"];
const LABELS_KEYS = ["labels", "étiquettes", "etiquettes", "tags", "label"];

function normalize(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .trim();
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
        const nameIdx = findColumnIndex(headers, [NAME_KEYS]);
        const startIdx = findColumnIndex(headers, [START_KEYS]);
        const endIdx = findColumnIndex(headers, [END_KEYS]);
        const progressIdx = findColumnIndex(headers, [PROGRESS_KEYS]);
        const assignedIdx = findColumnIndex(headers, [ASSIGNED_KEYS]);
        const bucketIdx = findColumnIndex(headers, [BUCKET_KEYS]);
        const priorityIdx = findColumnIndex(headers, [PRIORITY_KEYS]);
        const labelsIdx = findColumnIndex(headers, [LABELS_KEYS]);

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
          const end = toDate(row[endIdx]);
          if (!start || !end || end < start) continue;

          let progress: number | undefined;
          if (progressIdx >= 0) {
            const v = row[progressIdx];
            if (typeof v === "number") progress = Math.min(100, Math.max(0, v));
            else if (typeof v === "string") {
              const s = v.trim().toLowerCase();
              if (s === "not started" || s === "pas commencé" || s === "") progress = 0;
              else {
                const p = parseFloat(v.replace(",", "."));
                if (!isNaN(p)) progress = Math.min(100, Math.max(0, p));
              }
            }
          }

          const assignedTo = assignedIdx >= 0 ? String(row[assignedIdx] ?? "").trim() || undefined : undefined;
          const bucketName = bucketIdx >= 0 ? String(row[bucketIdx] ?? "").trim() || undefined : undefined;
          const priority = priorityIdx >= 0 ? String(row[priorityIdx] ?? "").trim() || undefined : undefined;
          const labels = labelsIdx >= 0 ? String(row[labelsIdx] ?? "").trim() || undefined : undefined;

          tasks.push({
            id: `task-${i}`,
            name,
            start,
            end,
            progress,
            assignedTo,
            bucketName,
            priority,
            labels,
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
