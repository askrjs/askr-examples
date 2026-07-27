import { fileURLToPath } from "node:url";
import { serve } from "@askrjs/node";
import { createApp } from "./app.js";
import { createDependencies } from "./boot/dependencies.js";

const app = createApp(createDependencies());

const port = Number(process.env.PORT ?? 3002);
const running = await serve(app, {
  port,
  host: process.env.HOST ?? "127.0.0.1",
  assets: { root: fileURLToPath(new URL("../dist", import.meta.url)) },
});
console.log(`API + SSR example listening on ${running.url}`);
