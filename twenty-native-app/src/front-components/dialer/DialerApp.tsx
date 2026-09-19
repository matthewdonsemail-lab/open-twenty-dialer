import { useCallback, useEffect, useState } from 'react';
import { SelectDisplay, Status, Tag } from 'twenty-ui/primitives/data-display';
import { Section } from 'twenty-ui/primitives/layout';
import { Text } from 'twenty-ui/primitives/typography';
import { useTheme } from 'twenty-ui/theme-constants';
import { IconFileText, IconHistory, IconList, IconPhone, IconTarget } from 'twenty-ui/icon';
import { enqueueSnackbar, useUserId } from 'twenty-sdk/front-component';

import {
  claimPhone,
  createRecord,
  listRecords,
  metaOptions,
  releasePhone,
  updateRecord,
  type MetaOption,
} from './api';

type TabId = 'queue' | 'numbers' | 'calls' | 'campaigns' | 'scripts';

const CALL_STATUSES = ['COMPLETED', 'NO_ANSWER', 'BUSY', 'FAILED', 'IN_PROGRESS'];

interface Palette {
  text: string;
  textSecondary: string;
  textTertiary: string;
  background: string;
  backgroundSecondary: string;
  border: string;
  borderLight: string;
  hover: string;
}

function usePalette(): Palette {
  const theme: any = useTheme();
  return {
    text: theme?.font?.color?.primary ?? '#1f1f1f',
    textSecondary: theme?.font?.color?.secondary ?? '#666',
    textTertiary: theme?.font?.color?.tertiary ?? '#999',
    background: theme?.background?.primary ?? '#ffffff',
    backgroundSecondary: theme?.background?.secondary ?? '#f8f9fa',
    border: theme?.border?.color?.medium ?? '#e0e0e0',
    borderLight: theme?.border?.color?.light ?? '#f0f0f0',
    hover: theme?.background?.tertiary ?? '#f5f5f5',
  };
}

function TButton(props: {
  primary?: boolean;
  subtle?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}): React.ReactElement {
  const palette = usePalette();
  const style: React.CSSProperties =
    props.subtle ?? false
      ? {
          fontSize: '13px',
          fontWeight: 500,
          fontFamily: 'inherit',
          padding: '6px 12px',
          borderRadius: '8px',
          cursor: props.disabled ? 'default' : 'pointer',
          opacity: props.disabled ? 0.5 : 1,
          background: 'transparent',
          border: '1px solid transparent',
          color: palette.text,
        }
      : props.primary ?? false
        ? {
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'inherit',
            padding: '6px 14px',
            borderRadius: '8px',
            cursor: props.disabled ? 'default' : 'pointer',
            opacity: props.disabled ? 0.5 : 1,
            background: '#375edd',
            border: '1px solid #375edd',
            color: '#ffffff',
          }
        : {
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: 'inherit',
            padding: '6px 14px',
            borderRadius: '8px',
            cursor: props.disabled ? 'default' : 'pointer',
            opacity: props.disabled ? 0.5 : 1,
            background: palette.background,
            border: `1px solid ${palette.border}`,
            color: palette.text,
          };
  return (
    <button style={style} disabled={props.disabled} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

function notify(message: string, variant: 'success' | 'error' | 'info' = 'info'): void {
  void enqueueSnackbar({ message, variant }).catch(() => undefined);
}

function fmtDate(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function fmtDuration(seconds: unknown): string {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function statusColor(value: unknown): any {
  const v = String(value ?? '').toUpperCase();
  if (v === 'IDLE' || v === 'COMPLETED' || v === 'ACTIVE' || v === 'INTERESTED' || v === 'CONVERTED') return 'green';
  if (v === 'DIALING' || v === 'CALLBACK' || v === 'CONTACTED') return 'yellow';
  if (v === 'IN_PROGRESS' || v === 'NEW' || v === 'DRAFT') return 'blue';
  if (v === 'FAILED' || v === 'NOT_INTERESTED' || v === 'DO_NOT_CONTACT' || v === 'BUSY' || v === 'NO_ANSWER' || v === 'INACTIVE') return 'red';
  if (v === 'PAUSED') return 'orange';
  return 'gray';
}

function metaColor(options: MetaOption[] | undefined, value: unknown): any {
  const hit = (options ?? []).find((o) => o.value === value);
  if (hit?.color) return hit.color;
  return statusColor(value);
}

function metaLabel(options: MetaOption[] | undefined, value: unknown): string {
  const hit = (options ?? []).find((o) => o.value === value);
  return hit?.label ?? String(value ?? '—');
}

function CellSelect(props: {
  value: unknown;
  options: MetaOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  palette: Palette;
}): React.ReactElement {
  return (
    <select
      aria-label="Change status"
      disabled={props.disabled}
      value={String(props.value ?? '')}
      onChange={(e) => props.onChange(e.target.value)}
      style={{
        fontSize: '13px',
        fontFamily: 'inherit',
        color: props.palette.text,
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: '6px',
        padding: '4px 6px',
        maxWidth: '170px',
        cursor: props.disabled ? 'default' : 'pointer',
      }}
    >
      <option value="">—</option>
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function FieldInput(props: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  palette: Palette;
  width?: string;
}): React.ReactElement {
  return (
    <input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      style={{
        fontSize: '13px',
        fontFamily: 'inherit',
        color: props.palette.text,
        background: props.palette.background,
        border: `1px solid ${props.palette.border}`,
        borderRadius: '8px',
        padding: '7px 10px',
        width: props.width ?? '100%',
        boxSizing: 'border-box',
      }}
    />
  );
}

// Native-Twenty-style record row: a leading selection checkbox, a primary
// label, a status pill, and trailing actions - mirroring the record-row
// affordances Twenty uses on its own objects list. The checkbox is a plain
// element because the twenty-ui Checkbox primitive lives in the `input`
// subpath, which drags in @monaco-editor/react and breaks the build.
function RecordCheckbox(props: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  palette: Palette;
  label: string;
}): React.ReactElement {
  const box = 16;
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        aria-label={props.label}
        checked={props.checked}
        ref={(el) => {
          if (el) el.indeterminate = !!props.indeterminate;
        }}
        onChange={(e) => props.onChange(e.target.checked)}
        style={{
          width: box,
          height: box,
          accentColor: '#375edd',
          cursor: 'pointer',
        }}
      />
    </label>
  );
}

function RecordColumn(props: { label: string; width?: number; palette: Palette }): React.ReactElement {
  return (
    <div style={{ width: props.width, flexShrink: 0 }}>
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', color: props.palette.textTertiary }}>
        {props.label}
      </div>
    </div>
  );
}


function QueueTab(): React.ReactElement {
  const palette = usePalette();
  const [prospects, setProspects] = useState<Record<string, any>[]>([]);
  const [total, setTotal] = useState(0);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [statusOptions, setStatusOptions] = useState<MetaOption[]>([]);
  const [loggingFor, setLoggingFor] = useState<Record<string, any> | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async (after?: string) => {
    setLoading(true);
    try {
      const page = await listRecords<Record<string, any>>('prospects', { limit: 200, startingAfter: after });
      setProspects((prev) => (after ? [...prev, ...page.records] : page.records));
      setTotal(page.totalCount);
      setEndCursor(page.pageInfo.endCursor);
      setHasMore(page.pageInfo.hasNextPage);
    } catch {
      notify('Could not load prospects', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void metaOptions('agencyProspect')
      .then((m) => setStatusOptions(m.coldCallStatus ?? []))
      .catch(() => undefined);
  }, [load]);

  const visible = statusFilter === '' ? prospects : prospects.filter((p) => String(p.coldCallStatus ?? '') === statusFilter);
  const allSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const someSelected = visible.some((p) => selected.has(p.id));
  const toggleAll = (next: boolean) => {
    setSelected((prev) => {
      const s = new Set(prev);
      visible.forEach((p) => {
        if (next) s.add(p.id);
        else s.delete(p.id);
      });
      return s;
    });
  };
  const toggleOne = (id: string, next: boolean) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });
  };

  const setStatus = async (p: Record<string, any>, value: string) => {
    setBusyId(p.id);
    try {
      const updated = await updateRecord<Record<string, any>>('prospects', p.id, { coldCallStatus: value });
      setProspects((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...updated } : x)));
      notify('Status updated', 'success');
    } catch {
      notify('Status update failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Section>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <Text>
          {total} prospect{total === 1 ? '' : 's'}
          {statusFilter === '' ? '' : ` · ${visible.length} shown`}
          {selected.size > 0 ? ` · ${selected.size} selected` : ''}
        </Text>
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            fontSize: '13px',
            fontFamily: 'inherit',
            color: palette.text,
            background: palette.background,
            border: `1px solid ${palette.border}`,
            borderRadius: '8px',
            padding: '6px 10px',
          }}
        >
          <option value="">All statuses</option>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <TButton onClick={() => void load()}>Refresh</TButton>
      </div>
      {loading && prospects.length === 0 ? (
        <Text>Loading…</Text>
      ) : (
        <div style={{ border: `1px solid ${palette.borderLight}`, borderRadius: '10px', overflow: 'hidden' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              background: palette.backgroundSecondary,
              borderBottom: `1px solid ${palette.border}`,
            }}
          >
            <RecordCheckbox checked={allSelected} indeterminate={!allSelected && someSelected} onChange={toggleAll} palette={palette} label="Select all prospects" />
            <RecordColumn label="Name" width={220} palette={palette} />
            <RecordColumn label="Phone" width={160} palette={palette} />
            <RecordColumn label="Industry" width={140} palette={palette} />
            <RecordColumn label="Rating" width={90} palette={palette} />
            <RecordColumn label="Status" width={160} palette={palette} />
          </div>
          {visible.map((p) => {
            const isSel = selected.has(p.id);
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderBottom: `1px solid ${palette.borderLight}`,
                  background: isSel ? 'rgba(55,94,221,0.06)' : palette.background,
                }}
              >
                <RecordCheckbox checked={isSel} onChange={(next) => toggleOne(p.id, next)} palette={palette} label={`Select ${String(p.name ?? 'prospect')}`} />
                <div style={{ width: 220, flexShrink: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '13px', color: palette.text }}>{String(p.name ?? '—')}</div>
                </div>
                <div style={{ width: 160, flexShrink: 0, fontSize: '13px', color: palette.textSecondary }}>
                  {String(p.phone ?? p.phoneNumber ?? '—')}
                </div>
                <div style={{ width: 140, flexShrink: 0, fontSize: '13px', color: palette.textSecondary }}>
                  {String(p.niche ?? '—')}
                </div>
                <div style={{ width: 90, flexShrink: 0, fontSize: '13px', color: palette.textSecondary }}>
                  {p.rating != null ? `${p.rating} (${p.reviewCount ?? 0})` : '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SelectDisplay color={metaColor(statusOptions, p.coldCallStatus)} label={metaLabel(statusOptions, p.coldCallStatus)} />
                  <CellSelect value={p.coldCallStatus} options={statusOptions} disabled={busyId === p.id} palette={palette} onChange={(v) => void setStatus(p, v)} />
                  <TButton subtle onClick={() => setLoggingFor(loggingFor?.id === p.id ? null : p)}>
                    {loggingFor?.id === p.id ? 'Close' : 'Log call'}
                  </TButton>
                </div>
              </div>
            );
          })}
          {visible.length === 0 && <div style={{ padding: '16px', fontSize: '13px', color: palette.textTertiary }}>No prospects match.</div>}
        </div>
      )}
      {hasMore && (
        <div style={{ marginTop: '12px' }}>
          <TButton onClick={() => endCursor && void load(endCursor)}>Load more</TButton>
        </div>
      )}
      {loggingFor && (
        <div style={{ marginTop: '4px' }}>
          <LogCallForm
            toNumber={String(loggingFor.phone ?? loggingFor.phoneNumber ?? '')}
            prospectId={String(loggingFor.id)}
            onDone={() => setLoggingFor(null)}
          />
        </div>
      )}
    </Section>
  );
}

function LogCallForm(props: { toNumber: string; prospectId?: string; leadId?: string; onDone: () => void }): React.ReactElement {
  const palette = usePalette();
  const [toNumber, setToNumber] = useState(props.toNumber);
  const [status, setStatus] = useState('COMPLETED');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (toNumber.trim() === '') {
      notify('Enter a number first', 'error');
      return;
    }
    setSaving(true);
    try {
      await createRecord('calls', {
        direction: 'OUTBOUND',
        status,
        fromNumber: '',
        toNumber: toNumber.trim(),
        startedAt: new Date().toISOString(),
        durationSeconds: duration === '' ? null : Number(duration),
        summary: notes === '' ? null : notes,
        ...(props.prospectId ? { agencyProspectId: props.prospectId } : {}),
        ...(props.leadId ? { agencyLeadId: props.leadId } : {}),
      });
      notify('Call logged', 'success');
      props.onDone();
    } catch {
      notify('Could not log the call', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '520px' }}>
        <Text>Log a call</Text>
        <FieldInput value={toNumber} onChange={setToNumber} placeholder="To number" palette={palette} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            aria-label="Outcome"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              flex: 1,
              fontSize: '13px',
              fontFamily: 'inherit',
              color: palette.text,
              background: palette.background,
              border: `1px solid ${palette.border}`,
              borderRadius: '8px',
              padding: '7px 10px',
            }}
          >
            {CALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            aria-label="Duration in seconds"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="Secs"
            style={{
              width: '110px',
              fontSize: '13px',
              fontFamily: 'inherit',
              color: palette.text,
              background: palette.background,
              border: `1px solid ${palette.border}`,
              borderRadius: '8px',
              padding: '7px 10px',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <textarea
          aria-label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          rows={3}
          style={{
            fontSize: '13px',
            fontFamily: 'inherit',
            color: palette.text,
            background: palette.background,
            border: `1px solid ${palette.border}`,
            borderRadius: '8px',
            padding: '7px 10px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <TButton primary disabled={saving} onClick={() => void save()}>
            Save call
          </TButton>
          <TButton onClick={props.onDone}>Cancel</TButton>
        </div>
      </div>
    </Section>
  );
}

function NumbersTab(props: { userId: string | null }): React.ReactElement {
  const palette = usePalette();
  const [phones, setPhones] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listRecords<Record<string, any>>('phones', { limit: 50 });
      setPhones(page.records);
    } catch {
      notify('Could not load numbers', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, fn: () => Promise<Record<string, any>>, okMsg: string) => {
    if (!props.userId) {
      notify('Sign in to claim numbers', 'error');
      return;
    }
    setBusyId(id);
    try {
      const updated = await fn();
      setPhones((prev) => prev.map((x) => (x.id === id ? { ...x, ...updated } : x)));
      notify(okMsg, 'success');
    } catch (e: any) {
      const held = e?.body?.heldBy as { email?: string; memberId?: string } | undefined;
      notify(held ? `Held by ${held.email ?? held.memberId ?? 'someone else'}` : 'Action failed', 'error');
      void load();
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Text>Loading…</Text>;

  return (
    <Section>
      <div style={{ marginBottom: '12px' }}>
        <TButton onClick={() => void load()}>Refresh</TButton>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {phones.map((p) => {
          const mine = props.userId != null && p.claimedByMemberId === props.userId && p.callState !== 'IDLE';
          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap',
                padding: '12px 4px',
                borderBottom: `1px solid ${palette.borderLight}`,
              }}
            >
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ fontWeight: 500, fontSize: '14px', color: palette.text }}>
                  {String(p.phoneNumber ?? p.name ?? '—')}
                </div>
                <div style={{ fontSize: '12px', color: palette.textSecondary }}>
                  {String(p.name ?? '')}
                  {p.claimedByEmail ?? p.claimedByMemberId ? ` · held by ${String(p.claimedByEmail ?? p.claimedByMemberId)}` : ' · free'}
                </div>
              </div>
              <Status color={statusColor(p.callState)}>{String(p.callState ?? 'IDLE')}</Status>
              {p.callState === 'IDLE' || !mine ? (
                <TButton primary disabled={busyId === p.id} onClick={() => void act(p.id, () => claimPhone(p.id, props.userId ?? ''), 'Number claimed')}>
                  Claim
                </TButton>
              ) : (
                <TButton disabled={busyId === p.id} onClick={() => void act(p.id, () => releasePhone(p.id, props.userId ?? ''), 'Number released')}>
                  Release
                </TButton>
              )}
            </div>
          );
        })}
        {phones.length === 0 && <Text>No numbers found.</Text>}
      </div>
    </Section>
  );
}

function CallsTab(): React.ReactElement {
  const palette = usePalette();
  const [calls, setCalls] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listRecords<Record<string, any>>('calls', { limit: 100 });
      setCalls(page.records);
    } catch {
      notify('Could not load calls', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected = calls.length > 0 && calls.every((c) => selected.has(c.id));
  const someSelected = calls.some((c) => selected.has(c.id));
  const toggleAll = (next: boolean) => {
    setSelected((prev) => {
      const s = new Set(prev);
      calls.forEach((c) => {
        if (next) s.add(c.id);
        else s.delete(c.id);
      });
      return s;
    });
  };
  const toggleOne = (id: string, next: boolean) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });
  };

  if (loading) return <Text>Loading…</Text>;

  return (
    <Section>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <TButton onClick={() => void load()}>Refresh</TButton>
        {selected.size > 0 && <Text>{selected.size} selected</Text>}
      </div>
      <div style={{ border: `1px solid ${palette.borderLight}`, borderRadius: '10px', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            background: palette.backgroundSecondary,
            borderBottom: `1px solid ${palette.border}`,
          }}
        >
          <RecordCheckbox checked={allSelected} indeterminate={!allSelected && someSelected} onChange={toggleAll} palette={palette} label="Select all calls" />
          <RecordColumn label="When" width={180} palette={palette} />
          <RecordColumn label="Direction" width={120} palette={palette} />
          <RecordColumn label="Status" width={150} palette={palette} />
          <RecordColumn label="From → To" width={200} palette={palette} />
          <RecordColumn label="Talk" width={80} palette={palette} />
        </div>
        {calls.map((c) => {
          const isSel = selected.has(c.id);
          return (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderBottom: `1px solid ${palette.borderLight}`,
                background: isSel ? 'rgba(55,94,221,0.06)' : palette.background,
              }}
            >
              <RecordCheckbox checked={isSel} onChange={(next) => toggleOne(c.id, next)} palette={palette} label={`Select call ${String(c.toNumber ?? c.id)}`} />
              <div style={{ width: 180, flexShrink: 0, fontSize: '13px', color: palette.textSecondary }}>{fmtDate(c.startedAt ?? c.createdAt)}</div>
              <div style={{ width: 120, flexShrink: 0, fontSize: '13px', color: palette.text }}>{String(c.direction ?? '—')}</div>
              <div style={{ width: 150, flexShrink: 0 }}>
                <Status color={statusColor(c.status)}>{String(c.status ?? '—')}</Status>
              </div>
              <div style={{ width: 200, flexShrink: 0, fontSize: '13px', color: palette.text }}>
                {String(c.fromNumber ?? '')} → {String(c.toNumber ?? '—')}
              </div>
              <div style={{ width: 80, flexShrink: 0, fontSize: '13px', color: palette.textSecondary }}>{fmtDuration(c.durationSeconds)}</div>
              <TButton subtle onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                {openId === c.id ? 'Hide' : 'Show'}
              </TButton>
            </div>
          );
        })}
        {calls.length === 0 && <div style={{ padding: '16px', fontSize: '13px', color: palette.textTertiary }}>No calls yet.</div>}
      </div>
      {openId &&
        (() => {
          const c = calls.find((x) => x.id === openId);
          if (!c) return null;
          return (
            <div
              style={{
                border: `1px solid ${palette.border}`,
                borderRadius: '8px',
                padding: '12px',
                background: palette.backgroundSecondary,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '4px',
              }}
            >
              <Text>Summary</Text>
              <div style={{ fontSize: '13px', color: palette.text }}>{String(c.summary ?? '—')}</div>
              <Text>Transcript</Text>
              <div style={{ fontSize: '13px', color: palette.text, whiteSpace: 'pre-wrap' }}>{String(c.transcript ?? '—')}</div>
            </div>
          );
        })()}
    </Section>
  );
}

function CampaignsTab(): React.ReactElement {
  const palette = usePalette();
  const [campaigns, setCampaigns] = useState<Record<string, any>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listRecords<Record<string, any>>('campaigns', { limit: 100 })
      .then((page) => setCampaigns(page.records))
      .catch(() => notify('Could not load campaigns', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Text>Loading…</Text>;

  return (
    <Section>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {campaigns.map((c) => (
          <div
            key={c.id}
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              padding: '12px 4px',
              borderBottom: `1px solid ${palette.borderLight}`,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: '14px', color: palette.text }}>{String(c.name ?? '—')}</div>
              <div style={{ fontSize: '12px', color: palette.textSecondary }}>{String(c.utmSource ?? '')}</div>
            </div>
            <Tag color={statusColor(c.status)}>{String(c.status ?? '—')}</Tag>
          </div>
        ))}
        {campaigns.length === 0 && <Text>No campaigns found.</Text>}
      </div>
    </Section>
  );
}

function ScriptsTab(): React.ReactElement {
  const palette = usePalette();
  const [scripts, setScripts] = useState<Record<string, any>[]>([]);
  const [campaigns, setCampaigns] = useState<Record<string, any>[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([listRecords<Record<string, any>>('scripts', { limit: 100 }), listRecords<Record<string, any>>('campaigns', { limit: 100 })])
      .then(([s, c]) => {
        setScripts(s.records);
        setCampaigns(c.records);
      })
      .catch(() => notify('Could not load scripts', 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Text>Loading…</Text>;

  const visible = campaignId === '' ? scripts : scripts.filter((s) => String(s.campaignIdId ?? '') === campaignId);

  return (
    <Section>
      <div style={{ marginBottom: '12px' }}>
        <select
          aria-label="Filter by campaign"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          style={{
            fontSize: '13px',
            fontFamily: 'inherit',
            color: palette.text,
            background: palette.background,
            border: `1px solid ${palette.border}`,
            borderRadius: '8px',
            padding: '6px 10px',
            maxWidth: '280px',
          }}
        >
          <option value="">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {String(c.name ?? c.id)}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {visible.map((s) => (
          <div key={s.id}>
            <div style={{ fontWeight: 500, fontSize: '14px', color: palette.text, marginBottom: '6px' }}>
              {String(s.name ?? '—')}
            </div>
            <pre
              style={{
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: palette.backgroundSecondary,
                border: `1px solid ${palette.borderLight}`,
                padding: '10px 12px',
                borderRadius: '8px',
                margin: 0,
                color: palette.text,
                fontFamily: 'inherit',
              }}
            >
              {prettyScript(s.scriptData)}
            </pre>
          </div>
        ))}
        {visible.length === 0 && <Text>No scripts found.</Text>}
      </div>
    </Section>
  );
}

function prettyScript(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') return '—';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

// Hand-rolled tab strip (theme-token matched) in place of the Tabs primitive:
// Tabs pulls in @base-ui/react CompositeList, which walks the DOM with
// compareDocumentPosition - a method the sandboxed Remote DOM cannot answer,
// so any Tabs usage crashes the host renderer. Buttons keep keyboard/a11y.
function TabStrip(props: {
  tab: TabId;
  setTab: (tab: TabId) => void;
  palette: Palette;
}): React.ReactElement {
  const items: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'queue', label: 'Queue', icon: <IconList size={14} /> },
    { id: 'numbers', label: 'Numbers', icon: <IconPhone size={14} /> },
    { id: 'calls', label: 'Calls', icon: <IconHistory size={14} /> },
    { id: 'campaigns', label: 'Campaigns', icon: <IconTarget size={14} /> },
    { id: 'scripts', label: 'Scripts', icon: <IconFileText size={14} /> },
  ];
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        gap: '4px',
        borderBottom: `1px solid ${props.palette.border}`,
        paddingBottom: '8px',
      }}
    >
      {items.map((it) => {
        const active = it.id === props.tab;
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={active}
            onClick={() => props.setTab(it.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: active ? 500 : 400,
              fontFamily: 'inherit',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              border: '1px solid transparent',
              background: active ? props.palette.backgroundSecondary : 'transparent',
              color: active ? props.palette.text : props.palette.textSecondary,
            }}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function DialerApp(): React.ReactElement {
  const palette = usePalette();
  const userId = useUserId();
  const [tab, setTab] = useState<TabId>('queue');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '8px 20px 20px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        background: palette.background,
        color: palette.text,
      }}
    >
      <TabStrip tab={tab} setTab={setTab} palette={palette} />
      {tab === 'queue' && <QueueTab />}
      {tab === 'numbers' && <NumbersTab userId={userId} />}
      {tab === 'calls' && <CallsTab />}
      {tab === 'campaigns' && <CampaignsTab />}
      {tab === 'scripts' && <ScriptsTab />}
    </div>
  );
}
