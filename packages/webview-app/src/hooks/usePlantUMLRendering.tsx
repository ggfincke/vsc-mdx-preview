// packages/webview-app/src/hooks/usePlantUMLRendering.tsx
// shared hook for PlantUML rendering in Safe & Trusted modes

import { createDiagramRendering } from './createDiagramRendering';
import { PlantUMLRenderer } from '../components/PlantUMLRenderer/PlantUMLRenderer';
import { findPlantUMLContainers } from '../utils/findPlantUMLContainers';

// timing mode for PlantUML scanning
export type PlantUMLScanMode = 'after-paint' | 'before-paint';

// hook for PlantUML detection & portal rendering
export const usePlantUMLRendering = createDiagramRendering({
  findContainers: findPlantUMLContainers,
  renderElement: (diagram) => (
    <PlantUMLRenderer id={diagram.id} code={diagram.code} />
  ),
});
