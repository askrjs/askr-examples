import { createSPA } from '@askrjs/askr/boot';
import { pageRegistry } from './routes.js';

await createSPA({ root: '#app', registry: pageRegistry });
