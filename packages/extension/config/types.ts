// packages/extension/config/types.ts
// Extracted setting value types for use outside ConfigManager

import type { SettingTypes } from './ConfigManager';

// Update mode setting values
// Controls when the preview updates: on typing, on save, or manually
export type UpdateMode = SettingTypes['preview.updateMode'];

// Tailwind enabled setting values
// Controls Tailwind CSS processing: auto-detect, always enabled, or disabled
export type TailwindEnabledSetting = SettingTypes['tailwind.enabled'];

// Framework setting values
// Controls framework detection & shimming behavior
export type FrameworkSetting = SettingTypes['framework'];

// Component unknown behavior setting values
// Controls how unknown components are rendered
export type UnknownBehaviorSetting = SettingTypes['components.unknownBehavior'];
