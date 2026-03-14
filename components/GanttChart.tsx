"use client";

import { useEffect, useRef } from "react";
import type { Task } from "@/lib/parse-xlsx";
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
}

const BAR_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#14b8a6",
];

function barColorFromKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  let n = 0;
  for (let i = 0; i < key.length; i++) n = (n * 31 + key.charCodeAt(i)) >>> 0;
  return BAR_COLORS[n % BAR_COLORS.length];
}

interface GanttTaskPayload {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  assignedTo?: string;
  bucketName?: string;
  priority?: string;
  labels?: string;
  originalName?: string;
  color?: string;
  color_progress?: string;
}

function buildTaskDisplayName(t: Task, opts: GanttDisplayOptions): string {
  const parts: string[] = [t.name];
  const extras: string[] = [];
  if (opts.showAssignments && t.assignedTo) extras.push(t.assignedTo);
  if (opts.showPriority && t.priority) extras.push(t.priority);
  if (opts.showBucket && t.bucketName) extras.push(t.bucketName);
  if (opts.showLabels && t.labels) extras.push(t.labels);
  if (extras.length) parts.push(extras.join(" · "));
  return parts.join(" — ");
}

function toGanttTask(t: Task, displayOptions: GanttDisplayOptions): GanttTaskPayload {
  const barColor = barColorFromKey(t.bucketName ?? t.assignedTo ?? t.priority);
  return {
    id: t.id,
    name: buildTaskDisplayName(t, displayOptions),
    originalName: t.name,
    start: format(t.start, "yyyy-MM-dd"),
    end: format(t.end, "yyyy-MM-dd"),
    progress: t.progress ?? 0,
    assignedTo: t.assignedTo,
    bucketName: t.bucketName,
    priority: t.priority,
    labels: t.labels,
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
  const parts: string[] = [`${startStr} → ${endStr}`, `Progression: ${task.progress}%`];
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
          ganttRef.current.change_view_mode(mode, false);
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
      ganttRef.current.change_view_mode(viewMode, true);
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
  useEffect(() => {
    if (!ganttRef.current || !tasks.length) return;
    const opts = { showAssignments: showA, showPriority: showP, showBucket: showB, showLabels: showL };
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
  }, [showA, showP, showB, showL]);

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
