import { readWorkspaceLocale } from "./application/i18n.js";

document.documentElement.lang = readWorkspaceLocale();
document.documentElement.dir = "ltr";
