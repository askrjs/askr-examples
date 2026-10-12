import { defineQuery } from "@askrjs/askr/data";
export const privateValue = Object.freeze({
  message: "Private query belongs to the current signed-in application",
});
export const privateQuery = defineQuery<Record<string, never>, { readonly message: string }>({
  key: () => "provider-private",
  fetch: async (_input, { signal }) => {
    const response = await fetch("/api/private", {
      signal,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new Error("Private query is unavailable");
    const data: unknown = await response.json();
    if (
      !data ||
      typeof data !== "object" ||
      !("message" in data) ||
      typeof data.message !== "string"
    )
      throw new Error("Invalid private query response");
    return { message: data.message };
  },
});
