export interface ContentNoticeProps {
  /** Loading shows a spinner; failed shows the words and a way to try again. */
  state: { status: "loading" } | { status: "error"; text: string };
  onRetry: () => void;
}
