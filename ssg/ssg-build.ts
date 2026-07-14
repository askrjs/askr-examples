import { createStaticGen } from '@askrjs/askr/ssg';
import { staticConfig } from './ssg.config.js';

const result = await createStaticGen(staticConfig).generate();
if (result.failed > 0) {
  throw new Error(`Static generation failed for ${result.failed} route(s).`);
}
console.log(`Generated ${result.successful}/${result.totalRoutes} runbook pages.`);
