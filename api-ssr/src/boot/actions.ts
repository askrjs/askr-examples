import { handleAction } from "@askrjs/server/askr";
import { updateUserNameAction } from "../domains/users/actions.js";
import type { AppDependencies } from "./dependencies.js";

export function createActionHandlers() {
  return [
    handleAction<AppDependencies, { name: string }>(
      updateUserNameAction,
      async (ctx, input, dependencies) => {
        const user = await dependencies.users.find(ctx.params.id, ctx.signal);
        if (!user) return { redirect: "/workspace/users" };
        const result = await dependencies.users.update(
          user.id,
          { name: input.name.trim() },
          user.version,
        );
        return {
          redirect:
            result.kind === "updated"
              ? `/workspace/users/${encodeURIComponent(result.user.id)}`
              : "/workspace/users",
          result: result.kind === "updated" ? result.user : undefined,
        };
      },
    ),
  ] as const;
}
