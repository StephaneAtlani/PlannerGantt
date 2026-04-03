/** États de la colonne « Progress » (export Microsoft Planner / liste déroulante). */

export type PlannerProgressStatus = "notStarted" | "inProgress" | "completed";

/** Couleurs volontairement contrastées : neutre / chaud / succès. */
export const PLANNER_PROGRESS_COLORS: Record<PlannerProgressStatus, string> = {
  notStarted: "#64748b",
  inProgress: "#ea580c",
  completed: "#16a34a",
};

export const PLANNER_PROGRESS_LABEL_FR: Record<PlannerProgressStatus, string> = {
  notStarted: "Pas commencé",
  inProgress: "En cours",
  completed: "Terminé",
};

function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`´]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NOT_STARTED = new Set([
  "not started",
  "notstarted",
  "pas commence",
  "pas commencé",
  "non commence",
  "a faire",
  "afaire",
  "todo",
  "to do",
  "not start",
]);

const IN_PROGRESS = new Set([
  "in progress",
  "inprogress",
  "en cours",
  "started",
  "commence",
  "commencé",
]);

const COMPLETED = new Set([
  "completed",
  "complete",
  "termine",
  "terminé",
  "terminee",
  "fini",
  "fait",
  "done",
  "closed",
  "achevé",
  "acheve",
]);

function statusFromNumber(p: number): PlannerProgressStatus {
  if (p <= 0) return "notStarted";
  if (p >= 100) return "completed";
  return "inProgress";
}

/**
 * Interprète la cellule Progress : texte Planner (Not started / In progress / Completed),
 * nombre ou pourcentage texte. Retourne un % pour la barre Gantt et un état discret si possible.
 */
export function parseProgressColumnValue(v: unknown): {
  progress?: number;
  progressStatus?: PlannerProgressStatus;
} {
  if (v === "" || v === null || v === undefined) return {};

  if (typeof v === "number" && !Number.isNaN(v)) {
    const p = Math.min(100, Math.max(0, v));
    return { progress: p, progressStatus: statusFromNumber(p) };
  }

  if (typeof v === "string") {
    const raw = v.trim();
    if (!raw) return {};

    const s = norm(raw);
    if (NOT_STARTED.has(s)) return { progress: 0, progressStatus: "notStarted" };
    if (IN_PROGRESS.has(s)) return { progress: 50, progressStatus: "inProgress" };
    if (COMPLETED.has(s)) return { progress: 100, progressStatus: "completed" };

    const stripped = raw.replace(/%/g, "").replace(",", ".").trim();
    const p = parseFloat(stripped);
    if (!Number.isNaN(p)) {
      const pr = Math.min(100, Math.max(0, p));
      return { progress: pr, progressStatus: statusFromNumber(pr) };
    }
  }

  return {};
}
