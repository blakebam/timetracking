import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { byFirstWorked, formatHoursCompact, formatShortRange, type Summary } from '@tt/shared';
import { FadeRule } from './components';
import { colors, fontFamily, fontSize, page, rowHeight } from './theme';

const styles = StyleSheet.create({
  page: {
    paddingTop: page.timesheetTop,
    paddingBottom: page.bottom,
    paddingHorizontal: page.marginX,
    fontFamily,
    color: colors.text,
  },
  title: { fontSize: fontSize.timesheetTitle, textAlign: 'center', marginBottom: 34 },
  header: {
    height: 35,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: fontSize.timesheetHeader,
  },
  /** Under the header on every page, so rows continued on a later page get the same gap. */
  belowHeader: { height: 29 },
  rows: { paddingBottom: 29 },
  /** Tops the gap between the header and the total up to the empty example's 35 pt. */
  noRows: { height: 6 },
  row: {
    minHeight: rowHeight.timesheet,
    flexDirection: 'row',
    alignItems: 'center',
    fontSize: fontSize.timesheetRow,
  },
  task: { flex: 1, paddingRight: 24 },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 17,
    fontSize: fontSize.timesheetTotal,
  },
});

/** One timesheet period: per-task totals in first-worked order, then the total. */
export function TimesheetPdf({ summary }: { summary: Summary }) {
  const title = `${formatShortRange(summary.from, summary.to)} Weekly Timesheet`;
  const rows = byFirstWorked(summary.tasks);

  return (
    <Document title={title}>
      <Page size={page.size} style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        {/* Repeated at the top of every page when a long list runs over. */}
        <View fixed>
          <FadeRule />
          <View style={styles.header}>
            <Text>Items</Text>
            <Text>Hours</Text>
          </View>
          <FadeRule />
          <View style={styles.belowHeader} />
        </View>

        {rows.length > 0 ? (
          <View style={styles.rows}>
            {rows.map((t) => (
              <View key={t.taskName} style={styles.row} wrap={false}>
                <Text style={styles.task}>{t.taskName}</Text>
                <Text>{formatHoursCompact(t.minutes)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.noRows} />
        )}

        <View wrap={false}>
          <FadeRule />
          <View style={styles.total}>
            <Text>Total</Text>
            <Text>{formatHoursCompact(summary.totalMinutes)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
