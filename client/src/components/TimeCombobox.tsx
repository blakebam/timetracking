import { formatTime12, type TimeOfDay } from '@tt/shared';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import styles from './TimeCombobox.module.css';
import { matchTimes } from './timeMatch';

export function timeOptionLabel(t: TimeOfDay): string {
  return t === '24:00' ? '12:00 AM (end of day)' : formatTime12(t);
}

const NOT_A_TIME = 'Not a valid time';

interface TimeComboboxProps<T extends TimeOfDay> {
  id: string;
  label: string;
  options: readonly T[];
  /** Picks between AM and PM when the typed text could be either. */
  reference: TimeOfDay;
  /** Null while the typed text doesn't match any option. */
  value: T | null;
  onChange: (value: T | null) => void;
  error?: string;
  /** Keeps the label for screen readers only, when the page shows its own beside the input. */
  hideLabel?: boolean;
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
}

/** A text input that accepts typed shorthand ("110" → 11:00 AM) with a dropdown of valid times. */
export function TimeCombobox<T extends TimeOfDay>({
  id,
  label,
  options,
  reference,
  value,
  onChange,
  error,
  hideLabel,
  disabled,
  ref,
}: TimeComboboxProps<T>) {
  const [text, setTextState] = useState(value ? timeOptionLabel(value) : '');
  /** Mirrors `text` synchronously, so blur right after a Tab commit sees the committed text. */
  const textRef = useRef(text);
  const [open, setOpen] = useState(false);
  /** True once the user types: the list shows matches instead of every option. */
  const [filtering, setFiltering] = useState(false);
  const [highlight, setHighlight] = useState<T | null>(null);
  const [invalid, setInvalid] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const setText = (s: string) => {
    textRef.current = s;
    setTextState(s);
  };

  // Follow value changes made by the parent (form reset, loading an entry to edit).
  useEffect(() => {
    if (value === null) return;
    setText(timeOptionLabel(value));
    setInvalid(false);
  }, [value]);

  const matches = useMemo(
    () => (filtering ? matchTimes(text, options, reference) : []),
    [filtering, text, options, reference],
  );
  const visible = useMemo(
    () => (filtering ? [...matches].sort() : options),
    [filtering, matches, options],
  );

  useEffect(() => {
    if (!open || highlight === null) return;
    listRef.current
      ?.querySelector(`[data-value="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

  const committedText = value ? timeOptionLabel(value) : '';

  function close() {
    setOpen(false);
    setFiltering(false);
  }

  function commit(t: T) {
    setText(timeOptionLabel(t));
    setInvalid(false);
    close();
    onChange(t);
  }

  /** Turns whatever is typed into the best matching time, or flags it as invalid. */
  function resolveTyped() {
    const typed = textRef.current;
    if (typed === committedText) return;
    if (typed.trim() === '' && value !== null) {
      setText(committedText);
      return;
    }
    const best = typed.trim() === '' ? undefined : matchTimes(typed, options, reference)[0];
    if (best) {
      commit(best);
    } else {
      setInvalid(true);
      close();
      onChange(null);
    }
  }

  function showFullList() {
    setOpen(true);
    setFiltering(false);
    setHighlight(value ?? matchTimes('', options, reference)[0] ?? null);
  }

  function moveHighlight(delta: number) {
    if (visible.length === 0) return;
    const index = highlight === null ? -1 : visible.indexOf(highlight);
    const next = index === -1 ? (delta > 0 ? 0 : visible.length - 1) : index + delta;
    setHighlight(visible[Math.max(0, Math.min(visible.length - 1, next))]!);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        if (open) moveHighlight(e.key === 'ArrowDown' ? 1 : -1);
        else showFullList();
        break;
      case 'Enter':
        if (open && highlight !== null) {
          e.preventDefault();
          commit(highlight);
        } else if (textRef.current !== committedText) {
          e.preventDefault();
          resolveTyped();
        }
        break;
      case 'Tab':
        if (open && highlight !== null) commit(highlight);
        else resolveTyped();
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          close();
          if (value !== null) {
            setText(committedText);
            setInvalid(false);
          }
        }
        break;
    }
  }

  const listId = `${id}-list`;
  const optionId = (t: T) => `${id}-opt-${t.replace(':', '')}`;
  const shownError = invalid ? NOT_A_TIME : error;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={hideLabel ? styles.srOnly : styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          ref={ref}
          id={id}
          className={styles.input}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && highlight !== null ? optionId(highlight) : undefined}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? `${id}-error` : undefined}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
            setOpen(true);
            setFiltering(true);
            setHighlight(matchTimes(e.target.value, options, reference)[0] ?? null);
          }}
          onClick={() => {
            if (!open) showFullList();
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            close();
            resolveTyped();
          }}
        />
        {open && (
          <ul ref={listRef} id={listId} role="listbox" aria-label={label} className={styles.list}>
            {visible.length === 0 && <li className={styles.empty}>{NOT_A_TIME}</li>}
            {visible.map((t) => (
              <li
                key={t}
                id={optionId(t)}
                data-value={t}
                role="option"
                aria-selected={t === highlight}
                className={t === highlight ? `${styles.option} ${styles.active}` : styles.option}
                // Keep focus in the input so blur doesn't resolve the typed text first.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(t)}
              >
                {timeOptionLabel(t)}
              </li>
            ))}
          </ul>
        )}
      </div>
      {shownError && (
        <span id={`${id}-error`} className={styles.error}>
          {shownError}
        </span>
      )}
    </div>
  );
}
