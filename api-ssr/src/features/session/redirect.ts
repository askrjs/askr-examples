const WORKSPACE_PATH = "/workspace";

export function safeNextPath(value: string | null | undefined, origin: string): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return WORKSPACE_PATH;

  const queryIndex = value.indexOf("?");
  const hashIndex = value.indexOf("#");
  const pathEnd = Math.min(
    queryIndex < 0 ? value.length : queryIndex,
    hashIndex < 0 ? value.length : hashIndex,
  );
  const path = value.slice(0, pathEnd);
  if (path.includes("\\")) return WORKSPACE_PATH;

  try {
    const decoded = decodeURIComponent(value);
    const decodedPath = decodeURIComponent(path);
    if (
      decodedPath.includes("\\") ||
      [...decoded].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127;
      }) ||
      decodedPath.startsWith("//") ||
      /^(?:\/)*(?:[a-z][a-z\d+.-]*:)/i.test(decodedPath) ||
      /(?:^|\/)\.\.(?:\/|$)/.test(decodedPath)
    ) {
      return WORKSPACE_PATH;
    }

    const base = new URL(origin);
    const target = new URL(value, base);
    if (target.origin !== base.origin || target.pathname.startsWith("//")) {
      return WORKSPACE_PATH;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return WORKSPACE_PATH;
  }
}
