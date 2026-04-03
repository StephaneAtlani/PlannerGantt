/** États de la colonne « Progress » (texte métier Excel / Planner). */

export type PlannerProgressStatus =
  | "notStarted"
  | "todo"
  | "blocked"
  | "inProgress"
  | "transmittedForValidation"
  | "toValidate"
  | "completed"
  | "done";

/** Ordre d’affichage légende (cohérent avec le workflow). */
export const PLANNER_PROGRESS_ORDER: PlannerProgressStatus[] = [
  "notStarted",
  "todo",
  "blocked",
  "inProgress",
  "transmittedForValidation",
  "toValidate",
  "completed",
  "done",
];

/**
 * Couleurs fixes par statut — jamais réutilisées dans les palettes Gantt (bucket, etc.).
 * Chaque état a une teinte différente (gris / violet / bleu / orange / rose / rouge / verts distincts).
 */
export const PLANNER_PROGRESS_COLORS: Record<PlannerProgressStatus, string> = {
  notStarted: "#64748b",
  todo: "#9333ea",
  blocked: "#2563eb",
  inProgress: "#ea580c",
  transmittedForValidation: "#eab308",
  toValidate: "#dc2626",
  completed: "#15803d",
  done: "#0d9488",
};

export const PLANNER_PROGRESS_LABEL_FR: Record<PlannerProgressStatus, string> = {
  notStarted: "Pas commencé",
  todo: "À faire",
  blocked: "Bloqué",
  inProgress: "En cours",
  transmittedForValidation: "Transmis direction pour validation",
  toValidate: "À valider",
  completed: "Terminé",
  done: "Fini",
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

function matchesBlocked(s: string): boolean {
  return s.includes("bloque") || s.includes("blocked");
}

/** « Transmis … direction » : testé avant « en cours » pour éviter toute confusion. */
function matchesTransmittedForValidation(s: string): boolean {
  return s.includes("transmis") && s.includes("direction");
}

function matchesToValidate(s: string): boolean {
  return s.includes("a valider") || s.includes("to validate");
}

const NOT_STARTED = new Set([
  "not started",
  "notstarted",
  "pas commence",
  "pas commencé",
  "non commence",
  "not start",
]);

/** « À faire » = todo (violet), pas confondu avec « pas commencé ». */
const TODO = new Set([
  "a faire",
  "afaire",
  "todo",
  "to do",
  "tache a faire",
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
  "achevé",
  "acheve",
  "fait",
  "done",
  "closed",
]);

const DONE_FINI = new Set(["fini"]);

function statusFromNumber(p: number): PlannerProgressStatus {
  if (p <= 0) return "notStarted";
  if (p >= 100) return "completed";
  return "inProgress";
}

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

    if (matchesBlocked(s)) return { progress: 25, progressStatus: "blocked" };
    if (matchesTransmittedForValidation(s)) {
      return { progress: 65, progressStatus: "transmittedForValidation" };
    }
    if (matchesToValidate(s)) return { progress: 72, progressStatus: "toValidate" };

    if (TODO.has(s)) return { progress: 8, progressStatus: "todo" };
    if (NOT_STARTED.has(s)) return { progress: 0, progressStatus: "notStarted" };

    if (DONE_FINI.has(s)) return { progress: 100, progressStatus: "done" };
    if (COMPLETED.has(s)) return { progress: 100, progressStatus: "completed" };

    if (IN_PROGRESS.has(s)) return { progress: 50, progressStatus: "inProgress" };

    const stripped = raw.replace(/%/g, "").replace(",", ".").trim();
    const p = parseFloat(stripped);
    if (!Number.isNaN(p)) {
      const pr = Math.min(100, Math.max(0, p));
      return { progress: pr, progressStatus: statusFromNumber(pr) };
    }
  }

  return {};
}

/** Si le texte (bucket, priorité, etc.) est un libellé de statut Progress connu → couleur fixe (évite collisions de hash). */
export function barColorForProgressLikeText(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const { progressStatus } = parseProgressColumnValue(raw);
  if (!progressStatus) return undefined;
  return PLANNER_PROGRESS_COLORS[progressStatus];
}
