import { StrictMode, useRef } from 'react';
import { render, fireEvent, act, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';
import { PageMetaProvider, useRouteFocus } from './page-meta';

function Harness({ announce }: { announce: (text: string) => void }) {
  const main = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  useRouteFocus(main, announce);
  return <><a href="#main">Skip to workspace</a><button onClick={() => navigate('/execution')}>Open execution</button><main ref={main} id="main" tabIndex={-1}><h1 data-page-title tabIndex={-1}>Execution</h1></main></>;
}
function mount(announce = vi.fn()) {
  render(<StrictMode><MemoryRouter><PageMetaProvider><Harness announce={announce}/></PageMetaProvider></MemoryRouter></StrictMode>);
  return announce;
}
afterEach(() => { cleanup(); vi.useRealTimers(); });
test('StrictMode initial effect replay preserves skip-link focus', () => {
  vi.useFakeTimers(); const announce = mount();
  screen.getByRole('link', { name: 'Skip to workspace' }).focus();
  act(() => vi.advanceTimersByTime(100));
  expect(screen.getByRole('link', { name: 'Skip to workspace' })).toHaveFocus();
  expect(announce).not.toHaveBeenCalled();
});
test('actual client navigation still moves focus to the page heading', () => {
  vi.useFakeTimers(); mount();
  const button = screen.getByRole('button', { name: 'Open execution' }); button.focus(); fireEvent.click(button);
  act(() => vi.advanceTimersByTime(100));
  expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
});
