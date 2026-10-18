import {
  durationMinutes,
  entryInputSchema,
  formatHours,
  START_TIMES,
  type EndTime,
  type IsoDate,
  type StartTime,
  type TimeEntry,
  type TimeEntryInput,
} from '@tt/shared';
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { taskNames } from '../../api/entries';
import { TimeCombobox } from '../../components/TimeCombobox';
import {
  defaultEnd,
  endOptionsAfter,
  splitIssues,
  type FieldErrors,
  type TimeDefaults,
} from './dayLogic';
import styles from './EntryForm.module.css';

export type SaveResult = { ok: true } | { ok: false; fieldErrors: FieldErrors };

interface EntryFormProps {
  date: IsoDate;
  /** Smart defaults for a new entry; null when the whole day is logged. */
  defaults: TimeDefaults | null;
  editing: TimeEntry | null;
  onSave: (input: TimeEntryInput) => Promise<SaveResult>;
  onCancelEdit: () => void;
}

const TASK_DEBOUNCE_MS = 150;
const FALLBACK_START: StartTime = '11:00';

/** Task-name suggestions for the datalist, debounced. Failures just mean no suggestions. */
function useTaskSuggestions(q: string): string[] {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      taskNames(q.trim(), controller.signal).then(setNames, () => {});
    }, TASK_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);
  return names;
}

export function EntryForm({ date, defaults, editing, onSave, onCancelEdit }: EntryFormProps) {
  const id = useId();
  const [start, setStart] = useState<StartTime | null>(defaults?.start ?? FALLBACK_START);
  const [end, setEnd] = useState<EndTime | null>(defaults?.end ?? defaultEnd(FALLBACK_START));
  const [task, setTask] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  /** The user has changed something, so incoming defaults must not overwrite it. */
  const [dirty, setDirty] = useState(false);
  /** In add mode the end follows the start (+1 h) until the user picks an end. */
  const [endTouched, setEndTouched] = useState(false);
  const startRef = useRef<HTMLInputElement>(null);
  const taskRef = useRef<HTMLInputElement>(null);
  const suggestions = useTaskSuggestions(task);

  function resetToDefaults() {
    setStart(defaults?.start ?? FALLBACK_START);
    setEnd(defaults?.end ?? defaultEnd(FALLBACK_START));
    setTask('');
    setNotes('');
    setErrors({});
    setDirty(false);
    setEndTouched(false);
  }

  // Load the entry being edited, or go back to a fresh form. Runs only when `editing` changes.
  useEffect(() => {
    if (editing) {
      setStart(editing.startTime);
      setEnd(editing.endTime);
      setTask(editing.taskName);
      setNotes(editing.notes ?? '');
      setErrors({});
      setDirty(false);
      setEndTouched(true);
      startRef.current?.focus();
    } else {
      resetToDefaults();
    }
  }, [editing]);

  // Defaults arrive after entries and settings load, and change after each save.
  // Applied only while the user hasn't touched the form.
  useEffect(() => {
    if (!editing && !dirty && defaults) {
      setStart(defaults.start);
      setEnd(defaults.end);
    }
  }, [defaults?.start, defaults?.end]);

  const endOptions = useMemo(() => endOptionsAfter(start), [start]);
  const dayFull = !editing && defaults === null;

  function changeStart(t: StartTime | null) {
    setStart(t);
    setDirty(true);
    setErrors(({ startTime: _s, endTime: _e, ...rest }) => rest);
    if (t === null) return;
    if (!endTouched || (end !== null && end <= t)) setEnd(defaultEnd(t));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || dayFull) return;
    if (start === null || end === null) {
      // The combobox already shows "Not a valid time".
      if (start === null) startRef.current?.focus();
      return;
    }

    const parsed = entryInputSchema.safeParse({
      date,
      startTime: start,
      endTime: end,
      taskName: task,
      notes,
    });
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      setErrors(splitIssues(issues).fieldErrors);
      return;
    }

    setSaving(true);
    const result = await onSave(parsed.data);
    setSaving(false);
    if (!result.ok) {
      setErrors(result.fieldErrors);
      return;
    }
    // Editing: the parent clears `editing`, which resets the form. Adding: reset here; the
    // next entry's defaults (starting where this one ended) arrive when the list reloads.
    if (!editing) resetToDefaults();
    taskRef.current?.focus();
  }

  const duration =
    start !== null && end !== null && end > start ? durationMinutes(start, end) : null;
  const reference = editing?.startTime ?? defaults?.start ?? start ?? FALLBACK_START;

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <fieldset className={styles.fieldset} disabled={dayFull}>
        <div className={styles.times}>
          <TimeCombobox
            ref={startRef}
            id={`${id}-start`}
            label="Start"
            options={START_TIMES}
            reference={reference}
            value={start}
            onChange={changeStart}
            error={errors.startTime}
          />
          <TimeCombobox
            id={`${id}-end`}
            label="End"
            options={endOptions}
            reference={start ?? reference}
            value={end}
            onChange={(t) => {
              setEnd(t);
              setDirty(true);
              setEndTouched(true);
              setErrors(({ endTime: _e, ...rest }) => rest);
            }}
            error={errors.endTime}
          />
          <span className={styles.duration} aria-live="polite">
            {duration !== null && `(${formatHours(duration)} h)`}
          </span>
        </div>

        <div className={styles.field}>
          <label htmlFor={`${id}-task`} className={styles.label}>
            Task
          </label>
          <input
            ref={taskRef}
            id={`${id}-task`}
            type="text"
            className={styles.task}
            list={`${id}-tasks`}
            autoComplete="off"
            value={task}
            aria-invalid={errors.taskName ? true : undefined}
            onChange={(e) => {
              setTask(e.target.value);
              setDirty(true);
              setErrors(({ taskName: _t, ...rest }) => rest);
            }}
          />
          <datalist id={`${id}-tasks`}>
            {suggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {errors.taskName && <span className={styles.error}>{errors.taskName}</span>}
        </div>

        <div className={styles.lastRow}>
          <div className={`${styles.field} ${styles.grow}`}>
            <label htmlFor={`${id}-notes`} className={styles.label}>
              Notes
            </label>
            <input
              id={`${id}-notes`}
              type="text"
              value={notes}
              aria-invalid={errors.notes ? true : undefined}
              onChange={(e) => {
                setNotes(e.target.value);
                setDirty(true);
                setErrors(({ notes: _n, ...rest }) => rest);
              }}
            />
            {errors.notes && <span className={styles.error}>{errors.notes}</span>}
          </div>
          <div className={styles.buttons}>
            {editing && (
              <button type="button" className={styles.cancel} onClick={onCancelEdit}>
                Cancel
              </button>
            )}
            <button type="submit" className={styles.submit} disabled={saving}>
              {editing ? 'Save changes' : 'Add entry'}
            </button>
          </div>
        </div>
      </fieldset>
      {dayFull && (
        <p className={styles.note}>
          Every hour of this day is logged. Edit or delete an entry to make room.
        </p>
      )}
    </form>
  );
}
