// tests/services/WithSubscribers.test.ts
// unit tests for WithSubscribers service trait

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LogTags } from '@mdx-preview/shared';
import { WithSubscribers } from '../../packages/extension/services/SingletonService';

const subscriberErrorHandler = vi.fn();

class NumberEventService extends WithSubscribers<NumberEventService, number> {
  protected static override instance: NumberEventService | undefined;
  protected readonly logTag = LogTags.CONFIG_MANAGER;

  protected constructor() {
    super(LogTags.CONFIG_MANAGER);
  }

  emit(value: number): void {
    this.notifySubscribers(value);
  }
}

class DisposingEventService extends WithSubscribers<
  DisposingEventService,
  string
> {
  protected static override instance: DisposingEventService | undefined;
  protected readonly logTag = LogTags.TRUST_MANAGER;

  onDisposeCalled = false;

  protected constructor() {
    super(LogTags.TRUST_MANAGER);
  }

  emit(value: string): void {
    this.notifySubscribers(value);
  }

  protected override onDispose(): void {
    this.onDisposeCalled = true;
  }
}

class ErrorHandlingEventService extends WithSubscribers<
  ErrorHandlingEventService,
  string
> {
  protected static override instance: ErrorHandlingEventService | undefined;
  protected readonly logTag = LogTags.PREVIEW_MANAGER;

  protected constructor() {
    super(LogTags.PREVIEW_MANAGER, subscriberErrorHandler);
  }

  emit(value: string): void {
    this.notifySubscribers(value);
  }
}

describe('WithSubscribers', () => {
  beforeEach(() => {
    NumberEventService.reset();
    DisposingEventService.reset();
    ErrorHandlingEventService.reset();
    subscriberErrorHandler.mockReset();
  });

  afterEach(() => {
    NumberEventService.reset();
    DisposingEventService.reset();
    ErrorHandlingEventService.reset();
  });

  it('notifies subscribers via trait helper', () => {
    const service = NumberEventService.getInstance();
    const listener = vi.fn();

    service.subscribe(listener);
    service.emit(7);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(7);
  });

  it('supports unsubscribe via disposable', () => {
    const service = NumberEventService.getInstance();
    const listener = vi.fn();

    const subscription = service.subscribe(listener);
    subscription.dispose();
    service.emit(9);

    expect(listener).not.toHaveBeenCalled();
  });

  it('clears subscribers on dispose', () => {
    const service = NumberEventService.getInstance();
    const listener = vi.fn();

    service.subscribe(listener);
    service.dispose();
    service.emit(5);

    expect(listener).not.toHaveBeenCalled();
  });

  it('clears subscribers when subclass overrides onDispose', () => {
    const service = DisposingEventService.getInstance();
    const listener = vi.fn();

    service.subscribe(listener);
    service.dispose();
    service.emit('after-dispose');

    expect(service.onDisposeCalled).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('forwards subscriber errors to custom error handler', () => {
    const service = ErrorHandlingEventService.getInstance();
    const secondListener = vi.fn();

    service.subscribe(() => {
      throw new Error('listener failed');
    });
    service.subscribe(secondListener);
    service.emit('payload');

    expect(subscriberErrorHandler).toHaveBeenCalledTimes(1);
    expect(subscriberErrorHandler.mock.calls[0][1]).toBe(0);
    expect(secondListener).toHaveBeenCalledWith('payload');
  });
});
