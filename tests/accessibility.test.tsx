import { expect, test, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Modal, ErrorBoundary } from '../src/components/common';
test('dialog receives focus, cycles focus and restores focus on unmount', () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const close = vi.fn();
  const { unmount } = render(
    <Modal title="Edit" onClose={close}>
      <input aria-label="Title" />
      <button>Save</button>
    </Modal>,
  );
  expect(screen.getByRole('textbox')).toHaveFocus();
  screen.getByRole('button', { name: 'Save' }).focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(screen.getByRole('button', { name: '關閉對話框' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).toHaveBeenCalled();
  unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});
test('rendering failure leaves recovery UI', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  function Broken(): never {
    throw new Error('component failure');
  }
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>,
  );
  expect(screen.getByRole('button', { name: '重新載入' })).toBeVisible();
  expect(screen.getByText('Chrome 書籤資料不受影響。')).toBeVisible();
  cleanup();
  log.mockRestore();
});
test('dialog focus trap excludes hidden inputs', () => {
  render(
    <Modal title="Hidden fields" onClose={() => {}}>
      <input hidden type="file" aria-label="Hidden file" />
      <button>Visible action</button>
    </Modal>,
  );
  expect(screen.getByRole('button', { name: '關閉對話框' })).toHaveFocus();
  screen.getByRole('button', { name: 'Visible action' }).focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(screen.getByRole('button', { name: '關閉對話框' })).toHaveFocus();
  cleanup();
});
test('busy dialogs cannot be dismissed by Escape or the close button', () => {
  const close = vi.fn();
  render(
    <Modal title="Saving" busy onClose={close}>
      <p>Working</p>
    </Modal>,
  );
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '關閉對話框' })).toBeDisabled();
  expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
  cleanup();
});
