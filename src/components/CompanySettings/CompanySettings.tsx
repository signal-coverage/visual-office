import { Button, Description, Label, Modal, Switch } from "@heroui/react";
import { useEffect, useState } from "react";
import { FLOOR_ID } from "../../../shared/floors.ts";
import {
  fetchAllowNameEdit,
  saveAllowNameEdit,
} from "../../companySettings/companySettings";
import { gameBackend, httpUrlOf } from "../../editor/backend";
import { currentServerUrl } from "../../game/serverAddress";
import {
  CLOSE_LABEL,
  LOAD_ERROR,
  LOADING,
  NAME_EDIT_DESCRIPTION,
  NAME_EDIT_LABEL,
  SAVE_ERROR,
  TITLE,
} from "./consts";
import * as styles from "./styles";
import type { CompanySettingsProps } from "./types";

/**
 * What the company's admins decide for everybody. The game server checks that
 * the caller is an admin, and enforces each setting, whatever this screen shows.
 */
export function CompanySettings({ getToken, onClose }: CompanySettingsProps) {
  const [{ request, adminBase }] = useState(() => ({
    request: gameBackend({
      serverUrl: currentServerUrl(),
      floor: FLOOR_ID,
      getToken,
      models: [],
    }).request,
    adminBase: `${httpUrlOf(currentServerUrl())}/admin`,
  }));
  const [allowNameEdit, setAllowNameEdit] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void fetchAllowNameEdit(request, adminBase).then((found) => {
      setAllowNameEdit(found);
      setLoaded(true);
    });
  }, [request, adminBase]);

  const toggle = async (allow: boolean) => {
    setProblem(null);
    // Shown at once; put back if the server did not do it
    setAllowNameEdit(allow);
    if (!(await saveAllowNameEdit(request, adminBase, allow))) {
      setAllowNameEdit(!allow);
      setProblem(SAVE_ERROR);
    }
  };

  return (
    <Modal.Backdrop
      isOpen
      variant="blur"
      onOpenChange={(open) => !open && onClose()}
    >
      <Modal.Container>
        <Modal.Dialog className={styles.dialog} aria-label={TITLE}>
          <Modal.Header>
            <Modal.Heading className={styles.title}>{TITLE}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {!loaded && <p className={styles.notice}>{LOADING}</p>}
            {loaded && allowNameEdit === null && (
              <p className={styles.error} role="alert">
                {LOAD_ERROR}
              </p>
            )}
            {allowNameEdit !== null && (
              <Switch
                isSelected={allowNameEdit}
                onChange={(on) => void toggle(on)}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>
                  <Label>{NAME_EDIT_LABEL}</Label>
                  <Description>{NAME_EDIT_DESCRIPTION}</Description>
                </Switch.Content>
              </Switch>
            )}
            {problem && (
              <p className={styles.error} role="alert">
                {problem}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer className={styles.actions}>
            <Button variant="secondary" onPress={onClose}>
              {CLOSE_LABEL}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
