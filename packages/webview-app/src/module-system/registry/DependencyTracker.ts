// packages/webview-app/src/module-system/registry/DependencyTracker.ts
// dependency graph & resolution map w/ O(k) cleanup via reverse indexes

// tracks module dependencies & import resolution
// uses dual-index system for O(k) cleanup instead of O(n) full scan
export class DependencyTracker {
  // map (parentId, request) -> resolved fsPath for relative imports
  private resolutionMap: Map<string, string> = new Map();

  // Reverse indexes for O(k) cleanup:
  // - parentToResolutionKeys: moduleId -> Set of resolution keys where moduleId is parent
  // - targetToResolutionKeys: moduleId -> Set of resolution keys where moduleId is target (value)
  private parentToResolutionKeys: Map<string, Set<string>> = new Map();
  private targetToResolutionKeys: Map<string, Set<string>> = new Map();

  // reverse dependency graph: moduleId -> set of modules that depend on it
  private dependents: Map<string, Set<string>> = new Map();

  // create key for resolution map
  private makeResolutionKey(parentId: string, request: string): string {
    return `${parentId}\0${request}`;
  }

  // register a resolved path for a (parent, request) pair
  // maintains reverse indexes for O(k) cleanup
  setResolution(parentId: string, request: string, fsPath: string): void {
    const key = this.makeResolutionKey(parentId, request);

    // Clean up old target mapping if this key existed
    const oldTarget = this.resolutionMap.get(key);
    if (oldTarget) {
      this.targetToResolutionKeys.get(oldTarget)?.delete(key);
    }

    // Set the resolution
    this.resolutionMap.set(key, fsPath);

    // Update parent index
    if (!this.parentToResolutionKeys.has(parentId)) {
      this.parentToResolutionKeys.set(parentId, new Set());
    }
    this.parentToResolutionKeys.get(parentId)!.add(key);

    // Update target index
    if (!this.targetToResolutionKeys.has(fsPath)) {
      this.targetToResolutionKeys.set(fsPath, new Set());
    }
    this.targetToResolutionKeys.get(fsPath)!.add(key);
  }

  // get resolved fsPath for a (parent, request) pair
  getResolution(parentId: string, request: string): string | undefined {
    const key = this.makeResolutionKey(parentId, request);
    return this.resolutionMap.get(key);
  }

  // record that moduleId depends on dependsOnId
  addDependency(moduleId: string, dependsOnId: string): void {
    if (!this.dependents.has(dependsOnId)) {
      this.dependents.set(dependsOnId, new Set());
    }
    this.dependents.get(dependsOnId)!.add(moduleId);
  }

  // get all modules that depend on the given module
  getDependents(moduleId: string): Set<string> | undefined {
    return this.dependents.get(moduleId);
  }

  // get number of dependency relationships tracked
  get dependentsCount(): number {
    return this.dependents.size;
  }

  // get number of resolution mappings
  get resolutionsCount(): number {
    return this.resolutionMap.size;
  }

  // remove all resolutionMap entries for moduleId (as parent or target)
  // O(k) via reverse indexes instead of O(n) full scan
  cleanResolutionMapFor(moduleId: string): void {
    // Clean entries where moduleId is parent
    const parentKeys = this.parentToResolutionKeys.get(moduleId);
    if (parentKeys) {
      for (const key of parentKeys) {
        const target = this.resolutionMap.get(key);
        if (target) {
          this.targetToResolutionKeys.get(target)?.delete(key);
        }
        this.resolutionMap.delete(key);
      }
      this.parentToResolutionKeys.delete(moduleId);
    }

    // Clean entries where moduleId is target
    const targetKeys = this.targetToResolutionKeys.get(moduleId);
    if (targetKeys) {
      for (const key of targetKeys) {
        const parentId = key.split('\0')[0];
        this.parentToResolutionKeys.get(parentId)?.delete(key);
        this.resolutionMap.delete(key);
      }
      this.targetToResolutionKeys.delete(moduleId);
    }
  }

  // remove module from all dependents sets & delete its own entry
  cleanDependentsFor(moduleId: string): void {
    // Remove this module's entry as a dependency target
    this.dependents.delete(moduleId);

    // Remove this module from all other modules' dependent sets
    for (const [, deps] of this.dependents) {
      deps.delete(moduleId);
    }
  }

  // collect all modules that transitively depend on the given module
  // AND clean up all tracking metadata for those modules
  // returns a Set of all module IDs that were invalidated
  invalidateWithDependents(moduleId: string): Set<string> {
    const invalidated = new Set<string>();
    const queue = [moduleId];

    // First pass: collect all modules to invalidate
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (invalidated.has(current)) {
        continue;
      }

      invalidated.add(current);

      // Queue all modules that depend on this one
      const deps = this.dependents.get(current);
      if (deps) {
        for (const dep of deps) {
          if (!invalidated.has(dep)) {
            queue.push(dep);
          }
        }
      }
    }

    // Second pass: clean up all metadata for ALL invalidated modules (batch cleanup)
    for (const id of invalidated) {
      this.cleanDependentsFor(id);
      this.cleanResolutionMapFor(id);
    }

    return invalidated;
  }

  // clear the dependency graph (but keep resolution map)
  clearDependencies(): void {
    this.dependents.clear();
  }

  // clear resolution map
  clearResolutions(): void {
    this.resolutionMap.clear();
    this.parentToResolutionKeys.clear();
    this.targetToResolutionKeys.clear();
  }

  // clear all tracking data
  clear(): void {
    this.resolutionMap.clear();
    this.parentToResolutionKeys.clear();
    this.targetToResolutionKeys.clear();
    this.dependents.clear();
  }

  // get statistics for debugging/monitoring
  getStats(): { resolutions: number; dependents: number } {
    return {
      resolutions: this.resolutionMap.size,
      dependents: this.dependents.size,
    };
  }
}
