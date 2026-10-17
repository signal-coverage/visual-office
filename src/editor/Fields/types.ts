export interface NumberFieldProps {
  label: string;
  value: number;
  step: number;
  min?: number;
  max?: number;
  isDisabled?: boolean;
  /** Called with a valid number, when the person leaves the field or presses Enter. */
  onCommit: (value: number) => void;
}

export interface ChoiceFieldProps<T extends string | number> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  isDisabled?: boolean;
  onChoose: (value: T) => void;
}

export interface TextFieldProps {
  label: string;
  value: string;
  maxLength: number;
  /** Why the last text was not accepted, in words. */
  error?: string | null;
  isDisabled?: boolean;
  /** Called with the text, when the person leaves the field or presses Enter and it is not the one it was. */
  onCommit: (value: string) => void;
}
