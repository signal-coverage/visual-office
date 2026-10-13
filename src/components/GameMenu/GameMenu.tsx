import { Button, Checkbox, Kbd, Label, Modal, Slider } from "@heroui/react";
import { useEffect, useState } from "react";
import {
  randomAppearance,
  sameAppearance,
} from "../../../shared/appearance.ts";
import { CONTROLS } from "../../App/controls";
import { AppearancePicker, RANDOM_LABEL } from "../AppearancePicker";
import { AvatarPreview } from "../AvatarPreview";
import {
  CHARACTER,
  CONTROLS_TITLE,
  ITEMS,
  OPTIONS,
  SENSITIVITY_RANGE,
  TITLE,
} from "./consts";
import * as styles from "./styles";
import type { GameMenuProps, Panel } from "./types";

/**
 * The menu of the office, opened with Esc: go back, change how you look, see
 * the keys, set the mouse, leave. Everything here is about the player, so it
 * works for anybody, signed in or not.
 */
export function GameMenu({
  name,
  look,
  settings,
  onResume,
  onChangeLook,
  onChangeSettings,
  onLeave,
  onSignOut,
}: GameMenuProps) {
  const [panel, setPanel] = useState<Panel>("main");
  // What is being tried on in the character panel: it is only saved with Save
  const [draft, setDraft] = useState(look);
  const [saved, setSaved] = useState(false);

  // Esc goes back one step: out of a panel, then out of the menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (panel === "main") onResume();
      else setPanel("main");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel, onResume]);

  const back = (
    <Button variant="secondary" onPress={() => setPanel("main")}>
      {CHARACTER.back}
    </Button>
  );

  const heading = (text: string) => (
    <Modal.Header>
      <Modal.Heading className={styles.title}>{text}</Modal.Heading>
    </Modal.Header>
  );

  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      isDismissable={false}
      isKeyboardDismissDisabled
    >
      <Modal.Container>
        <Modal.Dialog className={styles.dialog} aria-label={TITLE}>
          {panel === "main" && (
            <>
              {heading(TITLE)}
              <Modal.Body>
                <div className={styles.list}>
                  <Button fullWidth className={styles.item} onPress={onResume}>
                    {ITEMS.resume}
                  </Button>
                  <Button
                    fullWidth
                    variant="secondary"
                    className={styles.item}
                    onPress={() => {
                      setDraft(look);
                      setSaved(false);
                      setPanel("character");
                    }}
                  >
                    {ITEMS.character}
                  </Button>
                  <Button
                    fullWidth
                    variant="secondary"
                    className={styles.item}
                    onPress={() => setPanel("controls")}
                  >
                    {ITEMS.controls}
                  </Button>
                  <Button
                    fullWidth
                    variant="secondary"
                    className={styles.item}
                    onPress={() => setPanel("options")}
                  >
                    {ITEMS.options}
                  </Button>
                  <Button
                    fullWidth
                    variant="secondary"
                    className={styles.item}
                    onPress={onLeave}
                  >
                    {ITEMS.leave}
                  </Button>
                  {onSignOut && (
                    <Button
                      fullWidth
                      variant="secondary"
                      className={styles.item}
                      onPress={onSignOut}
                    >
                      {ITEMS.signOut}
                    </Button>
                  )}
                </div>
              </Modal.Body>
            </>
          )}

          {panel === "character" && (
            <>
              {heading(CHARACTER.title)}
              <Modal.Body>
                <p className={styles.intro}>{CHARACTER.intro}</p>
                <div className={styles.columns}>
                  <div className={styles.previewColumn}>
                    <AvatarPreview name={name} appearance={draft} />
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => {
                        setDraft(randomAppearance());
                        setSaved(false);
                      }}
                    >
                      {RANDOM_LABEL}
                    </Button>
                  </div>
                  <AppearancePicker
                    value={draft}
                    onChange={(next) => {
                      setDraft(next);
                      setSaved(false);
                    }}
                  />
                </div>
              </Modal.Body>
              <Modal.Footer className={styles.actions}>
                <Button
                  isDisabled={sameAppearance(draft, look)}
                  onPress={() => {
                    onChangeLook(draft);
                    setSaved(true);
                  }}
                >
                  {CHARACTER.save}
                </Button>
                {back}
                {saved && sameAppearance(draft, look) && (
                  <p className={styles.note} role="status">
                    {CHARACTER.saved}
                  </p>
                )}
              </Modal.Footer>
            </>
          )}

          {panel === "controls" && (
            <>
              {heading(CONTROLS_TITLE)}
              <Modal.Body>
                <ul className={styles.controls}>
                  {CONTROLS.map(([keys, action]) => (
                    <li key={keys} className={styles.controlRow}>
                      <Kbd className={styles.key}>{keys}</Kbd>
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </Modal.Body>
              <Modal.Footer className={styles.actions}>{back}</Modal.Footer>
            </>
          )}

          {panel === "options" && (
            <>
              {heading(OPTIONS.title)}
              <Modal.Body className={styles.body}>
                <Slider
                  className={styles.field}
                  minValue={SENSITIVITY_RANGE.min}
                  maxValue={SENSITIVITY_RANGE.max}
                  step={SENSITIVITY_RANGE.step}
                  value={settings.mouseSensitivity}
                  onChange={(value) =>
                    onChangeSettings({
                      ...settings,
                      mouseSensitivity: Array.isArray(value) ? value[0] : value,
                    })
                  }
                >
                  <Label>{OPTIONS.sensitivity}</Label>
                  <Slider.Output>
                    {({ state }) => `${state.values[0].toFixed(1)}×`}
                  </Slider.Output>
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
                <Checkbox
                  isSelected={settings.showHints}
                  onChange={(showHints) =>
                    onChangeSettings({ ...settings, showHints })
                  }
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    {OPTIONS.hints}
                  </Checkbox.Content>
                </Checkbox>
              </Modal.Body>
              <Modal.Footer className={styles.actions}>{back}</Modal.Footer>
            </>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
