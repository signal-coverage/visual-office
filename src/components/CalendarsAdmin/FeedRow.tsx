import { Button, Description, Input, Label, TextField } from "@heroui/react";
import { useState } from "react";
import { describeFeedTest } from "../../calendar/admin";
import {
  REMOVED_NOTE,
  REMOVE_LABEL,
  SAVED_NOTE,
  SAVE_LABEL,
  TEST_LABEL,
  URL_DESCRIPTION,
  URL_PLACEHOLDER,
} from "./consts";
import * as styles from "./styles";
import type { FeedRowProps } from "./types";

interface Outcome {
  ok: boolean;
  text: string;
}

/** The feed of one room: its address, and what saving, removing and testing it did. */
export function FeedRow({ label, initialUrl, onSave, onTest }: FeedRowProps) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [saved, setSaved] = useState(initialUrl !== null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const run = async (work: () => Promise<Outcome>) => {
    setBusy(true);
    setOutcome(null);
    setOutcome(await work());
    setBusy(false);
  };

  const save = () =>
    run(async () => {
      const result = await onSave(url);
      if (!result.ok) return { ok: false, text: result.error };
      setUrl(result.url ?? "");
      setSaved(result.url !== null);
      return result.test
        ? {
            ok: result.test.ok,
            text: `${SAVED_NOTE} ${describeFeedTest(result.test)}`,
          }
        : { ok: true, text: REMOVED_NOTE };
    });

  const remove = () =>
    run(async () => {
      const result = await onSave("");
      if (!result.ok) return { ok: false, text: result.error };
      setUrl("");
      setSaved(false);
      return { ok: true, text: REMOVED_NOTE };
    });

  const test = () =>
    run(async () => {
      const result = await onTest(url);
      if (!result.ok) return { ok: false, text: result.error };
      return { ok: result.test.ok, text: describeFeedTest(result.test) };
    });

  return (
    <li className={styles.row}>
      <TextField className={styles.field} value={url} onChange={setUrl}>
        <Label>{label}</Label>
        <Input
          fullWidth
          type="url"
          autoComplete="off"
          spellCheck={false}
          placeholder={URL_PLACEHOLDER}
        />
        <Description>{URL_DESCRIPTION}</Description>
      </TextField>
      <div className={styles.buttons}>
        <Button size="sm" isDisabled={busy || url.trim() === ""} onPress={save}>
          {SAVE_LABEL}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={busy || url.trim() === ""}
          onPress={test}
        >
          {TEST_LABEL}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={busy || !saved}
          onPress={remove}
        >
          {REMOVE_LABEL}
        </Button>
      </div>
      {outcome && (
        <p
          className={styles.result(outcome.ok)}
          role={outcome.ok ? "status" : "alert"}
        >
          {outcome.text}
        </p>
      )}
    </li>
  );
}
