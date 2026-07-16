import { state } from "@askrjs/askr";
import { Label, PageHeader, Stack } from "@askrjs/themes/components";
import {
  readWorkspaceLocale,
  workspaceText,
  writeWorkspaceLocale,
  type WorkspaceLocale,
} from "../../application/i18n.js";

function LocaleContent({
  locale,
  select,
}: {
  locale: WorkspaceLocale;
  select: (locale: WorkspaceLocale) => void;
}) {
  const snapshot = workspaceText.dehydrate();
  return (
    <Stack gap="4" data-catalog={snapshot.catalog}>
      <PageHeader
        title={workspaceText.text("title")}
        description={workspaceText.text("description")}
      />
      <Label for="workspace-locale">{workspaceText.text("field")}</Label>
      <select
        id="workspace-locale"
        name="locale"
        value={locale}
        onChange={(event: Event) =>
          select((event.target as HTMLSelectElement).value as WorkspaceLocale)
        }
      >
        <option value="en">English</option>
        <option value="es">Español</option>
      </select>
      <p role="status">{workspaceText.text("current", locale)}</p>
    </Stack>
  );
}

export function LocalePage() {
  const [locale, setLocale] = state<WorkspaceLocale>(readWorkspaceLocale());
  const select = (next: WorkspaceLocale): void => {
    writeWorkspaceLocale(next);
    setLocale(next);
  };
  return (
    <workspaceText.Scope locale={locale()} dir="ltr">
      <LocaleContent locale={locale()} select={select} />
    </workspaceText.Scope>
  );
}
