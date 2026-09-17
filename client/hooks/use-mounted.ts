import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

// True only after client hydration — gates browser-only state (e.g. resolvedTheme) so server and first client render match.
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}
