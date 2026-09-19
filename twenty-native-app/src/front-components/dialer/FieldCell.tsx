import {
  Chip,
  NumberDisplay,
  SelectDisplay,
  Status,
  Tag,
  TextDisplay,
} from 'twenty-ui/primitives/data-display';
import type { ThemeColor } from 'twenty-ui/theme';
import type { FieldType, MetaOption } from './api';

// ---------------------------------------------------------------------------
// Native field-cell dispatcher.
//
// Every cell in the dialer tables is rendered through this component, keyed
// off the field's native Twenty `type` (not a hardcoded list). It only
// reaches into the crash-safe `twenty-ui/primitives/data-display` subpath —
// the subpath that does NOT transitively pull in `@base-ui/react`'s
// CompositeList, which is what crashes the sandboxed Remote-DOM host.
//
// Field type → native cell:
//   SELECT       → SelectDisplay (pill, color/label from Twenty metadata)
//   MULTI_SELECT → Tag
//   BOOLEAN      → Checkmark (rendered via a styled <span>; native Checkmark
//                  is a bare icon so we give it a labelled pill here)
//   NUMBER/CURRENCY → NumberDisplay
//   DATE/DATETIME → TextDisplay (ISO → local string)
//   RELATION     → Chip (relation chip, native)
//   EMAILS/URL   → LinkChip-free TextDisplay (no crash-safe link primitive)
//   TEXT/other   → TextDisplay
//
// Unknown types fall back to TextDisplay so a missing type never blanks a cell.
// ---------------------------------------------------------------------------

interface FieldCellProps {
  field: { type: string; options?: MetaOption[] };
  value: unknown;
  // Optional override to force a "status-ish" colored pill for enum values
  // even when the raw type string didn't parse (e.g. legacy records).
  statusFallback?: ThemeColor;
}

function optionColor(options: MetaOption[] | undefined, value: unknown): ThemeColor {
  const hit = (options ?? []).find((o) => o.value === value);
  if (hit?.color) return hit.color as ThemeColor;
  return 'gray';
}

function optionLabel(options: MetaOption[] | undefined, value: unknown): string {
  const hit = (options ?? []).find((o) => o.value === value);
  return hit?.label ?? String(value ?? '—');
}

function fmtDateTime(value: unknown): string {
  if (value == null || value === '') return '—';
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

function fmtNumber(value: unknown): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isNaN(n) ? String(value) : String(n);
}

function isEmpty(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

export function FieldCell({ field, value, statusFallback }: FieldCellProps): React.ReactElement {
  const type = (field.type ?? 'UNKNOWN').toUpperCase();

  switch (type) {
    case 'SELECT':
      return (
        <SelectDisplay
          color={optionColor(field.options, value)}
          label={optionLabel(field.options, value)}
        />
      );

    case 'MULTI_SELECT': {
      const arr = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [value];
      return (
        <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>
          {arr
            .filter((v) => !isEmpty(v))
            .map((v, i) => (
              <Tag key={i} color="blue">
                {String(v)}
              </Tag>
            ))}
          {arr.every(isEmpty) && <TextDisplay text="—" />}
        </span>
      );
    }

    case 'BOOLEAN': {
      const truthy = value === true;
      return (
        <span
          role="status"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: truthy ? '#2e7d32' : '#9aa0a6',
          }}
        >
          {truthy ? 'Yes' : 'No'}
        </span>
      );
    }

    case 'NUMBER':
    case 'CURRENCY':
      return <NumberDisplay value={fmtNumber(value)} decimals={0} />;

    case 'DATE':
    case 'DATE_TIME':
      return <TextDisplay text={fmtDateTime(value)} />;

    case 'RELATION': {
      // value can be a string label, an {id,name}, or an array of those.
      const items: string[] = Array.isArray(value)
        ? value.map((v) => (v && typeof v === 'object' ? String((v as any).name ?? (v as any).id ?? '') : String(v ?? '')))
        : [String((value as any)?.name ?? value ?? '')];
      const labels = items.filter(Boolean);
      return labels.length === 0 ? (
        <TextDisplay text="—" />
      ) : (
        <Chip>{labels.join(', ')}</Chip>
      );
    }

    case 'EMAILS':
    case 'DOMAINS':
    case 'URL':
      return <TextDisplay text={String(value ?? '—')} />;

    case 'TEXT':
    case 'LONG_TEXT':
    case 'JSON':
    case 'PASSWORD':
    default:
      return <TextDisplay text={String(value ?? '—')} />;
  }
}

export type { FieldCellProps };
