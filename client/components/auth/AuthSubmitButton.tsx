import { ArrowUpRight } from "lucide-react";

interface AuthSubmitButtonProps {
  pending: boolean;
  label: string;
  pendingLabel: string;
  showIdleIcon?: boolean;
}

export function AuthSubmitButton({
  pending,
  label,
  pendingLabel,
  showIdleIcon = true,
}: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 flex h-14 min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-[#c4581a] px-5 text-base font-medium text-[#0b0d0f] transition duration-200 hover:bg-[#dd6a28] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c4581a] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span key={pending ? "pending" : "idle"} className="animate-in fade-in-0 duration-150">
        {pending ? pendingLabel : label}
      </span>
      {pending ? (
        <svg
          key="spinner"
          className="h-4 w-4 animate-spin animate-in fade-in-0 zoom-in-50 duration-200"
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M12 3a9 9 0 1 1-6.4 2.6" strokeLinecap="round" />
        </svg>
      ) : showIdleIcon ? (
        <ArrowUpRight
          key="arrow"
          className="h-5 w-5 animate-in fade-in-0 zoom-in-50 duration-200"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
}
