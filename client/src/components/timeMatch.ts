import { formatTime12, toMinutes, type TimeOfDay } from '@tt/shared';

const SUFFIX_RE = /(am|a|pm|p)$/;
const INPUT_RE = /^\d*(:\d*)?$/;

/** The label used for matching: "1:30 PM" → { hm: "1:30", digits: "130", pm: true }. */
function labelParts(t: TimeOfDay) {
  const [hm, ampm] = formatTime12(t).split(' ') as [string, string];
  return { hm, digits: hm.replace(':', ''), pm: ampm === 'PM' };
}

/**
 * The options matching what the user typed, best match first.
 *
 * Typed text is a prefix of the 12-hour label: without a colon it's compared to the label's
 * digits ("110" → 11:00), with a colon to its "h:mm" ("1:1" → 1:15). A trailing a/am/p/pm
 * filters to that half of the day.
 *
 * Ranking: times that are the typed digits followed only by zeros come first, fewest zeros
 * first ("9" → 9:00 before 9:45, "1" → 1:00 before 10:00). Then nearest to `reference`, and on
 * a tie the later time.
 */
export function matchTimes<T extends TimeOfDay>(
  input: string,
  options: readonly T[],
  reference: TimeOfDay,
): T[] {
  let text = input.toLowerCase().replace(/\s+/g, '');
  let wantPm: boolean | undefined;
  const suffix = SUFFIX_RE.exec(text);
  if (suffix) {
    wantPm = suffix[1]!.startsWith('p');
    text = text.slice(0, -suffix[1]!.length);
  }
  if (!INPUT_RE.test(text)) return [];

  const useColon = text.includes(':');
  const ref = toMinutes(reference);

  const ranked = options.flatMap((t) => {
    const { hm, digits, pm } = labelParts(t);
    if (wantPm !== undefined && pm !== wantPm) return [];
    const target = useColon ? hm : digits;
    if (!target.startsWith(text)) return [];
    const rest = target.slice(text.length).replace(':', '');
    const zeroFill = text !== '' && /^0*$/.test(rest) ? rest.length : Infinity;
    const minutes = toMinutes(t);
    return [{ t, zeroFill, distance: Math.abs(minutes - ref), minutes }];
  });

  ranked.sort(
    (a, b) => a.zeroFill - b.zeroFill || a.distance - b.distance || b.minutes - a.minutes,
  );
  return ranked.map((r) => r.t);
}
