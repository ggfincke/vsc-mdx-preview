// packages/extension/config/types.ts
// extracted setting value types for use outside ConfigManager

import type { SettingTypes } from './ConfigManager';

// update mode setting values
// controls when the preview updates: on typing, on save, or manually
export type UpdateMode = SettingTypes['preview.updateMode'];

// tailwind enabled setting values
// controls Tailwind CSS processing: auto-detect, always enabled, or disabled
export type TailwindEnabledSetting = SettingTypes['tailwind.enabled'];

// framework setting values
// controls framework detection & shimming behavior
export type FrameworkSetting = SettingTypes['framework'];

// component unknown behavior setting values
// controls how unknown components are rendered
export type UnknownBehaviorSetting = SettingTypes['components.unknownBehavior'];
