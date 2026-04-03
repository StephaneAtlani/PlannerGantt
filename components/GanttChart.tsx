"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Task } from "@/lib/parse-xlsx";
import {
  PLANNER_PROGRESS_COLORS,
  PLANNER_PROGRESS_LABEL_FR,
  type PlannerProgressStatus,
} from "@/lib/planner-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type GanttViewMode = "Day" | "Week" | "Month";

export interface GanttDisplayOptions {
  showAssignments?: boolean;
  showPriority?: boolean;
  showBucket?: boolean;
  showLabels?: boolean;
  showProgress?: boolean;
  colorBy?: "bucket" | "priority" | "assignedTo" | "progress" | "none";
  paletteTheme?: "default" | "pastel" | "contrast" | "earth";
}

const PALETTES: Record<
  NonNullable<GanttDisplayOptions["paletteTheme"]>,
  string[]
> = {
  default: [
    "#2563eb",
    "#c026d3",
    "#dc2626",
    "#ea580c",
    "#ca8a04",
    "#16a34a",
    "#0d9488",
    "#7c3aed",
  ],
  pastel: [
    "#93c5fd",
    "#e879f9",
    "#fca5a5",
    "#fdba74",
    "#fde047",
    "#86efac",
    "#5eead4",
    "#c4b5fd",
  ],
  contrast: [
    "#1d4ed8",
    "#a21caf",
    "#b91c1c",
    "#c2410c",
    "#a16207",
    "#15803d",
    "#0f766e",
    "#6d28d9",
  ],
  earth: [
    "#854d0e",
    "#b45309",
    "#9a3412",
    "#166534",
    "#155e75",
    "#1e3a8a",
    "#6b21a8",
    "#831843",
  ],
};

function barColorFromKey(
  key: string | undefined,
  paletteTheme: NonNullable<GanttDisplayOptions["paletteTheme"]> = "default"
): string | undefined {
  if (!key) return undefined;
  const palette = PALETTES[paletteTheme] ?? PALETTES.default;
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0;
  return palette[n % palette.length];
}

/** Couleur barre selon la colonne Progress (%) — dégradé dans la palette de la thématique (faible → élevé). */
function progressToPaletteColor(
  progress: number,
  paletteTheme: NonNullable<GanttDisplayOptions["paletteTheme"]>
): string {
  const palette = PALETTES[paletteTheme] ?? PALETTES.default;
  const t = Math.max(0, Math.min(100, progress)) / 100;
  const idx = Math.round(t * (palette.length - 1));
  return palette[idx];
}

interface GanttTaskPayload {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  progressStatus?: PlannerProgressStatus;
  assignedTo?: string;
  bucketName?: string;
  priority?: string;
  labels?: string;
  createdBy?: string;
  createdAt?: string;
  dueDate?: string;
  isRecurring?: boolean;
  isLate?: boolean;
  completedAt?: string;
  executedBy?: string;
  checklistDone?: string;
  checklistTotal?: string;
  description?: string;
  originalName?: string;
  color?: string;
  color_progress?: string;
}

function buildTaskDisplayName(t: Task, opts: GanttDisplayOptions): string {
  const parts: string[] = [t.name];
  const extras: string[] = [];
  if (opts.showProgress) {
    if (t.progressStatus) extras.push(PLANNER_PROGRESS_LABEL_FR[t.progressStatus]);
    else if (t.progress !== undefined) extras.push(`${Math.round(t.progress)}%`);
  }
  if (opts.showAssignments && t.assignedTo) extras.push(t.assignedTo);
  if (opts.showPriority && t.priority) extras.push(t.priority);
  if (opts.showBucket && t.bucketName) extras.push(t.bucketName);
  if (opts.showLabels && t.labels) extras.push(t.labels);
  if (extras.length) parts.push(extras.join(" · "));
  return parts.join(" — ");
}

function toGanttTask(t: Task, displayOptions: GanttDisplayOptions): GanttTaskPayload {
  const progress = Math.round(t.progress ?? 0);
  const colorBy = displayOptions.colorBy ?? "bucket";
  const paletteTheme = displayOptions.paletteTheme ?? "default";
  const colorKey =
    colorBy === "bucket"
      ? t.bucketName
      : colorBy === "priority"
        ? t.priority
        : colorBy === "assignedTo"
          ? t.assignedTo
          : undefined;
  const barColor =
    colorBy === "progress"
      ? t.progressStatus
        ? PLANNER_PROGRESS_COLORS[t.progressStatus]
        : progressToPaletteColor(progress, paletteTheme)
      : colorBy === "none"
        ? undefined
        : barColorFromKey(colorKey, paletteTheme);
  return {
    id: t.id,
    name: buildTaskDisplayName(t, displayOptions),
    originalName: t.name,
    start: format(t.start, "yyyy-MM-dd"),
    end: format(t.end, "yyyy-MM-dd"),
    progress,
    progressStatus: t.progressStatus,
    assignedTo: t.assignedTo,
    bucketName: t.bucketName,
    priority: t.priority,
    labels: t.labels,
    createdBy: t.createdBy,
    createdAt: t.createdAt ? format(t.createdAt, "yyyy-MM-dd") : undefined,
    dueDate: t.dueDate ? format(t.dueDate, "yyyy-MM-dd") : undefined,
    isRecurring: t.isRecurring,
    isLate: t.isLate,
    completedAt: t.completedAt ? format(t.completedAt, "yyyy-MM-dd") : undefined,
    executedBy: t.executedBy,
    checklistDone: t.checklistDone,
    checklistTotal: t.checklistTotal,
    description: t.description,
    color: barColor,
    color_progress: barColor ? `${barColor}99` : undefined,
  };
}

const LABEL_SEP = " — ";
const META_SEP = " · ";
const LABEL_COLORS = ["var(--gantt-assignment)", "var(--gantt-priority)", "var(--gantt-bucket)", "var(--gantt-labels)"] as const;

/** Colorise le nom + affectation (bleu), priorité (orange), bucket (vert), étiquettes (violet) — barres et colonne gauche (.bar-label.big) */
function colorBarLabels(container: HTMLElement) {
  container.querySelectorAll<SVGTextElement>(".bar-label").forEach((textEl) => {
    if (textEl.querySelector("tspan")) return; // déjà traité
    const full = (textEl.textContent ?? "").trim();
    if (!full) return;
    const idx = full.indexOf(LABEL_SEP);
    const name = idx >= 0 ? full.slice(0, idx).trim() : full;
    const meta = idx >= 0 ? full.slice(idx + LABEL_SEP.length).trim() : "";
    textEl.textContent = "";
    const tspanName = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    tspanName.setAttribute("fill", "var(--g-text-dark)");
    tspanName.textContent = name;
    textEl.appendChild(tspanName);
    if (!meta) return;
    const parts = meta.split(META_SEP).map((s) => s.trim()).filter(Boolean);
    parts.forEach((part, i) => {
      const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      tspan.setAttribute("fill", LABEL_COLORS[Math.min(i, LABEL_COLORS.length - 1)]);
      tspan.textContent = (i === 0 ? LABEL_SEP : META_SEP) + part;
      textEl.appendChild(tspan);
    });
  });
}

const BAR_LABEL_PADDING = 6;

/** Force le texte des barres à droite (fin de la barre + padding). */
function forceBarLabelsRight(container: HTMLElement) {
  container.querySelectorAll(".bar-wrapper").forEach((wrapper) => {
    const barGroup = wrapper.querySelector(".bar-group");
    const bar = barGroup?.querySelector<SVGRectElement>("rect.bar");
    const label = wrapper.querySelector<SVGTextElement>(".bar-label");
    if (!bar || !label) return;
    const bbox = bar.getBBox();
    const endX = bbox.x + bbox.width;
    const wantX = endX + BAR_LABEL_PADDING;
    const curX = parseFloat(label.getAttribute("x") ?? "0");
    if (Math.abs(curX - wantX) > 0.5) label.setAttribute("x", String(wantX));
    label.setAttribute("text-anchor", "start");
    label.classList.add("big");
  });
}

/** Réapplique la colorisation quand la lib modifie le DOM (scroll/déplacement) */
function observeAndRecolor(container: HTMLElement) {
  let rafId: number | null = null;
  const run = () => {
    colorBarLabels(container);
    forceBarLabelsRight(container);
  };
  const schedule = () => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      run();
    });
  };
  const observer = new MutationObserver(() => {
    const needsRecolor = container.querySelector(".bar-label") && Array.from(container.querySelectorAll<SVGTextElement>(".bar-label")).some((el) => !el.querySelector("tspan") && (el.textContent ?? "").trim().length > 0);
    if (needsRecolor) schedule();
  });
      observer.observe(container, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["x", "width"] });
  return () => observer.disconnect();
}

function buildPopupContent(
  task: GanttTaskPayload,
  displayOptions: GanttDisplayOptions
): string {
  const startStr = task.start;
  const endStr = task.end;
  const progressStr = task.progressStatus
    ? `Progress : ${PLANNER_PROGRESS_LABEL_FR[task.progressStatus]}`
    : `Progression : ${task.progress}%`;
  const parts: string[] = [`${startStr} → ${endStr}`, progressStr];
  if (displayOptions.showAssignments && task.assignedTo) {
    parts.push(`Affecté à: ${task.assignedTo}`);
  }
  if (displayOptions.showPriority && task.priority) {
    parts.push(`Priorité: ${task.priority}`);
  }
  if (displayOptions.showBucket && task.bucketName) {
    parts.push(`Bucket: ${task.bucketName}`);
  }
  if (displayOptions.showLabels && task.labels) {
    parts.push(`Étiquettes: ${task.labels}`);
  }
  if (task.createdBy) parts.push(`Créé par: ${task.createdBy}`);
  if (task.createdAt) parts.push(`Date de création: ${task.createdAt}`);
  if (task.dueDate) parts.push(`Date d’échéance: ${task.dueDate}`);
  if (typeof task.isRecurring === "boolean") parts.push(`Est périodique: ${task.isRecurring ? "Oui" : "Non"}`);
  if (typeof task.isLate === "boolean") parts.push(`En retard: ${task.isLate ? "Oui" : "Non"}`);
  if (task.completedAt) parts.push(`Date de fin: ${task.completedAt}`);
  if (task.executedBy) parts.push(`Exécuté par: ${task.executedBy}`);
  if (task.checklistDone) parts.push(`Checklist effectuée: ${task.checklistDone}`);
  if (task.checklistTotal) parts.push(`Checklist totale: ${task.checklistTotal}`);
  if (task.description) parts.push(`Description: ${task.description}`);
  return parts.join("<br/>");
}

interface GanttChartProps {
  tasks: Task[];
  viewMode?: GanttViewMode;
  displayOptions?: GanttDisplayOptions;
  fullscreen?: boolean;
  className?: string;
}

export function GanttChart({
  tasks,
  viewMode = "Month",
  displayOptions = {},
  fullscreen = false,
  className,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<InstanceType<typeof import("frappe-gantt").default> | null>(null);
  const observerCleanupRef = useRef<(() => void) | null>(null);
  const optsRef = useRef({ displayOptions, viewMode });
  optsRef.current = { displayOptions, viewMode };

  // Création / recréation du Gantt uniquement quand tasks ou viewMode changent
  useEffect(() => {
    if (!containerRef.current || !tasks.length) return;

    const loadGantt = async () => {
      const Gantt = (await import("frappe-gantt")).default;
      containerRef.current!.innerHTML = "";
      const { displayOptions: opts, viewMode: mode } = optsRef.current;
      const ganttTasks = tasks.map((t) => toGanttTask(t, opts));
      // Toujours créer en "Day" puis changer la vue (évite bugs vue Week/Month à l’init)
      ganttRef.current = new Gantt(containerRef.current!, ganttTasks, {
        view_mode: "Day",
        bar_height: 32,
        popup_on: "click",
        popup: (ctx: {
          task: GanttTaskPayload;
          set_title: (v: string) => void;
          set_subtitle: (v: string) => void;
          set_details: (v: string) => void;
        }) => {
          ctx.set_title(ctx.task.originalName ?? ctx.task.name);
          ctx.set_subtitle("");
          ctx.set_details(buildPopupContent(ctx.task, optsRef.current.displayOptions));
        },
      });
      if (mode !== "Day") {
        try {
          (ganttRef.current as any)?.change_view_mode?.(mode, false);
        } catch (_) {
          // fallback: garder Day
        }
      }
      const runColorize = () => {
        if (!containerRef.current) return;
        colorBarLabels(containerRef.current);
        forceBarLabelsRight(containerRef.current);
      };
      requestAnimationFrame(runColorize);
      setTimeout(runColorize, 120);
      observerCleanupRef.current?.();
      observerCleanupRef.current = containerRef.current ? observeAndRecolor(containerRef.current) : null;
    };

    loadGantt();
    return () => {
      observerCleanupRef.current?.();
      observerCleanupRef.current = null;
      ganttRef.current = null;
    };
  }, [tasks]);

  // Changement de vue (Jour / Semaine / Mois) : API du Gantt au lieu de recréer
  useEffect(() => {
    if (!ganttRef.current || !tasks.length) return;
    try {
      (ganttRef.current as any)?.change_view_mode?.(viewMode, true);
      requestAnimationFrame(() => {
        if (containerRef.current) {
          colorBarLabels(containerRef.current);
          forceBarLabelsRight(containerRef.current);
        }
      });
    } catch (_) {
      // ignore
    }
  }, [viewMode]);

  // Changement de filtre : refresh sans recréer (évite l’animation complète)
  const showA = displayOptions?.showAssignments ?? true;
  const showP = displayOptions?.showPriority ?? true;
  const showB = displayOptions?.showBucket ?? true;
  const showL = displayOptions?.showLabels ?? true;
  const showProgress = displayOptions?.showProgress ?? true;
  const colorBy = displayOptions?.colorBy ?? "bucket";
  const paletteTheme = displayOptions?.paletteTheme ?? "default";
  const taskRefreshKey = useMemo(
    () =>
      tasks
        .map(
          (t) =>
            `${t.id}|${t.name}|${t.start.getTime()}|${t.end.getTime()}|${Math.round(t.progress ?? 0)}|${t.progressStatus ?? ""}|${t.assignedTo ?? ""}|${t.priority ?? ""}|${t.bucketName ?? ""}|${t.labels ?? ""}`
        )
        .join("||"),
    [tasks]
  );
  useEffect(() => {
    if (!ganttRef.current || !tasks.length) return;
    const opts = {
      showAssignments: showA,
      showPriority: showP,
      showBucket: showB,
      showLabels: showL,
      showProgress,
      colorBy,
      paletteTheme,
    };
    const ganttTasks = tasks.map((t) => toGanttTask(t, opts));
    containerRef.current?.classList.add("gantt-no-transition");
    ganttRef.current.refresh(ganttTasks);
    colorBarLabels(containerRef.current!);
    forceBarLabelsRight(containerRef.current!);
    const t = setTimeout(() => {
      containerRef.current?.classList.remove("gantt-no-transition");
      containerRef.current && forceBarLabelsRight(containerRef.current);
    }, 50);
    return () => clearTimeout(t);
  }, [showA, showP, showB, showL, showProgress, colorBy, paletteTheme, taskRefreshKey]);

  if (!tasks.length) return null;

  const minDate = new Date(Math.min(...tasks.map((t) => t.start.getTime())));
  const maxDate = new Date(Math.max(...tasks.map((t) => t.end.getTime())));

  const content = (
    <>
      {!fullscreen && (
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Gantt</CardTitle>
          <Badge variant="secondary">
            {tasks.length} tâche{tasks.length > 1 ? "s" : ""}
          </Badge>
        </CardHeader>
      )}
      <CardContent className={fullscreen ? "flex-1 flex flex-col min-h-0 p-4" : ""}>
        {!fullscreen && (
          <p className="text-xs text-muted-foreground mb-2">
            {format(minDate, "d MMM yyyy", { locale: fr })} →{" "}
            {format(maxDate, "d MMM yyyy", { locale: fr })}
          </p>
        )}
        <div
          className={cn(
            "w-full overflow-auto min-h-[400px]",
            fullscreen && "flex-1 min-h-0 [--gv-grid-height:calc(100vh-12rem)]"
          )}
        >
          <div
            ref={containerRef}
            className={cn(
              "gantt-container min-w-[600px] h-[var(--gv-grid-height,500px)]",
              fullscreen && "min-h-[400px] h-[var(--gv-grid-height,70vh)]"
            )}
          />
        </div>
      </CardContent>
    </>
  );

  if (fullscreen) {
    return (
      <div className={cn("flex flex-col h-full bg-background", className)}>
        {content}
      </div>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      {content}
    </Card>
  );
}
