import {
  Button,
  Checkbox,
  Kbd,
  Label,
  Modal,
  Radio,
  RadioGroup,
  Slider,
} from "@heroui/react";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  randomAppearance,
  sameAppearance,
} from "../../../shared/appearance.ts";
import { EMOTE_ICONS, EMOTE_LABELS, EMOTES } from "../../../shared/emotes.ts";
import {
  sanitizeStatus,
  STATUS_LABELS,
  STATUSES,
} from "../../../shared/presence.ts";
import { CONTROLS, TOUCH_CONTROLS } from "../../App/controls";
import { QUALITY_CHOICES, sanitizeQuality } from "../../game/quality";
import { cn } from "../../lib/cn";
import { desktopPermission, desktopSupported } from "../../chat/desktop";
import { AppearancePicker, RANDOM_LABEL } from "../AppearancePicker";
import { AvatarPreview } from "../AvatarPreview";
import { ErrorBoundary } from "../ErrorBoundary";
import { LoadFailed } from "../LoadFailed";
import { RoomsPanel } from "../RoomsPanel";
import { StatusDot } from "../StatusDot";
import {
  CHARACTER,
  CONTROLS_TITLE,
  EMOTES_PANEL,
  ITEMS,
  OPTIONS,
  QUALITY_LABELS,
  SENSITIVITY_RANGE,
  STATUS,
  TITLE,
} from "./consts";
import * as styles from "./styles";
import type { GameMenuProps, Panel } from "./types";

// Its own chunk: only moderators ever open it
const ModerationPanel = lazy(() =>
  import("../ModerationPanel").then((module) => ({
    default: module.ModerationPanel,
  })),
);

/**
 * The menu of the office, opened with Esc: go back, change how you look, see
 * the keys, set the mouse, leave. Everything here is about the player, so it
 * works for anybody, signed in or not.
 */
export function GameMenu({
  name,
  look,
  settings,
  status,
  shownStatus,
  onChangeStatus,
  onEmote,
  onKnock,
  onOpenCalendar,
  onToggleDesktopNotifications,
  onResume,
  onChangeLook,
  onChangeSettings,
  onLeave,
  onSignOut,
  touch = false,
  onLite,
  rooms,
  moderation,
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
        <Modal.Dialog
          className={cn(
            styles.dialog,
            panel === "character" && styles.dialogWide,
          )}
          aria-label={TITLE}
        >
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
                    onPress={() => setPanel("status")}
                  >
                    {ITEMS.status}
                  </Button>
                  <Button
                    fullWidth
                    variant="secondary"
                    className={styles.item}
                    onPress={() => setPanel("emotes")}
                  >
                    {ITEMS.emotes}
                  </Button>
                  <Button
                    fullWidth
                    variant="secondary"
                    className={styles.item}
                    onPress={onKnock}
                  >
                    {touch ? ITEMS.knockTouch : ITEMS.knock}
                  </Button>
                  {rooms && (
                    <Button
                      fullWidth
                      variant="secondary"
                      className={styles.item}
                      onPress={rooms.onOpenMap}
                    >
                      {touch ? ITEMS.mapTouch : ITEMS.map}
                    </Button>
                  )}
                  {rooms && (
                    <Button
                      fullWidth
                      variant="secondary"
                      className={styles.item}
                      onPress={() => setPanel("rooms")}
                    >
                      {ITEMS.rooms}
                    </Button>
                  )}
                  <Button
                    fullWidth
                    variant="secondary"
                    className={styles.item}
                    onPress={onOpenCalendar}
                  >
                    {ITEMS.calendar}
                  </Button>
                  <Button
                    fullWidth
                    variant="secondary"
                    className={styles.item}
                    onPress={() => setPanel("controls")}
                  >
                    {ITEMS.controls}
                  </Button>
                  {onLite && (
                    <Button
                      fullWidth
                      variant="secondary"
                      className={styles.item}
                      onPress={onLite}
                    >
                      {ITEMS.lite}
                    </Button>
                  )}
                  <Button
                    fullWidth
                    variant="secondary"
                    className={styles.item}
                    onPress={() => setPanel("options")}
                  >
                    {ITEMS.options}
                  </Button>
                  {moderation && (
                    <Button
                      fullWidth
                      variant="secondary"
                      className={styles.item}
                      onPress={() => setPanel("moderation")}
                    >
                      {ITEMS.moderation}
                    </Button>
                  )}
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
                  <div className={styles.previewStack}>
                    <div className={styles.previewColumn}>
                      <AvatarPreview name={name} appearance={draft} />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      onPress={() => {
                        setDraft(randomAppearance());
                        setSaved(false);
                      }}
                    >
                      {RANDOM_LABEL}
                    </Button>
                  </div>
                  <div className={styles.pickerColumn}>
                    <AppearancePicker
                      value={draft}
                      onChange={(next) => {
                        setDraft(next);
                        setSaved(false);
                      }}
                    />
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer className={styles.actions}>
                {saved && sameAppearance(draft, look) && (
                  <p className={styles.note} role="status">
                    {CHARACTER.saved}
                  </p>
                )}
                {back}
                <Button
                  isDisabled={sameAppearance(draft, look)}
                  onPress={() => {
                    onChangeLook(draft);
                    setSaved(true);
                  }}
                >
                  {CHARACTER.save}
                </Button>
              </Modal.Footer>
            </>
          )}

          {panel === "status" && (
            <>
              {heading(STATUS.title)}
              <Modal.Body className={styles.body}>
                <p className={styles.intro}>{STATUS.intro}</p>
                <RadioGroup
                  aria-label={STATUS.label}
                  value={status}
                  onChange={(value) => {
                    const next = sanitizeStatus({ status: value });
                    if (next) onChangeStatus(next);
                  }}
                >
                  {STATUSES.map((option) => (
                    <Radio
                      key={option}
                      value={option}
                      className={styles.statusOption}
                    >
                      <Radio.Content>
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <Label className={styles.statusLabel}>
                          <StatusDot status={option} />
                          {STATUS_LABELS[option]}
                        </Label>
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
              </Modal.Body>
              <Modal.Footer className={styles.actions}>
                {shownStatus !== status && (
                  <p className={styles.showing} role="status">
                    {STATUS.showing}
                    <StatusDot status={shownStatus} />
                    {STATUS_LABELS[shownStatus]}
                  </p>
                )}
                {back}
              </Modal.Footer>
            </>
          )}

          {panel === "emotes" && (
            <>
              {heading(EMOTES_PANEL.title)}
              <Modal.Body>
                <p className={styles.intro}>{EMOTES_PANEL.intro}</p>
                <div className={styles.emoteGrid}>
                  {EMOTES.map((emote, index) => (
                    <Button
                      key={emote}
                      variant="secondary"
                      className={styles.emoteButton}
                      onPress={() => onEmote(emote)}
                    >
                      <span className={styles.emoteIcon} aria-hidden="true">
                        {EMOTE_ICONS[emote]}
                      </span>
                      {EMOTE_LABELS[emote]}
                      <Kbd className={styles.key}>{index + 1}</Kbd>
                    </Button>
                  ))}
                </div>
                <p className={styles.intro}>{EMOTES_PANEL.hint}</p>
              </Modal.Body>
              <Modal.Footer className={styles.actions}>{back}</Modal.Footer>
            </>
          )}

          {panel === "controls" && (
            <>
              {heading(CONTROLS_TITLE)}
              <Modal.Body>
                <ul className={styles.controls}>
                  {(touch ? TOUCH_CONTROLS : CONTROLS).map(([keys, action]) => (
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
                  <Label>
                    {touch ? OPTIONS.touchSensitivity : OPTIONS.sensitivity}
                  </Label>
                  <Slider.Output>
                    {({ state }) => `${state.values[0].toFixed(1)}×`}
                  </Slider.Output>
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
                <RadioGroup
                  aria-label={OPTIONS.quality}
                  value={settings.quality}
                  onChange={(value) =>
                    onChangeSettings({
                      ...settings,
                      quality: sanitizeQuality(value),
                    })
                  }
                >
                  <Label>{OPTIONS.quality}</Label>
                  {QUALITY_CHOICES.map((choice) => (
                    <Radio key={choice} value={choice}>
                      <Radio.Content>
                        <Radio.Control>
                          <Radio.Indicator />
                        </Radio.Control>
                        <Label>{QUALITY_LABELS[choice]}</Label>
                      </Radio.Content>
                    </Radio>
                  ))}
                </RadioGroup>
                <p className={styles.intro}>
                  {touch
                    ? `${OPTIONS.touchQualityNote} ${OPTIONS.qualityNote}`
                    : OPTIONS.qualityNote}
                </p>
                {!touch && (
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
                )}
                <Checkbox
                  isSelected={settings.notificationSound}
                  onChange={(notificationSound) =>
                    onChangeSettings({ ...settings, notificationSound })
                  }
                >
                  <Checkbox.Content>
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    {OPTIONS.sound}
                  </Checkbox.Content>
                </Checkbox>
                {desktopSupported() && (
                  <>
                    <Checkbox
                      isSelected={settings.desktopNotifications}
                      onChange={onToggleDesktopNotifications}
                    >
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        {OPTIONS.desktop}
                      </Checkbox.Content>
                    </Checkbox>
                    {desktopPermission() === "denied" && (
                      <p className={styles.warning}>{OPTIONS.desktopBlocked}</p>
                    )}
                  </>
                )}
              </Modal.Body>
              <Modal.Footer className={styles.actions}>{back}</Modal.Footer>
            </>
          )}
          {panel === "rooms" && rooms && (
            <RoomsPanel
              floors={rooms.floors}
              current={rooms.current}
              onTravel={rooms.onTravel}
              onBack={() => setPanel("main")}
            />
          )}
          {panel === "moderation" && moderation && (
            <ErrorBoundary
              fallback={<LoadFailed onClose={() => setPanel("main")} />}
            >
              <Suspense fallback={null}>
                <ModerationPanel
                  people={moderation.people}
                  onAct={moderation.onAct}
                  onBack={() => setPanel("main")}
                />
              </Suspense>
            </ErrorBoundary>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
