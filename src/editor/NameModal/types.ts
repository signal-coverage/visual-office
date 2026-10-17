export interface NameModalProps {
  /** What is being named: a private room or an area. */
  kind: "zone" | "area";
  /** Why a name cannot be used, or null when it can. */
  validate: (name: string) => string | null;
  /** Called with the name, only when `validate` accepts it. */
  onSubmit: (name: string) => void;
  onCancel: () => void;
}
