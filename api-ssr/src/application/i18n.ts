import { createI18n } from '@askrjs/i18n';

export const workspaceText = createI18n('en', {
  en: {
    title: () => 'Language and region',
    description: () => 'The application owns locale selection and persistence.',
    field: () => 'Workspace language',
    current: (locale: string) => `Current locale: ${locale}`,
  },
  es: {
    title: () => 'Idioma y región',
    description: () => 'La aplicación controla el idioma y su persistencia.',
    field: () => 'Idioma del espacio de trabajo',
    current: (locale: string) => `Idioma actual: ${locale}`,
  },
});

export type WorkspaceLocale = keyof typeof workspaceText.catalogs;

export function readWorkspaceLocale(): WorkspaceLocale {
  if (typeof localStorage === 'undefined') return 'en';
  return localStorage.getItem('northstar-locale') === 'es' ? 'es' : 'en';
}

export function writeWorkspaceLocale(locale: WorkspaceLocale): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('northstar-locale', locale);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
  }
}
