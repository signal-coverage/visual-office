import { useEffect } from "react";

export const LocatorSetup = () => {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      import("@locator/runtime").then(({ default: setupLocatorUI }) => {
        setupLocatorUI();
      });
    }
  }, []);

  return null;
};
