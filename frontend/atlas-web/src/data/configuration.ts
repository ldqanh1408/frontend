import { useEffect, useState } from 'react';
import { useApp } from './app-store';
import { readService } from './service';
export const CONFIG_LAYERS = ['Project', 'Workspace', 'Org', 'System'] as const;
export type ConfigLayer = typeof CONFIG_LAYERS[number];
export interface ConfigSnapshot { scope: string; revision: number; layers: Partial<Record<ConfigLayer, Record<string, unknown>>> }
export function resolveConfiguration(snapshot: ConfigSnapshot, key: string): { value: unknown; layer: ConfigLayer; revision: number } | null {
  for (const layer of CONFIG_LAYERS) { const values = snapshot.layers[layer]; if (values && Object.hasOwn(values,key) && values[key] != null) return { value:values[key],layer,revision:snapshot.revision }; }
  return null;
}
export function numericConfiguration(snapshot: ConfigSnapshot | null, key: string): { value: number; layer: ConfigLayer; revision: number } | null {
  const result = snapshot ? resolveConfiguration(snapshot,key) : null;
  return result && typeof result.value === 'number' && Number.isFinite(result.value) && result.value >= 0 ? { ...result,value:result.value } : null;
}
export function driftBand(value: number, syncMax: number, warningMax: number) { if (!Number.isFinite(value)||syncMax<0||warningMax<=syncMax) throw new Error('Invalid drift thresholds.'); return value<=syncMax?'In-Sync':value<=warningMax?'Warning':'Drift-Blocked'; }
export function riskBand(value: number, lowMax: number, highMin: number, hardVeto: boolean) { if (!Number.isFinite(value)||lowMax<0||highMin<=lowMax) throw new Error('Invalid risk thresholds.'); return hardVeto||value>=highMin?'Multi-Sig':value<lowMax?'Low':'Medium'; }
export function useConfiguration() {
  const session=useApp(s=>s.session); const [snapshot,setSnapshot]=useState<ConfigSnapshot|null>(null); const [error,setError]=useState<string|null>(null);
  useEffect(()=>{
    setSnapshot(null);setError(null);if(!session?.configurationHref)return;let active=true;
    void readService<ConfigSnapshot>(session.configurationHref).then(value=>{
      if(!value||value.scope!==session.scope.label||!Number.isSafeInteger(value.revision)||!value.layers||typeof value.layers!=='object'||Object.keys(value.layers).some(l=>!(CONFIG_LAYERS as readonly string[]).includes(l)))throw new Error('Resolved configuration has an invalid scope, revision or layer.');
      if(active)setSnapshot(value);
    }).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};
  },[session]);
  return {snapshot,error};
}
