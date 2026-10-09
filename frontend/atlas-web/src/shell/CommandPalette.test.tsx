import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { CommandPalette } from './CommandPalette';
import type { DefinitionRecord } from '../lib/storage';

const reads = vi.hoisted(() => ({ getAll: vi.fn(), loadSchemas: vi.fn() }));
vi.mock('../lib/storage', async importOriginal => ({ ...await importOriginal<typeof import('../lib/storage')>(), getAll: reads.getAll }));
vi.mock('../data/catalog', async importOriginal => ({ ...await importOriginal<typeof import('../data/catalog')>(), loadSchemas: reads.loadSchemas }));
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => { reads.getAll.mockReset().mockResolvedValue([]); reads.loadSchemas.mockReset().mockResolvedValue({ list: [] }); });
afterEach(cleanup);
const draft = (name: string, id = name): DefinitionRecord => ({ id, name, schemaId: 'agent', rev: 1, archived: false, data: {}, preserved: {}, createdAt: '', updatedAt: '' });
const palette = (open = true) => <MemoryRouter><CommandPalette open={open} onOpenChange={() => {}} onOpenHelp={() => {}} onOpenPrefs={() => {}} /></MemoryRouter>;

it('finds a draft beyond the first 50 while bounding the unfiltered list', async () => {
  reads.getAll.mockImplementation(async (store: string) => store === 'definitions' ? [...Array.from({ length: 60 }, (_, i) => draft(`Ordinary ${i}`)), draft('Late release candidate')] : []);
  render(palette());
  await waitFor(() => expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'false'));
  expect(screen.queryByText('Late release candidate')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Late release candidate' } });
  expect(await screen.findByText('Late release candidate')).toBeVisible();
});

it('keeps available drafts and navigation when another device collection fails', async () => {
  reads.getAll.mockImplementation(async (store: string) => {
    if (store === 'documents') throw new Error('storage unavailable');
    return store === 'definitions' ? [draft('Available draft')] : [];
  });
  render(palette());
  expect(await screen.findByText('Available draft')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Some local items could not be loaded');
  expect(screen.getByText('Help and keyboard shortcuts')).toBeVisible();
});

it('keeps same-name drafts independently selectable', async () => {
  reads.getAll.mockImplementation(async (store: string) => store === 'definitions' ? [draft('Release draft', 'draft-one'), draft('Release draft', 'draft-two')] : []);
  render(palette());
  await waitFor(() => expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'false'));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Release draft' } });
  const results = await screen.findAllByRole('option', { name: /Release draft/ });
  expect(results).toHaveLength(2);
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
  expect(results.filter(row => row.getAttribute('aria-selected') === 'true')).toHaveLength(1);
});

it('does not replace reopened results with a late response from a closed search', async () => {
  let resolveOld!: (value: DefinitionRecord[]) => void;
  const oldRead = new Promise<DefinitionRecord[]>(resolve => { resolveOld = resolve; });
  let generation = 0;
  reads.getAll.mockImplementation((store: string) => store === 'definitions' ? (++generation === 1 ? oldRead : Promise.resolve([draft('Current draft')])) : Promise.resolve([]));
  const view = render(palette());
  expect(screen.getByRole('status')).toHaveTextContent('Loading device drafts');
  view.rerender(palette(false)); view.rerender(palette());
  expect(await screen.findByText('Current draft')).toBeVisible();
  await act(async () => resolveOld([draft('Outdated draft')]));
  expect(screen.queryByText('Outdated draft')).not.toBeInTheDocument();
  expect(screen.getByText('Current draft')).toBeVisible();
});

it('offers a clear action for an empty search', async () => {
  render(palette());
  await waitFor(() => expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'false'));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzz-no-such-item' } });
  const clear = await screen.findByRole('button', { name: 'Clear search' });
  fireEvent.click(clear);
  expect(screen.getByRole('combobox')).toHaveValue('');
  expect(screen.getByText('Help and keyboard shortcuts')).toBeVisible();
});
