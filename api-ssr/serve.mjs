import { fileURLToPath } from "node:url";
import { serve } from "@askrjs/node";
import app from "./dist/server/production.js";

await serve(app, {
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? 3002),
  assets: { root: fileURLToPath(new URL("./dist/", import.meta.url)) },
});
