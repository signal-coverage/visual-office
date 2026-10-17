import type { FloorTemplate } from "../../../shared/floorTemplates.ts";

export interface TemplateModalProps {
  templates: readonly FloorTemplate[];
  /** Called with the template and whether the furniture goes too. */
  onApply: (template: FloorTemplate, replaceFurniture: boolean) => void;
  onCancel: () => void;
}
