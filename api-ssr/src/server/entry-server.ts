import { createApp } from '../app.js';
import { createDependencies } from '../boot/dependencies.js';

// Create dependencies once at the server composition root, not inside handlers.
const app = createApp(createDependencies());

export { app };
export default app;
