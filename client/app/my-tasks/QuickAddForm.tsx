import { Plus } from "lucide-react";

export function QuickAddForm({ quickAddItemAction }: { quickAddItemAction: (formData: FormData) => Promise<void> }) {
  return (
    <form
      action={quickAddItemAction}
      className="mb-4 flex items-center gap-3 rounded-[12px] border border-line bg-surface-2 px-4 py-3"
    >
      <Plus className="h-4 w-4 flex-shrink-0 text-[#ff8a70]" />
      <input
        type="text"
        name="quickAddText"
        placeholder='Add a task — try "Fix platform signage tomorrow #retrofit @sam /Client Deliverables"'
        required
        className="flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-faint"
      />
      <span className="whitespace-nowrap rounded-[5px] bg-surface-4 px-[7px] py-[2px] font-[family-name:var(--font-mono-label)] text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
        Quick-Add
      </span>
    </form>
  );
}
