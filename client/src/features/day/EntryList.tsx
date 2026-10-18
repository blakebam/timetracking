import { durationMinutes, formatHours, formatRange12, type TimeEntry } from '@tt/shared';
import styles from './EntryList.module.css';

interface EntryListProps {
  entries: readonly TimeEntry[];
  loading: boolean;
  editingId: number | null;
  conflictIds: ReadonlySet<number>;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
}

export function EntryList({
  entries,
  loading,
  editingId,
  conflictIds,
  onEdit,
  onDelete,
}: EntryListProps) {
  if (entries.length === 0) {
    return <p className={styles.empty}>{loading ? 'Loading…' : 'No entries for this day yet.'}</p>;
  }

  return (
    <ul className={styles.list}>
      {entries.map((e) => {
        const conflict = conflictIds.has(e.id);
        const rowClass = [
          styles.row,
          e.id === editingId && styles.editing,
          conflict && styles.conflict,
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <li key={e.id} className={rowClass}>
            <span className={styles.range}>{formatRange12(e.startTime, e.endTime)}</span>
            <span className={styles.hours}>
              {formatHours(durationMinutes(e.startTime, e.endTime))} h
            </span>
            <span className={styles.task}>{e.taskName}</span>
            <span className={styles.notes} title={e.notes ?? undefined}>
              {e.notes}
            </span>
            <span className={styles.actions}>
              <button type="button" onClick={() => onEdit(e)}>
                {conflict ? 'Edit this entry' : 'Edit'}
              </button>
              <button
                type="button"
                aria-label={`Delete ${formatRange12(e.startTime, e.endTime)} ${e.taskName}`}
                onClick={() => onDelete(e)}
              >
                ✕
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
