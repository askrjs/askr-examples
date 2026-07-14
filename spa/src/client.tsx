import { createSPA } from '@askrjs/askr/boot';
import { pageRegistry } from './application/routes.js';
import './styles.css';

await createSPA({ root: '#app', registry: pageRegistry });
