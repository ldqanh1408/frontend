import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import schemas from '../../generated/schemas.json';
import type { SchemaSpec } from '../../data/types';
import { DefinitionForm } from './DefinitionForm';
import { initialValues } from './validate';
afterEach(cleanup);
it('keeps hidden-tab errors in the summary and delegates revealing the affected field', () => {
  const schema = (schemas as unknown as SchemaSpec[]).find(s => s.id === 'agent')!;
  const field = schema.groups.flatMap(g => g.fields).find(f => f.key === 'model')!;
  const reveal = vi.fn();
  render(<DefinitionForm schema={schema} values={initialValues(schema)} errors={{ [field.key]: 'Select a pinned model.' }} onChange={() => {}} include={(_g, k) => k !== field.key} showSummary onFocusField={reveal} />);
  expect(screen.getByRole('alert')).toHaveFocus();
  fireEvent.click(screen.getByRole('link', { name: `${field.label}: Select a pinned model.` }));
  expect(reveal).toHaveBeenCalledWith(field.key);
});
