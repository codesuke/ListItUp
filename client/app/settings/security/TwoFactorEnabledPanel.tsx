"use client";

import { useActionState } from "react";
import { KeyRound, LockKeyhole, ShieldOff } from "lucide-react";

import {
  disableTwoFactorAction,
  regenerateBackupCodesAction,
  type DisableTwoFactorState,
  type RegenerateBackupCodesState,
} from "./actions";

const inputWrapperClass =
  "flex items-center border border-[#1a1a1a] bg-[#0d0d0d]/95 transition-colors group-hover:border-[#333333] group-focus-within:border-[#ff6b4a]";
const inputClass =
  "h-[58px] min-w-0 flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-neutral-700";
const secondaryButtonClass =
  "mt-2 inline-flex h-[58px] min-h-[58px] items-center justify-center gap-3 border border-[#1a1a1a] bg-[#0d0d0d]/95 px-6 py-4 text-sm text-neutral-300 transition-colors hover:border-[#333333] hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
const initialDisableTwoFactorState: DisableTwoFactorState = { status: "idle" };
const initialRegenerateBackupCodesState: RegenerateBackupCodesState = {
  status: "idle",
};

export function TwoFactorEnabledPanel() {
  const [disableState, disableFormAction, isDisabling] = useActionState(
    disableTwoFactorAction,
    initialDisableTwoFactorState
  );
  const [regenerateState, regenerateFormAction, isRegenerating] =
    useActionState(
      regenerateBackupCodesAction,
      initialRegenerateBackupCodesState
    );

  if (disableState.status === "success") {
    return (
      <p className="text-sm text-neutral-300">
        Two-factor authentication is now disabled on your account.
      </p>
    );
  }

  return (
    <div className="grid gap-8">
      <p className="text-sm text-neutral-300">
        Two-factor authentication is enabled on your account.
      </p>

      <div>
        <h3 className="mb-3 text-sm text-white">Recovery codes</h3>
        {regenerateState.status === "success" ? (
          <ul className="grid grid-cols-2 gap-2 border border-[#1a1a1a] bg-[#0d0d0d] p-4 font-mono text-sm text-neutral-300">
            {regenerateState.backupCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        ) : (
          <form action={regenerateFormAction} className="grid gap-4">
            <p className="text-sm text-neutral-400">
              Generating new recovery codes invalidates your old ones.
            </p>
            <div className="group">
              <div className={inputWrapperClass}>
                <LockKeyhole
                  className="ml-4 h-5 w-5 text-neutral-600"
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Confirm your password"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {regenerateState.status === "error" ? (
              <p role="alert" className="text-sm text-[#ff8a70]">
                {regenerateState.message}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isRegenerating}
              className={secondaryButtonClass}
            >
              {isRegenerating ? "Generating..." : "Regenerate recovery codes"}
            </button>
          </form>
        )}
      </div>

      <div className="border-t border-[#1a1a1a] pt-8">
        <h3 className="mb-3 text-sm text-white">
          Disable two-factor authentication
        </h3>
        <form action={disableFormAction} className="grid gap-4">
          <div className="group">
            <label
              htmlFor="disable-password"
              className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500"
            >
              Password
            </label>
            <div className={inputWrapperClass}>
              <LockKeyhole
                className="ml-4 h-5 w-5 text-neutral-600"
                strokeWidth={1.7}
                aria-hidden="true"
              />
              <input
                id="disable-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </div>
          </div>

          <div className="group">
            <label
              htmlFor="disable-code"
              className="mb-3 block font-mono text-[11px] uppercase tracking-[0.22em] text-neutral-500"
            >
              Two-factor or recovery code
            </label>
            <div className={inputWrapperClass}>
              <KeyRound
                className="ml-4 h-5 w-5 text-neutral-600"
                strokeWidth={1.7}
                aria-hidden="true"
              />
              <input
                id="disable-code"
                name="code"
                type="text"
                autoComplete="one-time-code"
                required
                className={inputClass}
              />
            </div>
          </div>

          {disableState.status === "error" ? (
            <p role="alert" className="text-sm text-[#ff8a70]">
              {disableState.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isDisabling}
            className={secondaryButtonClass}
          >
            <ShieldOff
              className="h-5 w-5"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span>{isDisabling ? "Disabling..." : "Disable 2FA"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
