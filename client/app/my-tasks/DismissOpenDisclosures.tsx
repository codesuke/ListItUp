"use client";

import { useEffect } from "react";

// Native <details> has no light-dismiss: once a Workspace/Sort/Group menu
// (OptionsDisclosure in page.tsx) is opened it stays open until its own
// <summary> is clicked again, even after a click elsewhere on the page that
// isn't itself a navigation. This closes any open `data-disclosure`
// <details> on an outside click or Escape, as the one small client island
// this page needs rather than turning every disclosure into a Client
// Component.
export function DismissOpenDisclosures() {
  useEffect(() => {
    function closeOpenExcept(target: Node | null) {
      document.querySelectorAll<HTMLDetailsElement>("details[data-disclosure][open]").forEach((details) => {
        if (!target || !details.contains(target)) details.open = false;
      });
    }
    function handlePointerDown(event: PointerEvent) {
      closeOpenExcept(event.target as Node | null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeOpenExcept(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
