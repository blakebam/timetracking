import { formatInvoiceNumber, START_TIMES, type Settings } from '@tt/shared';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useBlocker } from 'react-router';
import { apiErrorBody, describeError } from '../../api/client';
import { putSettings } from '../../api/settings';
import { TimeCombobox } from '../../components/TimeCombobox';
import { useSettings } from '../../hooks/useSettings';
import styles from './SettingsPage.module.css';
import {
  isDirty,
  normalizeRateInput,
  parseInvoiceNumber,
  splitSettingsIssues,
  toForm,
  validateForm,
  type SettingsField,
  type SettingsFieldErrors,
  type SettingsForm,
} from './settingsForm';

const DISCARD_PROMPT = 'Discard unsaved changes?';

/** Route component for `/settings`. */
export function SettingsPage() {
  const { settings, error, invalidate } = useSettings();

  let body: ReactNode;
  if (settings) body = <SettingsEditor loaded={settings} onSaved={invalidate} />;
  else if (error) {
    body = (
      <p className={styles.banner} role="alert">
        ⚠ {describeError(error)}{' '}
        <button type="button" onClick={() => invalidate()}>
          Retry
        </button>
      </p>
    );
  } else body = <p className={styles.muted}>Loading…</p>;

  return (
    <>
      <h1 className={styles.title}>Settings</h1>
      {body}
    </>
  );
}

/** Asks before leaving the page (in-app link, reload or closing the tab) with unsaved edits. */
function useConfirmLeave(when: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(DISCARD_PROMPT)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!when) return;
    // Browsers show their own wording for this prompt.
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);
}

interface SettingsEditorProps {
  loaded: Settings;
  onSaved: (saved: Settings) => void;
}

function SettingsEditor({ loaded, onSaved }: SettingsEditorProps) {
  const id = useId();
  const [initial, setInitial] = useState(() => toForm(loaded));
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<SettingsFieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const startRef = useRef<HTMLInputElement>(null);

  const dirty = isDirty(form, initial);
  useConfirmLeave(dirty);

  function update<K extends SettingsField>(field: K, value: SettingsForm[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors(({ [field]: _removed, ...rest }) => rest);
    setSaved(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !dirty) return;
    if (form.defaultStartTime === null) {
      // The time picker already shows "Not a valid time".
      startRef.current?.focus();
      return;
    }

    const result = validateForm(form);
    if (!result.ok) {
      setErrors(result.fieldErrors);
      setBanner(null);
      return;
    }

    setSaving(true);
    try {
      const next = await putSettings(result.input);
      const nextForm = toForm(next);
      setInitial(nextForm);
      setForm(nextForm);
      setErrors({});
      setBanner(null);
      setSaved(true);
      onSaved(next);
    } catch (err) {
      const body = apiErrorBody(err);
      if (body?.error === 'validation') {
        const { fieldErrors, other } = splitSettingsIssues(body.issues);
        setErrors(fieldErrors);
        setBanner(other.length > 0 ? other.join(' ') : null);
      } else {
        setBanner(describeError(err));
      }
    } finally {
      setSaving(false);
    }
  }

  /** Props shared by the plain text inputs and textareas. */
  const textProps = (field: Exclude<SettingsField, 'defaultStartTime'>) => ({
    id: `${id}-${field}`,
    value: form[field],
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined,
    onChange: (e: { target: { value: string } }) => update(field, e.target.value),
  });

  const field = (name: SettingsField, label: string, control: ReactNode, hint?: ReactNode) => (
    <div className={styles.row}>
      <label htmlFor={`${id}-${name}`} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <div className={styles.inline}>
          {control}
          {hint}
        </div>
        {errors[name] && (
          <span id={`${id}-${name}-error`} className={styles.error}>
            {errors[name]}
          </span>
        )}
      </div>
    </div>
  );

  const invoiceNumber = parseInvoiceNumber(form.nextInvoiceNumber);

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <fieldset className={styles.section}>
        <legend className={styles.legend}>You (biller)</legend>
        {field('billerName', 'Name', <input type="text" {...textProps('billerName')} />)}
        {field('billerAddress', 'Address', <textarea rows={3} {...textProps('billerAddress')} />)}
        {field('billerPhone', 'Phone', <input type="text" {...textProps('billerPhone')} />)}
        {field(
          'billerEmail',
          'Email',
          <input type="text" inputMode="email" {...textProps('billerEmail')} />,
        )}
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>Bill to</legend>
        {field('companyName', 'Company', <input type="text" {...textProps('companyName')} />)}
        {field(
          'companyAddress',
          'Address',
          <textarea rows={3} {...textProps('companyAddress')} />,
          <span className={styles.muted}>(optional)</span>,
        )}
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>Billing</legend>
        {field(
          'hourlyRate',
          'Hourly rate',
          <span className={styles.money}>
            <span aria-hidden="true">$</span>
            <input
              type="text"
              inputMode="decimal"
              className={styles.short}
              {...textProps('hourlyRate')}
              onBlur={() => {
                const normalized = normalizeRateInput(form.hourlyRate);
                if (normalized !== form.hourlyRate) update('hourlyRate', normalized);
              }}
            />
          </span>,
        )}
        {field(
          'paymentTerms',
          'Payment terms',
          <input type="text" className={styles.medium} {...textProps('paymentTerms')} />,
        )}
        {field(
          'nextInvoiceNumber',
          'Next invoice #',
          <input
            type="text"
            inputMode="numeric"
            className={styles.short}
            {...textProps('nextInvoiceNumber')}
          />,
          invoiceNumber !== null && invoiceNumber >= 1 && (
            <span className={styles.muted} aria-live="polite">
              → next invoice will be {formatInvoiceNumber(invoiceNumber)}
            </span>
          ),
        )}
      </fieldset>

      <fieldset className={styles.section}>
        <legend className={styles.legend}>Preferences</legend>
        <div className={styles.row}>
          <span className={styles.label} aria-hidden="true">
            Default start time
          </span>
          <div className={styles.control}>
            <TimeCombobox
              ref={startRef}
              id={`${id}-defaultStartTime`}
              label="Default start time"
              hideLabel
              options={START_TIMES}
              reference={form.defaultStartTime ?? initial.defaultStartTime ?? '11:00'}
              value={form.defaultStartTime}
              onChange={(t) => update('defaultStartTime', t)}
              error={errors.defaultStartTime}
            />
          </div>
        </div>
      </fieldset>

      {banner && (
        <p className={styles.banner} role="alert">
          ⚠ {banner}
        </p>
      )}

      <div className={styles.actions}>
        <span className={styles.saved} role="status">
          {saved && '✓ Saved'}
        </span>
        <button type="submit" className={styles.submit} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
