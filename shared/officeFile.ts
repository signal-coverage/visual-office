import { sanitizeFurniture, type Furniture } from "./furniture.ts";
import { sanitizeModels, type PropPlacement } from "./props.ts";

/**
 * The text of shared/officeData.ts for a layout: the file the office editor
 * writes and the game reads. Only valid entries are written, so what is saved
 * is exactly what the game will use, and nothing a person (or a request) sends
 * can put anything but data into the file.
 */
export function officeDataSource(
  furniture: Furniture[],
  models: PropPlacement[],
): string {
  const items = JSON.stringify(sanitizeFurniture(furniture));
  const props = JSON.stringify(sanitizeModels(models));
  return `import type { Furniture } from "./furniture.ts";
import type { PropPlacement } from "./props.ts";

/**
 * Where everything stands. The office editor writes this file (run \`npm run dev\`,
 * then open /editor.html and press Save); editing it by hand works too.
 * Anything that is not a valid entry is ignored when the office is built.
 */
export const OFFICE_FURNITURE: Furniture[] = ${items};

export const OFFICE_MODELS: PropPlacement[] = ${props};
`;
}
