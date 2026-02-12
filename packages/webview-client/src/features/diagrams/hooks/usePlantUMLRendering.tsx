// packages/webview-app/src/hooks/usePlantUMLRendering.tsx
// shared hook for PlantUML rendering in Safe & Trusted modes

import { createDiagramRendering } from './createDiagramRendering';
import { PlantUMLRenderer } from '../ui/PlantUMLRenderer/PlantUMLRenderer';
import { findPlantUMLContainers } from '../utils/findPlantUMLContainers';

// hook for PlantUML detection & portal rendering
export const usePlantUMLRendering = createDiagramRendering({
  findContainers: findPlantUMLContainers,
  renderElement: (diagram) => (
    <PlantUMLRenderer id={diagram.id} code={diagram.code} />
  ),
});
