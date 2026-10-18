import {
  formatRange12,
  isoDateSchema,
  todayIso,
  type IsoDate,
  type StartTime,
  type TimeEntry,
  type TimeEntryInput,
} from '@tt/shared';
import { useCallback, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { apiErrorBody, describeError } from '../../api/client';
import { createEntry, deleteEntry, updateEntry } from '../../api/entries';
import { useEntries } from '../../hooks/useEntries';
import { useSettings } from '../../hooks/useSettings';
import { DayHeader } from './DayHeader';
import { smartDefaults, splitIssues, totalMinutes } from './dayLogic';
import styles from './DayPage.module.css';
import { EntryForm, type SaveResult } from './EntryForm';
import { EntryList } from './EntryList';

/** Used until settings load (or if they can't be loaded). Matches the settings default. */
const FALLBACK_DEFAULT_START: StartTime = '11:00';
const NO_CONFLICTS: ReadonlySet<number> = new Set();

/** Route component for `/day/:date`; a missing or invalid date redirects to today. */
export function DayPage() {
  const params = useParams();
  const parsed = isoDateSchema.safeParse(params.date);
  if (!parsed.success) return <Navigate to={`/day/${todayIso()}`} replace />;
  // Keyed by date so moving to another day starts with a fresh form and no stale errors.
  return <DayView key={parsed.data} date={parsed.data} />;
}

function DayView({ date }: { date: IsoDate }) {
  const navigate = useNavigate();
  const { entries, loading, error: loadError, reload } = useEntries(date, date);
  const { settings } = useSettings();
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [conflictIds, setConflictIds] = useState(NO_CONFLICTS);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [entries],
  );
  const defaults = useMemo(
    () => smartDefaults(entries, settings?.defaultStartTime ?? FALLBACK_DEFAULT_START),
    [entries, settings],
  );

  const onNavigate = useCallback((d: IsoDate) => navigate(`/day/${d}`), [navigate]);

  function startEdit(entry: TimeEntry) {
    setEditing(entry);
    setBanner(null);
    setConflictIds(NO_CONFLICTS);
  }

  function entryGone() {
    setBanner('That entry no longer exists.');
    setEditing(null);
    reload();
  }

  async function save(input: TimeEntryInput): Promise<SaveResult> {
    try {
      if (editing) await updateEntry(editing.id, input);
      else await createEntry(input);
    } catch (err) {
      const body = apiErrorBody(err);
      switch (body?.error) {
        case 'validation': {
          const { fieldErrors, other } = splitIssues(body.issues);
          setBanner(other.length > 0 ? other.join(' ') : null);
          return { ok: false, fieldErrors };
        }
        case 'overlap':
          setBanner(body.message);
          setConflictIds(new Set(body.conflicts.map((c) => c.id)));
          return { ok: false, fieldErrors: {} };
        case 'not_found':
          entryGone();
          return { ok: false, fieldErrors: {} };
        default:
          setBanner(describeError(err));
          return { ok: false, fieldErrors: {} };
      }
    }
    setBanner(null);
    setConflictIds(NO_CONFLICTS);
    setEditing(null);
    reload();
    return { ok: true };
  }

  async function remove(entry: TimeEntry) {
    const what = `${formatRange12(entry.startTime, entry.endTime)} ${entry.taskName}`;
    if (!window.confirm(`Delete ${what}?`)) return;
    try {
      await deleteEntry(entry.id);
      setBanner(null);
    } catch (err) {
      if (apiErrorBody(err)?.error === 'not_found') setBanner('That entry no longer exists.');
      else {
        setBanner(describeError(err));
        return;
      }
    }
    if (editing?.id === entry.id) setEditing(null);
    setConflictIds((ids) => {
      if (!ids.has(entry.id)) return ids;
      const next = new Set(ids);
      next.delete(entry.id);
      return next;
    });
    reload();
  }

  const message = banner ?? (loadError ? describeError(loadError) : null);

  return (
    <>
      <DayHeader date={date} totalMinutes={totalMinutes(entries)} onNavigate={onNavigate} />
      <EntryForm
        date={date}
        defaults={defaults}
        editing={editing}
        onSave={save}
        onCancelEdit={() => setEditing(null)}
      />
      {message && (
        <p className={styles.banner} role="alert">
          ⚠ {message}
        </p>
      )}
      <EntryList
        entries={sorted}
        loading={loading}
        editingId={editing?.id ?? null}
        conflictIds={conflictIds}
        onEdit={startEdit}
        onDelete={(e) => void remove(e)}
      />
    </>
  );
}
