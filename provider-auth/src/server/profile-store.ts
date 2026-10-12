/** Single-process display storage, never a source of authentication or permissions. */
export function createDisplayProfiles(clock: () => number) {
  const values = new Map<string, { label: string; expiresAt: number }>();
  const prune = () => {
    for (const [key, value] of values) if (value.expiresAt <= clock()) values.delete(key);
  };
  return {
    remember(
      id: string,
      principal: Readonly<Record<string, unknown>>,
      hint?: { givenName?: string; familyName?: string },
    ) {
      prune();
      const name = [hint?.givenName, hint?.familyName]
        .filter((part): part is string => typeof part === "string")
        .join(" ")
        .slice(0, 128);
      const email =
        principal.email_verified === true && typeof principal.email === "string"
          ? principal.email.slice(0, 128)
          : "";
      const label = name || email;
      if (!label) return;
      if (!values.has(id) && values.size >= 1000) {
        const oldest = values.keys().next().value;
        if (oldest !== undefined) values.delete(oldest);
      }
      values.set(id, { label, expiresAt: clock() + 8 * 60 * 60 * 1000 });
    },
    label(id: string) {
      prune();
      return values.get(id)?.label;
    },
    close() {
      values.clear();
    },
  };
}
