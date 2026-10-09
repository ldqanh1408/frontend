import { expect, it } from 'vitest';
import { readExecutionNodes } from './model';
const task = (id: string, dependencies: string[] = []) => ({ id, dependencies, name: id, type: 'AGENT', status: 'Pending' });
it('orders run tasks by dependency without guessing missing or cyclic edges', () => {
  expect(readExecutionNodes([task('b', ['a']), task('a')]).nodes.map(n => n.id)).toEqual(['a', 'b']);
  expect(readExecutionNodes([task('a', ['b']), task('b', ['a'])]).error).toMatch(/cyclic/);
  expect(readExecutionNodes([task('b', ['a'])]).error).toMatch(/dependency is missing/);
  expect(readExecutionNodes([task('a'), task('a')]).error).toMatch(/duplicate/);
  expect(readExecutionNodes([{ ...task('a'), status: 'Invented' }]).error).toMatch(/unsupported/);
});
