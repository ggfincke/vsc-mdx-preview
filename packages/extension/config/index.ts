// packages/extension/config/index.ts
// public exports for configuration management

export {
  ConfigManager,
  type SettingKey,
  type SettingTypes,
} from './ConfigManager';

export { ConfigCache } from './ConfigCache';

// inlined type aliases (previously in types.ts)
// these provide semantic names for config value types
import type { SettingTypes } from './ConfigManager';

// controls when the preview updates: on typing, on save, or manually
export type UpdateMode = SettingTypes['preview.updateMode'];

// controls Tailwind CSS processing: auto-detect, always enabled, or disabled
export type TailwindEnabledSetting = SettingTypes['tailwind.enabled'];

// controls framework detection & shimming behavior
export type FrameworkSetting = SettingTypes['framework'];

// controls how unknown components are rendered
export type UnknownBehaviorSetting = SettingTypes['components.unknownBehavior'];
