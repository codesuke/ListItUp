import { Plus } from "lucide-react";

// A quiet capture row, not a boxed card: the primary action (adding a task)
// is the one place besides the sidebar's active-nav bar that earns brand
// orange (DESIGN.md's Three Uses Rule). A bottom hairline is enough to mark
// where typing happens; it doesn't need a full bordered container to read
// as an input.
export function QuickAddForm({ quickAddItemAction }: { quickAddItemAction: (formData: FormData) => Promise<void> }) {
  return (
    <form
      action={quickAddItemAction}
      className="mb-6 flex items-center gap-3 border-b border-line px-1 pb-3 transition-colors focus-within:border-[#ff6b4a]/40"
    >
      <Plus className="h-4 w-4 flex-shrink-0 text-[#ff8a70]" />
      <input
        type="text"
        name="quickAddText"
        placeholder='Add a task — try "Fix platform signage tomorrow #retrofit @sam /Client Deliverables"'
        required
        className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-faint"
      />
    </form>
  );
}
