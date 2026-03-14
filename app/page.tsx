"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCached, setHasCached] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [displayOptions, setDisplayOptions] = useState<GanttDisplayOptions>(defaultDisplayOptions);
  const [viewMode, setViewMode] = useState<GanttViewMode>("Month");

  const loadFromCache = useCallback(() => {
    const cached = loadCachedTasks();
    if (cached?.length) {
      setTasks(cached);
      setError(null);
    }
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
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Rétroplanning → Gantt</h1>
          <p className="text-sm text-muted-foreground">
            Importez un fichier Excel (.xlsx). Aucune donnée n’est envoyée au serveur.
          </p>
        </div>

        <FileUpload onFileSelect={handleFileSelect} disabled={loading} />

        {hasCached && !tasks.length && (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-2">Une planification est en cache pour cette session.</p>
            <Button variant="outline" size="sm" onClick={loadFromCache}>
              Reprendre la dernière planification
            </Button>
          </Card>
        )}

        {loading && (
          <Card className="p-6">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-64 w-full" />
          </Card>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {tasks.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="outline" size="sm" onClick={handleClear}>
                Effacer et recommencer
              </Button>
              <Separator orientation="vertical" className="h-6" />
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
                  <div className="flex items-center justify-between gap-2 border-b px-4 py-2 bg-muted/30">
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
                      className="shrink-0"
                    >
                      <XIcon className="size-4 mr-1" />
                      Fermer
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <GanttChart
                      tasks={tasks}
                      viewMode={viewMode}
                      displayOptions={displayOptions}
                      fullscreen
                      className="h-full"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Separator />
            <GanttChart
              tasks={tasks}
              viewMode={viewMode}
              displayOptions={displayOptions}
            />
          </>
        )}
      </div>
    </div>
  );
}
