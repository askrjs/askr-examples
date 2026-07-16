import { serve } from "@askrjs/node";
import { createApp } from "./app.js";

const app = createApp();

const port = Number(process.env.PORT ?? 3001);
const running = await serve(app, {
  port,
  host: process.env.HOST ?? "127.0.0.1",
  assets: { root: new URL("../dist", import.meta.url).pathname },
});
console.log(`SSR example listening on ${running.url}`);
