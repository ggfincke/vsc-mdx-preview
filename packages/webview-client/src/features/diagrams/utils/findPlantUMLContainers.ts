// packages/webview-app/src/utils/findPlantUMLContainers.ts
// extract PlantUML diagram info from DOM containers

import {
  createDiagramContainerFinder,
  type BaseDiagramInfo,
} from './createDiagramContainerFinder';

export type PlantUMLDiagramInfo = BaseDiagramInfo;

// find all PlantUML containers w/ data attributes in given root
export const findPlantUMLContainers =
  createDiagramContainerFinder<PlantUMLDiagramInfo>({
    selector: '.plantuml-container[data-plantuml-code]',
    attributes: {
      codeAttr: 'data-plantuml-code',
      idAttr: 'data-plantuml-id',
    },
  });
