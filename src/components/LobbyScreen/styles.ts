export const backdrop =
  "fixed inset-0 grid place-items-center bg-black/70 p-4 text-foreground backdrop-blur-md";
export const card =
  "relative box-border max-h-full w-[min(720px,100%)] overflow-y-auto rounded-2xl bg-surface p-7 shadow-2xl";
export const title = "m-0 text-3xl font-semibold";
export const subtitle = "mb-5 mt-1.5 text-sm text-muted";
export const form = "flex flex-col gap-2";
/** The character on one side and the choices on the other; stacked when there is no room. */
export const columns =
  "grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] items-start gap-6";
export const previewColumn = "flex flex-col items-center gap-2.5";
export const fieldsColumn = "flex flex-col gap-3.5";
export const nameField = "w-full";
export const submit = "mt-2";
export const message = "mt-3";
export const controls =
  "m-0 mt-5 grid list-none grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 p-0 text-sm";
/** Lets the key and its label sit directly in the parent grid's two columns. */
export const controlRow = "contents";
export const key = "justify-self-start";
export const accountMenu = "absolute right-4 top-4";
