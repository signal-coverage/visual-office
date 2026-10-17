import { Button } from "@heroui/react";
import { lazy, Suspense, useEffect, useReducer, useState } from "react";
import type { Appearance } from "../../../shared/appearance.ts";
import {
  firstScreenReducer,
  floorToEnter,
  initialFirstScreen,
} from "../../App/firstScreen";
import { saveAppearance, saveName } from "../../App/helpers";
import { CharacterScreen } from "../CharacterScreen";
import { ErrorBoundary } from "../ErrorBoundary";
import { LoadFailed } from "../LoadFailed";
import { MainMenu } from "../MainMenu";
import { backdropStyle } from "../MainMenu/styles";
import { FAREWELL_BACK, FAREWELL_TEXT, FAREWELL_TITLE } from "./consts";
import * as styles from "./styles";
import type { FirstScreenProps } from "./types";

// Its own chunk: only opened from the menu
const RoomsMap = lazy(() =>
  import("../RoomsMap").then((module) => ({ default: module.RoomsMap })),
);

/**
 * The first screen after signing in, and the one the player comes back to:
 * the main menu and what it opens (the character, the other offices, the
 * goodbye). The app keeps the connection; this only asks it to join.
 */
export function FirstScreen({
  phase,
  initialName,
  initialAppearance,
  fixedName,
  message,
  floors,
  lastFloor,
  getToken,
  accountMenu,
  admin,
  onSignOut,
  touch,
  onJoin,
  onRefreshFloors,
}: FirstScreenProps) {
  const [state, dispatch] = useReducer(
    firstScreenReducer,
    phase,
    initialFirstScreen,
  );
  if (state.phase !== phase) dispatch({ type: "phase", phase });

  const [typedName, setTypedName] = useState(initialName);
  const [look, setLook] = useState(initialAppearance);
  const name = fixedName ?? typedName;
  const { screen } = state;

  // Esc goes back one step; it never abandons a connection that is being made
  useEffect(() => {
    if (screen !== "customize" && screen !== "farewell") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "back" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [screen]);

  const changeName = (next: string) => {
    setTypedName(next);
    saveName(next);
  };
  const changeLook = (next: Appearance) => {
    setLook(next);
    saveAppearance(next);
  };
  const enter = (floor: string) => onJoin(name, look, floor);
  const target = floorToEnter(lastFloor, floors);
  const targetRoom = floors?.find((floor) => floor.id === target);

  if (screen === "customize")
    return (
      <CharacterScreen
        name={typedName}
        appearance={look}
        fixedName={fixedName}
        accountMenu={accountMenu}
        touch={touch}
        onNameChange={changeName}
        onAppearanceChange={changeLook}
        onBack={() => dispatch({ type: "back" })}
      />
    );

  if (screen === "farewell")
    return (
      <main className={styles.farewell} style={backdropStyle}>
        <h1 className={styles.farewellTitle}>{FAREWELL_TITLE}</h1>
        <p className={styles.farewellText}>{FAREWELL_TEXT}</p>
        <Button autoFocus onPress={() => dispatch({ type: "back" })}>
          {FAREWELL_BACK}
        </Button>
      </main>
    );

  return (
    <>
      <MainMenu
        name={name}
        appearance={look}
        floors={floors}
        busy={screen === "joining"}
        message={message}
        roomName={targetRoom && !targetRoom.common ? targetRoom.name : null}
        accountMenu={accountMenu}
        admin={admin}
        signOutOnExit={onSignOut !== undefined}
        touch={touch}
        onEnter={() => enter(target)}
        onOtherOffice={() => {
          onRefreshFloors();
          dispatch({ type: "rooms", floors });
        }}
        onCustomize={() => dispatch({ type: "customize" })}
        onExit={() => (onSignOut ? onSignOut() : dispatch({ type: "exit" }))}
      />
      {screen === "rooms" && floors && (
        <ErrorBoundary
          fallback={<LoadFailed onClose={() => dispatch({ type: "back" })} />}
        >
          <Suspense fallback={null}>
            <RoomsMap
              floors={floors}
              current={target}
              beforeJoining
              getToken={getToken}
              onTravel={enter}
              onClose={() => dispatch({ type: "back" })}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  );
}
