import { createApp } from '../app.js';
import { createDependencies } from '../boot/dependencies.js';

const app = createApp(createDependencies());

export { app };
export default app;
