import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { AutoSaveCustomField } from "./AutoSaveCustomField";
import type { CustomFieldDefinitionSummary } from "./page-data";

// Renders the real component and reads the actual DOM output, so this
// catches the class of bug where the inline rename/edit affordance either
// leaks to Users who can't define Custom Fields, or never shows up for
// the Leads/Admins who need it (#60).
async function noopAction(): Promise<void> {}

const textDefinition: CustomFieldDefinitionSummary = {
  id: "def-1",
  name: "Clearance (mm)",
  type: "NUMBER",
  options: [],
};

const dropdownDefinition: CustomFieldDefinitionSummary = {
  id: "def-2",
  name: "Review status",
  type: "DROPDOWN",
  options: ["Open", "Closed"],
};

// A List Lead/Workspace Admin sees an "Edit" affordance for the
// definition, named after the field so multiple fields' edit controls
// stay distinguishable to assistive tech.
{
  const html = renderToStaticMarkup(
    <AutoSaveCustomField
      definition={textDefinition}
      defaultValue="1240"
      action={noopAction}
      canDefineCustomFields={true}
      editAction={noopAction}
    />
  );
  assert.match(html, /aria-label="Edit Clearance \(mm\) field"/);
}

// A plain List Member (canDefineCustomFields: false) can still set the
// value, but gets no definition-editing affordance at all.
{
  const html = renderToStaticMarkup(
    <AutoSaveCustomField
      definition={textDefinition}
      defaultValue="1240"
      action={noopAction}
      canDefineCustomFields={false}
      editAction={noopAction}
    />
  );
  assert.doesNotMatch(html, /Edit Clearance \(mm\) field/);
}

// The affordance renders for a DROPDOWN definition too, beside its value
// select rather than replacing it.
{
  const html = renderToStaticMarkup(
    <AutoSaveCustomField
      definition={dropdownDefinition}
      defaultValue="Open"
      action={noopAction}
      canDefineCustomFields={true}
      editAction={noopAction}
    />
  );
  assert.match(html, /aria-label="Edit Review status field"/);
  assert.match(html, /<select[^>]*>/);
}

console.log("AutoSaveCustomField edit-affordance test passed");
