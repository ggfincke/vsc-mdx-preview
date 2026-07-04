// packages/webview-client/src/shared/utils/frameScheduler.ts
// rAF w/ setTimeout fallback for environments without requestAnimationFrame

export type ScheduledFrame =
  { type: 'animation'; id: number } | { type: 'timeout'; id: number };

export function scheduleFrame(callback: FrameRequestCallback): ScheduledFrame {
  if (typeof window.requestAnimationFrame === 'function') {
    return {
      type: 'animation',
      id: window.requestAnimationFrame(callback),
    };
  }

  return {
    type: 'timeout',
    id: window.setTimeout(() => callback(Date.now()), 0),
  };
}

export function cancelScheduledFrame(frame: ScheduledFrame): void {
  if (frame.type === 'animation') {
    window.cancelAnimationFrame(frame.id);
    return;
  }

  window.clearTimeout(frame.id);
}
