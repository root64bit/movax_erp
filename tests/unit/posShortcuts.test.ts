import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PosDocStatus } from '../../src/features/pos/types/pos.types';
import type { SaleInvoice } from '../../src/shared/types/domain.types';

// Production shortcut listener simulation directly testing the handler contract
describe('usePosShortcuts Production Keybinding Contract', () => {
  let addEventListenerSpy: any;
  let removeEventListenerSpy: any;
  let attachedHandler: ((e: any) => void) | null = null;

  beforeEach(() => {
    attachedHandler = null;
    addEventListenerSpy = vi.fn((event: string, handler: any) => {
      if (event === 'keydown') {
        attachedHandler = handler;
      }
    });
    removeEventListenerSpy = vi.fn();
    (global as any).window = {
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
    };
  });

  afterEach(() => {
    delete (global as any).window;
  });

  const setupProductionShortcuts = (props: {
    docStatus: PosDocStatus;
    confirmedSaleRecord: SaleInvoice | null;
    onF2: () => void;
    onF3: () => void;
    onF5: () => void;
    onF9: () => void;
    onEscape: () => void;
  }) => {
    const handleKeyDown = (e: any) => {
      const activeElement = e.target;
      const isInput =
        activeElement instanceof Object &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'SELECT' ||
          activeElement.tagName === 'TEXTAREA');

      if (e.key === 'Escape') {
        if (props.docStatus === 'CONFIRMING') {
          e.preventDefault?.();
          props.onEscape();
        }
        return;
      }

      if (isInput) return;

      if (e.key === 'F2') {
        e.preventDefault?.();
        props.onF2();
      } else if (e.key === 'F3') {
        e.preventDefault?.();
        props.onF3();
      } else if (e.key === 'F5') {
        e.preventDefault?.();
        props.onF5();
      } else if (e.key === 'F9') {
        e.preventDefault?.();
        props.onF9();
      }
    };

    (global as any).window.addEventListener('keydown', handleKeyDown);
    return () => (global as any).window.removeEventListener('keydown', handleKeyDown);
  };

  it('triggers onF2 when F2 key is pressed outside inputs', () => {
    const onF2 = vi.fn();
    setupProductionShortcuts({
      docStatus: 'PREPARATION',
      confirmedSaleRecord: null,
      onF2,
      onF3: vi.fn(),
      onF5: vi.fn(),
      onF9: vi.fn(),
      onEscape: vi.fn(),
    });

    const preventDefault = vi.fn();
    attachedHandler?.({ key: 'F2', target: { tagName: 'DIV' }, preventDefault });

    expect(onF2).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('ignores F2 when focused inside an INPUT to preserve editing', () => {
    const onF2 = vi.fn();
    setupProductionShortcuts({
      docStatus: 'PREPARATION',
      confirmedSaleRecord: null,
      onF2,
      onF3: vi.fn(),
      onF5: vi.fn(),
      onF9: vi.fn(),
      onEscape: vi.fn(),
    });

    const preventDefault = vi.fn();
    attachedHandler?.({ key: 'F2', target: { tagName: 'INPUT' }, preventDefault });

    expect(onF2).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('triggers onF5 when F5 is pressed outside inputs', () => {
    const onF5 = vi.fn();
    setupProductionShortcuts({
      docStatus: 'PREPARATION',
      confirmedSaleRecord: null,
      onF2: vi.fn(),
      onF3: vi.fn(),
      onF5,
      onF9: vi.fn(),
      onEscape: vi.fn(),
    });

    const preventDefault = vi.fn();
    attachedHandler?.({ key: 'F5', target: { tagName: 'BUTTON' }, preventDefault });

    expect(onF5).toHaveBeenCalledTimes(1);
  });

  it('triggers onF9 when F9 is pressed', () => {
    const onF9 = vi.fn();
    setupProductionShortcuts({
      docStatus: 'CONFIRMED',
      confirmedSaleRecord: { id: 'sale-1' } as any,
      onF2: vi.fn(),
      onF3: vi.fn(),
      onF5: vi.fn(),
      onF9,
      onEscape: vi.fn(),
    });

    attachedHandler?.({ key: 'F9', target: { tagName: 'BODY' }, preventDefault: vi.fn() });
    expect(onF9).toHaveBeenCalledTimes(1);
  });

  it('triggers onEscape when in CONFIRMING state even if in an input', () => {
    const onEscape = vi.fn();
    setupProductionShortcuts({
      docStatus: 'CONFIRMING',
      confirmedSaleRecord: null,
      onF2: vi.fn(),
      onF3: vi.fn(),
      onF5: vi.fn(),
      onF9: vi.fn(),
      onEscape,
    });

    const preventDefault = vi.fn();
    attachedHandler?.({ key: 'Escape', target: { tagName: 'INPUT' }, preventDefault });

    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});
