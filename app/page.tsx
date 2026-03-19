"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import {
  GanttChart,
  type GanttDisplayOptions,
  type GanttViewMode,
} from "@/components/GanttChart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task } from "@/lib/parse-xlsx";
import { parseXlsxFile } from "@/lib/parse-xlsx";
import { Maximize2, XIcon } from "lucide-react";

const CACHE_KEY = "gantt-data";

interface CachedTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress?: number;
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
}

function loadCachedTasks(): Task[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CachedTask[];
    return data.map((t) => ({
      ...t,
      start: new Date(t.start),
      end: new Date(t.end),
      createdAt: t.createdAt ? new Date(t.createdAt) : undefined,
      dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
      completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
    }));
  } catch {
    return null;
  }
}

function saveTasksToCache(tasks: Task[]) {
  if (typeof window === "undefined") return;
  try {
    const data: CachedTask[] = tasks.map((t) => ({
      id: t.id,
      name: t.name,
      start: t.start.toISOString(),
      end: t.end.toISOString(),
      progress: t.progress,
      assignedTo: t.assignedTo,
      bucketName: t.bucketName,
      priority: t.priority,
      labels: t.labels,
      createdBy: t.createdBy,
      createdAt: t.createdAt?.toISOString(),
      dueDate: t.dueDate?.toISOString(),
      isRecurring: t.isRecurring,
      isLate: t.isLate,
      completedAt: t.completedAt?.toISOString(),
      executedBy: t.executedBy,
      checklistDone: t.checklistDone,
      checklistTotal: t.checklistTotal,
      description: t.description,
    }));
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function clearCache() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CACHE_KEY);
}

const defaultDisplayOptions: GanttDisplayOptions = {
  showAssignments: true,
  showPriority: true,
  showBucket: true,
  showLabels: true,
};

export type SortBy = "start" | "end" | "name" | "assignedTo" | "priority" | "bucket";
export type SortOrder = "asc" | "desc";

function sortTasks(tasks: Task[], sortBy: SortBy, order: SortOrder): Task[] {
  const dir = order === "asc" ? 1 : -1;
  return [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case "start":
        cmp = a.start.getTime() - b.start.getTime();
        break;
      case "end":
        cmp = a.end.getTime() - b.end.getTime();
        break;
      case "name":
        cmp = (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" });
        break;
      case "assignedTo":
        cmp = (a.assignedTo ?? "").localeCompare(b.assignedTo ?? "", undefined, { sensitivity: "base" });
        break;
      case "priority":
        cmp = (a.priority ?? "").localeCompare(b.priority ?? "", undefined, { sensitivity: "base" });
        break;
      case "bucket":
        cmp = (a.bucketName ?? "").localeCompare(b.bucketName ?? "", undefined, { sensitivity: "base" });
        break;
    }
    return cmp * dir;
  });
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCached, setHasCached] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<GanttDisplayOptions>(defaultDisplayOptions);
  const [viewMode, setViewMode] = useState<GanttViewMode>("Month");
  const [sortBy, setSortBy] = useState<SortBy>("start");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const sortedTasks = useMemo(() => sortTasks(tasks, sortBy, sortOrder), [tasks, sortBy, sortOrder]);

  const loadFromCache = useCallback(() => {
    const cached = loadCachedTasks();
    if (cached?.length) {
      setTasks(cached);
      setError(null);
    }
  }, []);

  // Au montage (et après remontage Strict Mode) : restaurer le cache pour ne pas perdre le Gantt
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = loadCachedTasks();
    if (cached?.length) {
      setTasks(cached);
      setError(null);
    }
    setHasCached(!!sessionStorage.getItem(CACHE_KEY));
  }, []);

  useEffect(() => {
    setHasCached(!!(typeof window !== "undefined" && sessionStorage.getItem(CACHE_KEY)));
  }, [tasks]);

  const handleFileSelect = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const parsed = await parseXlsxFile(file);
      setTasks(parsed);
      saveTasksToCache(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors du chargement du fichier.");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    clearCache();
    setTasks([]);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-background p-5 md:p-8 lg:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Rétroplanning → Gantt
          </h1>
          <p className="text-muted-foreground text-base">
            Importez un fichier Excel (.xlsx). Aucune donnée n’est envoyée au serveur.
          </p>
        </header>

        <FileUpload onFileSelect={handleFileSelect} disabled={loading} />

        {hasCached && !tasks.length && (
          <Card className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
            <p className="text-muted-foreground mb-3 text-sm">Une planification est en cache pour cette session.</p>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={loadFromCache}>
              Reprendre la dernière planification
            </Button>
          </Card>
        )}

        {loading && (
          <Card className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
            <Skeleton className="mb-4 h-8 w-48 rounded-lg" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </Card>
        )}

        {error && (
          <Alert variant="destructive" className="rounded-xl">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {tasks.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/40 p-3 shadow-sm">
              <Button variant="outline" size="sm" className="rounded-lg shrink-0" onClick={handleClear}>
                Effacer et recommencer
              </Button>
              <Separator orientation="vertical" className="h-6 shrink-0" />
              <div className="flex flex-wrap items-center gap-3">
                <Label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={displayOptions.showAssignments ?? true}
                    onCheckedChange={(v) =>
                      setDisplayOptions((o) => ({ ...o, showAssignments: v }))
                    }
                  />
                  Affectations
                </Label>
                <Label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={displayOptions.showPriority ?? true}
                    onCheckedChange={(v) =>
                      setDisplayOptions((o) => ({ ...o, showPriority: v }))
                    }
                  />
                  Priorité
                </Label>
                <Label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={displayOptions.showBucket ?? true}
                    onCheckedChange={(v) =>
                      setDisplayOptions((o) => ({ ...o, showBucket: v }))
                    }
                  />
                  Bucket
                </Label>
                <Label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={displayOptions.showLabels ?? true}
                    onCheckedChange={(v) =>
                      setDisplayOptions((o) => ({ ...o, showLabels: v }))
                    }
                  />
                  Étiquettes
                </Label>
                <div className="flex items-center gap-2">
                  <Label htmlFor="sort-by" className="text-sm whitespace-nowrap">
                    Trier par
                  </Label>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                    <SelectTrigger id="sort-by" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="start">Date de début</SelectItem>
                      <SelectItem value="end">Date de fin</SelectItem>
                      <SelectItem value="name">Nom</SelectItem>
                      <SelectItem value="assignedTo">Affectation</SelectItem>
                      <SelectItem value="priority">Priorité</SelectItem>
                      <SelectItem value="bucket">Bucket</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Croissant</SelectItem>
                      <SelectItem value="desc">Décroissant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="view-mode" className="text-sm whitespace-nowrap">
                    Vue
                  </Label>
                  <Select
                    value={viewMode}
                    onValueChange={(v) => setViewMode(v as GanttViewMode)}
                  >
                    <SelectTrigger id="view-mode" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Day">Jour</SelectItem>
                      <SelectItem value="Week">Semaine</SelectItem>
                      <SelectItem value="Month">Mois</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg shrink-0"
                  onClick={() => setFullscreenOpen(true)}
                >
                  <Maximize2 className="size-4 mr-1" />
                  Plein écran
                </Button>
                <DialogContent
                  className="fixed inset-0 z-50 max-w-none w-screen h-screen rounded-none border-0 flex flex-col p-0"
                  showCloseButton={true}
                >
                  <DialogTitle className="sr-only">Gantt en plein écran</DialogTitle>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/40 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-4">
                      <Label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={displayOptions.showAssignments ?? true}
                          onCheckedChange={(v) =>
                            setDisplayOptions((o) => ({ ...o, showAssignments: v }))
                          }
                        />
                        Affectations
                      </Label>
                      <Label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={displayOptions.showPriority ?? true}
                          onCheckedChange={(v) =>
                            setDisplayOptions((o) => ({ ...o, showPriority: v }))
                          }
                        />
                        Priorité
                      </Label>
                      <Label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={displayOptions.showBucket ?? true}
                          onCheckedChange={(v) =>
                            setDisplayOptions((o) => ({ ...o, showBucket: v }))
                          }
                        />
                        Bucket
                      </Label>
                      <Label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={displayOptions.showLabels ?? true}
                          onCheckedChange={(v) =>
                            setDisplayOptions((o) => ({ ...o, showLabels: v }))
                          }
                        />
                        Étiquettes
                      </Label>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="sort-by-fs" className="text-sm whitespace-nowrap">
                          Trier par
                        </Label>
                        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                          <SelectTrigger id="sort-by-fs" className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="start">Date de début</SelectItem>
                            <SelectItem value="end">Date de fin</SelectItem>
                            <SelectItem value="name">Nom</SelectItem>
                            <SelectItem value="assignedTo">Affectation</SelectItem>
                            <SelectItem value="priority">Priorité</SelectItem>
                            <SelectItem value="bucket">Bucket</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asc">Croissant</SelectItem>
                            <SelectItem value="desc">Décroissant</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="view-mode-fs" className="text-sm whitespace-nowrap">
                          Vue
                        </Label>
                        <Select
                          value={viewMode}
                          onValueChange={(v) => setViewMode(v as GanttViewMode)}
                        >
                          <SelectTrigger id="view-mode-fs" className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Day">Jour</SelectItem>
                            <SelectItem value="Week">Semaine</SelectItem>
                            <SelectItem value="Month">Mois</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFullscreenOpen(false)}
                      className="shrink-0 rounded-lg"
                    >
                      <XIcon className="size-4 mr-1" />
                      Fermer
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <GanttChart
                      tasks={sortedTasks}
                      viewMode={viewMode}
                      displayOptions={displayOptions}
                      fullscreen
                      className="h-full"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <GanttChart
              tasks={sortedTasks}
              viewMode={viewMode}
              displayOptions={displayOptions}
            />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
