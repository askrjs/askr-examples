import { createRouteRegistry, route } from '@askrjs/askr/router';
import { ActivityPage, NotFoundPage, OverviewPage } from './pages.js';

export const baseRoutePaths = ['/', '/activity', '/*'] as const;

export const pageRegistry = createRouteRegistry(() => {
  // Register additional application routes here.
  route('/', OverviewPage);
  route('/activity', ActivityPage);
  route('/*', NotFoundPage);
});
