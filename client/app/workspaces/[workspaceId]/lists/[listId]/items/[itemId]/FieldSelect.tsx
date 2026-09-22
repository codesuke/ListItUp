import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { INPUT_CLASS } from "./panel-styles";

// Native <select> chrome (the OS-drawn arrow and its own internal padding)
// doesn't match this design system and can't be restyled directly, so
// every dropdown on this page wraps one in a positioned container and
// repaints the arrow with a Lucide icon instead of a raw, unstyled browser
// control.
export function FieldSelect({
  wrapperClassName,
  className,
  controlClassName = INPUT_CLASS,
  children,
  ...props
}: ComponentProps<"select"> & { wrapperClassName?: string; controlClassName?: string }) {
  return (
    <div className={`relative inline-block ${wrapperClassName ?? ""}`}>
      <select {...props} className={`w-full appearance-none pr-8 ${controlClassName} ${className ?? ""}`}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
    </div>
  );
}
