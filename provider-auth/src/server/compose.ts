import type { AskrApp } from "@askrjs/server/askr";
import { providerMarker, modeMarker, type PublicConfig } from "../public-config.js";
/** virtual:askr-server and raw are two views of the exact same source app singleton. */
export function withApplicationLifecycle(
  composed: Pick<AskrApp, "fetch">,
  raw: AskrApp,
  config: PublicConfig,
): AskrApp {
  return Object.freeze({
    async fetch(request: Request) {
      const response = await composed.fetch(request);
      if (response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "text/html")
        return response;
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.delete("etag");
      headers.set("cache-control", "no-store");
      if (request.method === "HEAD")
        return new Response(null, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      let html = await response.text();
      for (const [marker, value] of [
        [providerMarker, config.provider],
        [modeMarker, config.mode],
      ] as const) {
        if (html.split(marker).length !== 2)
          throw new Error(
            "The authored provider document must contain each boot marker exactly once",
          );
        html = html.replace(marker, marker.replace(/__ASKR_(?:PROVIDER|MODE)__/u, value));
      }
      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    },
    close: () => raw.close(),
    toOpenApiDocument: () => raw.toOpenApiDocument(),
  });
}
