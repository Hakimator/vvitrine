import { education } from './education.ts';
import { awards, certificates, publications, volunteer } from './entries.ts';
import { hero } from './hero.ts';
import { languages } from './languages.ts';
import { projects } from './projects.ts';
import { skills } from './skills.ts';
import { work } from './work.ts';

export { awards, certificates, education, hero, languages, projects, publications, skills, volunteer, work };
export type { HeroAction, HeroView } from './hero.ts';
export { initialsOf } from './hero.ts';
export type { WorkView } from './work.ts';
export type { EducationView } from './education.ts';
export type { SkillsView } from './skills.ts';
export type { LanguagesView } from './languages.ts';
export type { ProjectDetailView, ProjectsView, ProjectSummary } from './projects.ts';
export { slugify } from './shared.ts';

/** Convenience: every built-in section, in a sensible default order. */
export const allSections = () => [
  hero(),
  projects(),
  work(),
  education(),
  volunteer(),
  skills(),
  certificates(),
  awards(),
  publications(),
  languages(),
];
