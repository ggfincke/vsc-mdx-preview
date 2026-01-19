// AUTO-GENERATED FILE - DO NOT EDIT
// Source: packages/shared/registry/components.ts

import type { ModuleRegistry } from '../registry/ModuleRegistry';
import { createBarrelModule, createComponentModule } from './core';

import generic_Callout from '../../components/shims/generic/Callout';
import generic_Collapsible from '../../components/shims/generic/Collapsible';
import generic_Tabs from '../../components/shims/generic/Tabs';
import generic_TabItem from '../../components/shims/generic/TabItem';
import generic_CodeGroup from '../../components/shims/generic/CodeGroup';
import docusaurus_Tabs from '../../components/shims/docusaurus/Tabs';
import { TabItem as docusaurus_TabItem } from '../../components/shims/docusaurus/Tabs';
import docusaurus_CodeBlock from '../../components/shims/docusaurus/CodeBlock';
import docusaurus_Details from '../../components/shims/docusaurus/Details';
import * as starlight_components from '../../components/shims/starlight';
import starlight_Card from '../../components/shims/starlight/Card';
import starlight_CardGrid from '../../components/shims/starlight/CardGrid';
import starlight_LinkCard from '../../components/shims/starlight/LinkCard';
import starlight_Steps from '../../components/shims/starlight/Steps';
import starlight_Badge from '../../components/shims/starlight/Badge';
import starlight_Aside from '../../components/shims/starlight/Aside';
import { Tabs as starlight_Tabs } from '../../components/shims/starlight/Tabs';
import { TabItem as starlight_TabItem } from '../../components/shims/starlight/Tabs';
import starlight_FileTree from '../../components/shims/starlight/FileTree';
import starlight_Code from '../../components/shims/starlight/Code';
import nextjs_Image from '../../components/shims/nextjs/Image';
import nextjs_Link from '../../components/shims/nextjs/Link';
import * as nextra_components from '../../components/shims/nextra';
import nextra_Callout from '../../components/shims/nextra/Callout';
import nextra_Tabs from '../../components/shims/nextra/Tabs';
import nextra_Cards from '../../components/shims/nextra/Cards';
import nextra_FileTree from '../../components/shims/nextra/FileTree';
import nextra_Steps from '../../components/shims/nextra/Steps';
import nextra_Bleed from '../../components/shims/nextra/Bleed';

// preload all shim components into the module registry
export function preloadAllShims(registry: ModuleRegistry): void {
  registry.preload('npm://@mdx-preview/shims-generic/Callout', createComponentModule(generic_Callout, ["Callout","Alert","Admonition"]));
  registry.preload('npm://@mdx-preview/shims-generic/Collapsible', createComponentModule(generic_Collapsible, ["Collapsible","Accordion","Details"]));
  registry.preload('npm://@mdx-preview/shims-generic/Tabs', createComponentModule(generic_Tabs, ["Tabs"]));
  registry.preload('npm://@mdx-preview/shims-generic/TabItem', createComponentModule(generic_TabItem, ["TabItem","Tab"]));
  registry.preload('npm://@mdx-preview/shims-generic/CodeGroup', createComponentModule(generic_CodeGroup, ["CodeGroup"]));
  registry.preload('npm://@mdx-preview/shims-docusaurus/Tabs', createComponentModule(docusaurus_Tabs, ["Tabs"]));
  registry.preload('npm://@mdx-preview/shims-docusaurus/TabItem', createComponentModule(docusaurus_TabItem, ["TabItem"]));
  registry.preload('npm://@mdx-preview/shims-docusaurus/CodeBlock', createComponentModule(docusaurus_CodeBlock, ["CodeBlock"]));
  registry.preload('npm://@mdx-preview/shims-docusaurus/Details', createComponentModule(docusaurus_Details, ["Details"]));
  registry.preload('npm://@mdx-preview/shims-starlight/components', createBarrelModule(starlight_components, ["Card","CardGrid","LinkCard","Steps","Badge","Aside","Tabs","TabItem","FileTree","Code"]));
  registry.preload('npm://@mdx-preview/shims-starlight/Card', createComponentModule(starlight_Card, ["Card"]));
  registry.preload('npm://@mdx-preview/shims-starlight/CardGrid', createComponentModule(starlight_CardGrid, ["CardGrid"]));
  registry.preload('npm://@mdx-preview/shims-starlight/LinkCard', createComponentModule(starlight_LinkCard, ["LinkCard"]));
  registry.preload('npm://@mdx-preview/shims-starlight/Steps', createComponentModule(starlight_Steps, ["Steps"]));
  registry.preload('npm://@mdx-preview/shims-starlight/Badge', createComponentModule(starlight_Badge, ["Badge"]));
  registry.preload('npm://@mdx-preview/shims-starlight/Aside', createComponentModule(starlight_Aside, ["Aside"]));
  registry.preload('npm://@mdx-preview/shims-starlight/Tabs', createComponentModule(starlight_Tabs, ["Tabs"]));
  registry.preload('npm://@mdx-preview/shims-starlight/TabItem', createComponentModule(starlight_TabItem, ["TabItem"]));
  registry.preload('npm://@mdx-preview/shims-starlight/FileTree', createComponentModule(starlight_FileTree, ["FileTree"]));
  registry.preload('npm://@mdx-preview/shims-starlight/Code', createComponentModule(starlight_Code, ["Code"]));
  registry.preload('npm://@mdx-preview/shims-nextjs/Image', createComponentModule(nextjs_Image, ["Image"]));
  registry.preload('npm://@mdx-preview/shims-nextjs/Link', createComponentModule(nextjs_Link, ["Link"]));
  registry.preload('npm://@mdx-preview/shims-nextra/components', createBarrelModule(nextra_components, ["Callout","Tabs","Cards","FileTree","Steps","Bleed"]));
  registry.preload('npm://@mdx-preview/shims-nextra/Callout', createComponentModule(nextra_Callout, ["Callout"]));
  registry.preload('npm://@mdx-preview/shims-nextra/Tabs', createComponentModule(nextra_Tabs, ["Tabs"]));
  registry.preload('npm://@mdx-preview/shims-nextra/Cards', createComponentModule(nextra_Cards, ["Cards"]));
  registry.preload('npm://@mdx-preview/shims-nextra/FileTree', createComponentModule(nextra_FileTree, ["FileTree"]));
  registry.preload('npm://@mdx-preview/shims-nextra/Steps', createComponentModule(nextra_Steps, ["Steps"]));
  registry.preload('npm://@mdx-preview/shims-nextra/Bleed', createComponentModule(nextra_Bleed, ["Bleed"]));
}
