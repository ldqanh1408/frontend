import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { app, dismissToast, toast } from '../data/app-store';
import { Toaster } from './overlays';
afterEach(() => { cleanup(); for (const t of app.get().toasts) dismissToast(t.id); vi.useRealTimers(); });
it('keeps only three notifications and pauses expiry while a notification is being read', () => {
  vi.useFakeTimers();
  for (let i = 1; i <= 4; i++) toast({ tone: 'info', title: `Notice ${i}` });
  render(<Toaster />);
  expect(screen.queryByText('Notice 1')).not.toBeInTheDocument();
  expect(screen.getAllByRole('status')).toHaveLength(3);
  const current = screen.getByText('Notice 4').closest('.toast')!;
  fireEvent.mouseEnter(current);
  act(() => vi.advanceTimersByTime(6000));
  expect(screen.getByText('Notice 4')).toBeVisible();
  expect(screen.queryByText('Notice 2')).not.toBeInTheDocument();
  fireEvent.mouseLeave(current);
  act(() => vi.advanceTimersByTime(5001));
  expect(screen.queryByText('Notice 4')).not.toBeInTheDocument();
});
it('holds a notification while its dismiss control has keyboard focus', () => {
  vi.useFakeTimers(); toast({ tone: 'warning', title: 'Read this warning' });
  render(<Toaster />);
  fireEvent.focus(screen.getByRole('button', { name: 'Dismiss notification' }));
  act(() => vi.advanceTimersByTime(9000));
  expect(screen.getByText('Read this warning')).toBeVisible();
});
