"use client";

import { useActionState, useState } from "react";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";

import {
  confirmTwoFactorEnrollmentAction,
  enableTwoFactorAction,
  type ConfirmTwoFactorState,
  type EnableTwoFactorState,
} from "./actions";
import { TwoFactorEnabledPanel } from "./TwoFactorEnabledPanel";

const inputWrapperClass =
  "flex items-center border border-surface-3 bg-surface-1/95 transition-colors group-hover:border-line-strong group-focus-within:border-[#ff6b4a]";
const inputClass =
  "h-[58px] min-w-0 flex-1 bg-transparent px-4 text-sm text-ink outline-none placeholder:text-ink-faint";
const primaryButtonClass =
  "mt-2 inline-flex h-[58px] min-h-[58px] items-center justify-center gap-3 border border-[#ff6b4a] bg-[#ff6b4a] px-6 py-4 text-sm font-medium text-black shadow-[0_0_0_1px_rgba(255,107,74,.18),0_18px_60px_rgba(255,107,74,.12)] transition-colors hover:bg-[#ff8a70] focus:outline-none focus:ring-2 focus:ring-[#ff8a70] focus:ring-offset-2 focus:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-60";
const initialEnableTwoFactorState: EnableTwoFactorState = { status: "idle" };
const initialConfirmTwoFactorState: ConfirmTwoFactorState = { status: "idle" };

export function TwoFactorSettings({
  twoFactorEnabled,
}: {
  twoFactorEnabled: boolean;
}) {
  const [enableState, enableFormAction, isEnabling] = useActionState(
    enableTwoFactorAction,
    initialEnableTwoFactorState
  );
  const [confirmState, confirmFormAction, isConfirming] = useActionState(
    confirmTwoFactorEnrollmentAction,
    initialConfirmTwoFactorState
  );
  const [codesSavedConfirmed, setCodesSavedConfirmed] = useState(false);

  if (twoFactorEnabled) {
    return <TwoFactorEnabledPanel />;
  }

  if (enableState.status === "awaiting-confirmation") {
    return (
      <div className="grid gap-6">
        <div>
          <p className="mb-3 text-sm text-ink-muted">
            Scan this QR code with your authenticator app, or enter the secret
            manually.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- a locally generated data: URL, not a next/image-eligible remote asset */}
          <img
            src={enableState.qrCodeDataUrl}
            alt="Two-factor authentication QR code"
            className="mb-3 h-48 w-48 border border-surface-3 bg-white p-2"
          />
          <p
            data-testid="totp-manual-secret"
            className="break-all font-mono text-xs text-ink-muted"
          >
            {enableState.manualSecret}
          </p>
        </div>

        <div>
          <p className="mb-3 text-sm text-ink-muted">
            Save these ten recovery codes somewhere safe. Each one works once,
            and this is the only time they&apos;ll be shown.
          </p>
          <ul className="grid grid-cols-2 gap-2 border border-surface-3 bg-surface-1 p-4 font-mono text-sm text-ink">
            {enableState.backupCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={codesSavedConfirmed}
            onChange={(event) => setCodesSavedConfirmed(event.target.checked)}
          />
          I&apos;ve saved my recovery codes.
        </label>

        <form action={confirmFormAction} className="grid gap-5">
          <input
            type="hidden"
            name="recoveryCodesSaved"
            value={codesSavedConfirmed ? "true" : "false"}
          />
          <div className="group">
            <label
              htmlFor="totp-code"
              className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted"
            >
              Authenticator code
            </label>
            <div className={inputWrapperClass}>
              <KeyRound
                className="ml-4 h-5 w-5 text-ink-faint"
                strokeWidth={1.7}
                aria-hidden="true"
              />
              <input
                id="totp-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                required
                className={inputClass}
              />
            </div>
          </div>

          {confirmState.status === "error" ? (
            <p role="alert" className="text-sm text-[#ff8a70] animate-in fade-in-0 slide-in-from-top-1 duration-200">
              {confirmState.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!codesSavedConfirmed || isConfirming}
            className={primaryButtonClass}
          >
            {isConfirming ? "Confirming..." : "Confirm and enable 2FA"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={enableFormAction} className="grid gap-5">
      <p className="text-sm text-ink-muted">
        Enable two-factor authentication with an authenticator app.
      </p>

      <div className="group">
        <label
          htmlFor="enable-password"
          className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-ink-muted"
        >
          Password
        </label>
        <div className={inputWrapperClass}>
          <LockKeyhole
            className="ml-4 h-5 w-5 text-ink-faint"
            strokeWidth={1.7}
            aria-hidden="true"
          />
          <input
            id="enable-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Confirm your password"
            required
            className={inputClass}
          />
        </div>
      </div>

      {enableState.status === "error" ? (
        <p role="alert" className="text-sm text-[#ff8a70] animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {enableState.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isEnabling}
        className={primaryButtonClass}
      >
        <ShieldCheck className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        <span>{isEnabling ? "Starting..." : "Enable 2FA"}</span>
      </button>
    </form>
  );
}
