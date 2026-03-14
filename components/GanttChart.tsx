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

const TAG_HEIGHT = 14;
const TAG_PAD = 4;
const TAG_RX = 3;
const NS = "http://www.w3.org/2000/svg";

/** Injecte des pastilles (étiquettes) sur chaque barre du Gantt */
function injectLabelTags(container: HTMLElement, tasks: Task[], showLabels: boolean) {
  if (!showLabels) return;
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  container.querySelectorAll<SVGGElement>("g.bar-wrapper").forEach((barWrapper) => {
    const taskId = barWrapper.getAttribute("data-id");
    const task = taskId ? taskMap.get(taskId) : null;
    if (!task?.labels) return;
    const barGroup = barWrapper.querySelector<SVGGElement>(".bar-group");
    const barRect = barGroup?.querySelector<SVGRectElement>("rect.bar");
    if (!barGroup || !barRect) return;
    barGroup.querySelectorAll(".label-tags").forEach((el) => el.remove());
    const barX = parseFloat(barRect.getAttribute("x") ?? "0");
    const barY = parseFloat(barRect.getAttribute("y") ?? "0");
    const barW = parseFloat(barRect.getAttribute("width") ?? "0");
    const barH = parseFloat(barRect.getAttribute("height") ?? "28");
    const labels = task.labels.split(",").map((s) => s.trim()).filter(Boolean);
    if (labels.length === 0) return;
    const tagsG = document.createElementNS(NS, "g");
    tagsG.setAttribute("class", "label-tags");
    tagsG.setAttribute("transform", `translate(${barX + barW + 8},${barY + (barH - TAG_HEIGHT) / 2})`);
    let xOff = 0;
    labels.forEach((label) => {
      const tagW = Math.min(100, Math.max(24, label.length * 5.5 + 10));
      const g = document.createElementNS(NS, "g");
      g.setAttribute("transform", `translate(${xOff},0)`);
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", "0");
      rect.setAttribute("y", "0");
      rect.setAttribute("width", String(tagW));
      rect.setAttribute("height", String(TAG_HEIGHT));
      rect.setAttribute("rx", String(TAG_RX));
      rect.setAttribute("ry", String(TAG_RX));
      rect.setAttribute("class", "gantt-label-tag");
      const text = document.createElementNS(NS, "text");
      text.setAttribute("x", "5");
      text.setAttribute("y", String(TAG_HEIGHT - 3));
      text.setAttribute("font-size", "10");
      text.setAttribute("fill", "currentColor");
      text.textContent = label.length > 14 ? label.slice(0, 12) + "…" : label;
      g.appendChild(rect);
      g.appendChild(text);
      tagsG.appendChild(g);
      xOff += tagW + TAG_PAD;
    });
    barGroup.appendChild(tagsG);
  });
}

/** Colorise le nom + affectation (bleu), priorité (orange), bucket (vert) dans les bar-label SVG */
function colorBarLabels(container: HTMLElement) {
  container.querySelectorAll<SVGTextElement>(".bar-label").forEach((textEl) => {
    const full = textEl.textContent ?? "";
    const idx = full.indexOf(LABEL_SEP);
    if (idx < 0) return;
    const name = full.slice(0, idx).trim();
    const meta = full.slice(idx + LABEL_SEP.length).trim();
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
      ganttRef.current = new Gantt(containerRef.current!, ganttTasks, {
        view_mode: mode,
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
      requestAnimationFrame(() => {
        colorBarLabels(containerRef.current!);
        injectLabelTags(containerRef.current!, tasks, opts.showLabels ?? true);
      });
    };

    loadGantt();
    return () => {
      ganttRef.current = null;
    };
  }, [tasks, viewMode]);

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
    injectLabelTags(containerRef.current!, tasks, showL);
    const t = setTimeout(() => {
      containerRef.current?.classList.remove("gantt-no-transition");
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
