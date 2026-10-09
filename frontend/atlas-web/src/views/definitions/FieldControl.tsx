import { memo } from 'react';

import { Link } from 'react-router';
import type { FieldSpec } from '../../data/types';
import { isSecretRefKey, type FormValue } from './validate';

import { Button } from '../../components/ui';

/** DOM contract kept stable for automated acceptance: control id `definition-<key>`, hint/error id `<id>-hint`. */
export const fieldId = (key: string, prefix = 'definition') => `${prefix}-${key.replace(/[^A-Za-z0-9_-]/g, '-')}`;

export function hintFor(f: FieldSpec): string {
  const parts: string[] = [];
  if (f.hint && !/^Required for complete validation$/.test(f.hint)) parts.push(f.hint);
  else if (f.unit) parts.push(`Unit: ${f.unit}${f.minimum !== null || f.maximum !== null ? ` · Range: ${f.minimum ?? '−∞'}–${f.maximum ?? '∞'}` : ''}`);
  if (f.control === 'list' && !parts.some((p) => p.includes('per line'))) parts.push('One value per line. Duplicate entries are rejected.');
    parts.push(f.required ? 'Required to complete this definition; drafts may leave it empty' : 'Optional');
  return parts.join(' · ');
}

export const FieldControl = memo(function FieldControl({ field: f, value, error, onChange, disabled, prefix, onPickPins }: {
  field: FieldSpec; value: FormValue; error?: string; onChange: (key: string, v: FormValue) => void; disabled?: boolean; prefix?: string;
  onPickPins?: (key: string) => void;
}) {
  const id = fieldId(f.key, prefix);
  const hid = `${id}-hint`;
  const common = {
    id, name: f.key, disabled, required: f.required, 'aria-required': f.required || undefined,
    'aria-invalid': error ? true : undefined, 'aria-describedby': hid,
  } as const;
  const str = typeof value === 'string' ? value : value === null ? '' : String(value);
  let control;
  switch (f.control) {
    case 'textarea':
      control = <textarea {...common} className="textarea" rows={5} value={str} maxLength={f.maxLength ?? undefined} onChange={(e) => onChange(f.key, e.target.value)} />;
      break;
    case 'list':
      control = <textarea {...common} className="textarea" rows={3} value={str} onChange={(e) => onChange(f.key, e.target.value)} />;
      break;
    case 'json':
      control = <textarea {...common} className="textarea code" rows={4} spellCheck={false} value={str} onChange={(e) => onChange(f.key, e.target.value)} />;
      break;
    case 'pins':
      control = (
        <div className="stack">
          <textarea {...common} className="textarea code" rows={3} spellCheck={false} value={str} onChange={(e) => onChange(f.key, e.target.value)} />
          {onPickPins && <div><Button compact icon="pin" onClick={() => onPickPins(f.key)} disabled={disabled}>Select saved revisions</Button></div>}
        </div>
      );
      break;
    case 'number':
      control = (
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input {...common} className="input" type="number" inputMode={f.type === 'integer' ? 'numeric' : 'decimal'} step={f.type === 'integer' ? 1 : 'any'}
            min={f.minimum ?? undefined} max={f.maximum ?? undefined} value={str} onChange={(e) => onChange(f.key, e.target.value)} />
          {f.unit && <span className="caption nowrap">{f.unit}</span>}
        </div>
      );
      break;
    case 'select':
      control = (
        <select {...common} className="select" value={str} onChange={(e) => onChange(f.key, e.target.value)}>
          <option value="">Not selected</option>
          {(f.enum ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
      break;
    case 'boolean':
      control = (
        <select {...common} className="select" value={value === true ? 'true' : value === false ? 'false' : ''} onChange={(e) => onChange(f.key, e.target.value === '' ? null : e.target.value === 'true')}>
          <option value="">Not selected</option><option value="true">Yes</option><option value="false">No</option>
        </select>
      );
      break;
    case 'datetime':
      control = <input {...common} className="input" type="text" placeholder="2026-10-03T09:00:00Z" value={str} onChange={(e) => onChange(f.key, e.target.value)} />;
      break;
    default:
      control = <input {...common} className="input" type={f.format === 'email' ? 'email' : f.format === 'uri' ? 'url' : 'text'} value={str} maxLength={f.maxLength ?? undefined}
        placeholder={isSecretRefKey(f.key) ? 'vault://team/provider' : undefined} autoComplete={isSecretRefKey(f.key) ? 'off' : undefined} spellCheck={isSecretRefKey(f.key) ? false : undefined}
        onChange={(e) => onChange(f.key, e.target.value)} />;  }
  return (
    <div className="field" data-field={f.key}>
      <label className="field-label" htmlFor={id}><span>{f.label}{f.required && <span className="req" aria-hidden="true"> *</span>}</span></label>
      {control}
      <small id={hid} className={error ? 'field-error' : 'field-hint'}>{error ?? hintFor(f)}{!error && isSecretRefKey(f.key) && <> · <Link to="/gateway">Manage credentials in Gateway</Link></>}</small>    </div>
  );
});
