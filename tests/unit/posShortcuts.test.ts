import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerPosShortcutsListener } from '../../src/features/pos/hooks/usePosShortcuts';

describe('usePosShortcuts & registerPosShortcutsListener Real Production Contract', () => {
  let listeners: Record<string, ((e: any) => void)[]> = {};

  beforeEach(() => {
    listeners = {};
    (global as any).window = {
      addEventListener: vi.fn((event: string, handler: any) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: any) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler);
        }
      }),
    };
  });

  afterEach(() => {
    delete (global as any).window;
  });

  const dispatchKeyEvent = (key: string) => {
    const preventDefault = vi.fn();
    const event = { key, preventDefault };
    (listeners['keydown'] || []).forEach((handler) => handler(event));
    return { preventDefault };
  };

  it('triggers onF2 when F2 key is pressed', () => {
    const onF2 = vi.fn();
    const cleanup = registerPosShortcutsListener({
      docStatus: 'PREPARATION',
      confirmedSaleRecord: null,
      onF2,
      onF3: vi.fn(),
      onF5: vi.fn(),
      onF9: vi.fn(),
      onEscape: vi.fn(),
    });

    const { preventDefault } = dispatchKeyEvent('F2');
    expect(onF2).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);

    cleanup();
    expect((global as any).window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('triggers onF3 when F3 key is pressed', () => {
    const onF3 = vi.fn();
    const cleanup = registerPosShortcutsListener({
      docStatus: 'CONFIRMING',
      confirmedSaleRecord: null,
      onF2: vi.fn(),
      onF3,
      onF5: vi.fn(),
      onF9: vi.fn(),
      onEscape: vi.fn(),
    });

    const { preventDefault } = dispatchKeyEvent('F3');
    expect(onF3).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('triggers onF5 when F5 key is pressed', () => {
    const onF5 = vi.fn();
    const cleanup = registerPosShortcutsListener({
      docStatus: 'PREPARATION',
      confirmedSaleRecord: null,
      onF2: vi.fn(),
      onF3: vi.fn(),
      onF5,
      onF9: vi.fn(),
      onEscape: vi.fn(),
    });

    const { preventDefault } = dispatchKeyEvent('F5');
    expect(onF5).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('triggers onF9 when F9 key is pressed', () => {
    const onF9 = vi.fn();
    const cleanup = registerPosShortcutsListener({
      docStatus: 'CONFIRMED',
      confirmedSaleRecord: { id: 's-1' } as any,
      onF2: vi.fn(),
      onF3: vi.fn(),
      onF5: vi.fn(),
      onF9,
      onEscape: vi.fn(),
    });

    const { preventDefault } = dispatchKeyEvent('F9');
    expect(onF9).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it('triggers onEscape only when in CONFIRMING status', () => {
    const onEscape = vi.fn();
    const cleanup = registerPosShortcutsListener({
      docStatus: 'CONFIRMING',
      confirmedSaleRecord: null,
      onF2: vi.fn(),
      onF3: vi.fn(),
      onF5: vi.fn(),
      onF9: vi.fn(),
      onEscape,
    });

    const { preventDefault } = dispatchKeyEvent('Escape');
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
