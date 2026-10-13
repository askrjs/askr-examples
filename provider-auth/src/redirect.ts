/** Same local path/query/fragment boundary used by the qualified api-ssr stage. */
export function safeReturnTo(value: string | null | undefined, origin: string): string {
  const fallback = "/account";
  if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
  const end = Math.min(
    ...[value.indexOf("?"), value.indexOf("#")].map((index) => (index < 0 ? value.length : index)),
  );
  const path = value.slice(0, end);
  if (path.includes("\\")) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    const decodedPath = decodeURIComponent(path);
    if (
      decodedPath.includes("\\") ||
      /[\x00-\x1f\x7f]/u.test(decoded) ||
      decodedPath.startsWith("//") ||
      /^(?:\/)*(?:[a-z][a-z\d+.-]*:)/iu.test(decodedPath) ||
      /(?:^|\/)\.\.(?:\/|$)/u.test(decodedPath)
    )
      return fallback;
    const base = new URL(origin);
    const target = new URL(value, base);
    if (target.origin !== base.origin || target.pathname.startsWith("//")) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
