import { RESERVED_KEYS } from './content/schemas.ts';
import {
  ContentOwnershipError,
  DuplicatePluginError,
  DuplicateSectionError,
  IncompatiblePluginError,
  MissingCapabilityError,
  ThemeCountError,
  VVitrineError,
} from './errors.ts';
import {
  SUPPORTED_API_VERSIONS,
  type GeneratorPlugin,
  type Plugin,
  type SectionPlugin,
  type ServicePlugin,
  type SourcePlugin,
  type ThemePlugin,
} from './plugin.ts';

/**
 * Holds registered plugins and enforces the plugin contract: API version, unique names,
 * unique section ids, single owner per content key, exactly one theme, satisfied capabilities.
 */
export class PluginRegistry {
  private readonly byName = new Map<string, Plugin>();
  private readonly sectionsById = new Map<string, SectionPlugin<any, any, any>>();
  private readonly contentOwners = new Map<string, SectionPlugin<any, any, any>>();

  constructor(plugins: readonly Plugin[]) {
    for (const plugin of plugins) this.register(plugin);
    this.checkThemeCount();
    this.checkCapabilities();
  }

  private register(plugin: Plugin): void {
    if (!(SUPPORTED_API_VERSIONS as readonly number[]).includes(plugin.apiVersion)) {
      throw new IncompatiblePluginError(plugin.name, plugin.apiVersion, SUPPORTED_API_VERSIONS);
    }
    if (this.byName.has(plugin.name)) throw new DuplicatePluginError(plugin.name);
    this.byName.set(plugin.name, plugin);
    if (plugin.kind === 'section') this.registerSection(plugin);
  }

  private registerSection(section: SectionPlugin<any, any, any>): void {
    const existing = this.sectionsById.get(section.id);
    if (existing) throw new DuplicateSectionError(section.id, existing.name, section.name);
    this.sectionsById.set(section.id, section);

    if (!section.content) return;
    const { key } = section.content;
    if ((RESERVED_KEYS as readonly string[]).includes(key)) {
      throw new VVitrineError(`Plugin "${section.name}" cannot own the reserved content key "${key}".`);
    }
    const owner = this.contentOwners.get(key);
    if (owner) throw new ContentOwnershipError(key, owner.name, section.name);
    this.contentOwners.set(key, section);
  }

  private checkThemeCount(): void {
    const themes = this.ofKind('theme');
    if (themes.length !== 1) throw new ThemeCountError(themes.map((t) => t.name));
  }

  private checkCapabilities(): void {
    const provided = new Set(this.all().flatMap((p) => p.provides ?? []));
    for (const plugin of this.all()) {
      for (const capability of plugin.requires ?? []) {
        if (!provided.has(capability)) throw new MissingCapabilityError(plugin.name, capability, []);
      }
    }
  }

  all(): readonly Plugin[] {
    return [...this.byName.values()];
  }

  ofKind(kind: 'source'): SourcePlugin[];
  ofKind(kind: 'section'): SectionPlugin<any, any, any>[];
  ofKind(kind: 'theme'): ThemePlugin[];
  ofKind(kind: 'service'): ServicePlugin[];
  ofKind(kind: 'generator'): GeneratorPlugin[];
  ofKind(kind: Plugin['kind']): Plugin[] {
    return this.all().filter((p) => p.kind === kind);
  }

  get theme(): ThemePlugin {
    return this.ofKind('theme')[0]!;
  }

  section(id: string): SectionPlugin<any, any, any> | undefined {
    return this.sectionsById.get(id);
  }

  sectionIds(): string[] {
    return [...this.sectionsById.keys()];
  }

  owner(key: string): SectionPlugin<any, any, any> | undefined {
    return this.contentOwners.get(key);
  }

  ownedKeys(): string[] {
    return [...this.contentOwners.keys()];
  }
}
