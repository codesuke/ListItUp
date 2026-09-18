"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

const COPIED_INDICATOR_DURATION_MS = 1500;

// Share (#44) is narrowly scoped to copying a direct link to an Item — no
// broader sharing/permission-grant surface. The link is just the existing
// Item detail URL; access to it is enforced there, not here.
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function handleClick() {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_INDICATOR_DURATION_MS);
      })
      .catch(() => {
        // Clipboard access can be denied by the browser (permission,
        // insecure context) — the button simply stays in its default
        // state so the User can retry rather than seeing a crash.
      });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={copied ? "Link copied" : "Copy link to this Item"}
      className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[6px] border border-line-strong bg-surface-2 text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
    >
      {copied ? (
        <Check key="copied" className="h-3.5 w-3.5 animate-in fade-in-0 zoom-in-50 duration-200" />
      ) : (
        <Share2 key="share" className="h-3.5 w-3.5 animate-in fade-in-0 zoom-in-50 duration-200" />
      )}
    </button>
  );
}
