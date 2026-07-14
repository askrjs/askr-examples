import '@askrjs/themes/default';
import { hydrateSPA } from '@askrjs/askr/boot';
import { pageRegistry } from './routes.js';

await hydrateSPA({ root: '#app', registry: pageRegistry });
