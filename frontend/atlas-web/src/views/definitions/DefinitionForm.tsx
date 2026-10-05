import { useCallback, useEffect, useRef } from 'react';
import type { SchemaSpec } from '../../data/types';
import { FieldControl, fieldId } from './FieldControl';
import type { Errors, FormValue, FormValues } from './validate';

/** Grouped definition form (Figma "<type> · unified fields": groups in order, error summary that links to fields). */
export function DefinitionForm({ schema, values, errors, onChange, disabled, prefix = 'definition', onPickPins, showSummary }: {
  schema: SchemaSpec; values: FormValues; errors: Errors; onChange: (key: string, v: FormValue) => void; disabled?: boolean; prefix?: string;
  onPickPins?: (key: string) => void; showSummary?: boolean;
}) {
  const summaryRef = useRef<HTMLDivElement>(null);
  const errKeys = Object.keys(errors);
  useEffect(() => { if (showSummary && errKeys.length) summaryRef.current?.focus(); }, [showSummary, errKeys.length]);
  const focusField = useCallback((key: string) => document.getElementById(fieldId(key, prefix))?.focus(), [prefix]);
  const labelOf = (k: string) => schema.groups.flatMap((g) => g.fields).find((f) => f.key === k)?.label ?? k;
  return (
    <div className="stack-16">
      {showSummary && errKeys.length > 0 && (
        <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef} aria-labelledby={`${prefix}-errsum`}>
          <strong id={`${prefix}-errsum`}>Resolve {errKeys.length === 1 ? 'this field' : `these ${errKeys.length} fields`}</strong>
          <ul>{errKeys.map((k) => <li key={k}><a href={`#${fieldId(k, prefix)}`} onClick={(e) => { e.preventDefault(); focusField(k); }}>{labelOf(k)}: {errors[k]}</a></li>)}</ul>
        </div>
      )}
      {schema.groups.map((g, gi) => (
        <section key={g.group} id={`${prefix}-group-${gi}`} className="form-group panel panel-pad" aria-labelledby={`${prefix}-group-${gi}-h`}>
          <h3 id={`${prefix}-group-${gi}-h`}>{g.group}</h3>
          <div className="form-grid">
            {g.fields.map((f) => (
              <FieldControl key={f.key} field={f} value={values[f.key] ?? ''} error={errors[f.key]} onChange={onChange} disabled={disabled} prefix={prefix} onPickPins={onPickPins} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function SectionNav({ schema, prefix = 'definition', errors }: { schema: SchemaSpec; prefix?: string; errors?: Errors }) {
  return (
    <nav aria-label="Definition sections">
      <ul className="list" role="list">
        {schema.groups.map((g, gi) => {
          const bad = errors ? g.fields.filter((f) => errors[f.key]).length : 0;
          return (
            <li key={g.group}>
              <a className="list-item" href={`#${prefix}-group-${gi}`} onClick={(e) => { e.preventDefault(); const el = document.getElementById(`${prefix}-group-${gi}`); el?.scrollIntoView({ block: 'start' }); el?.querySelector<HTMLElement>('input,select,textarea')?.focus({ preventScroll: true }); }}>
                <span className="grow">{g.group}</span>
                {bad > 0 && <span className="badge badge-danger">{bad}</span>}
                <span className="caption">{g.fields.length}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
