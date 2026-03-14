declare module "frappe-gantt" {
  export interface GanttTask {
    id: string;
    name: string;
    start: string;
    end: string;
    progress: number;
  }

  export default class Gantt {
    constructor(
      element: string | HTMLElement | SVGElement,
      tasks: GanttTask[],
      options?: Record<string, unknown>
    );
    refresh(tasks: GanttTask[]): void;
  }
}
