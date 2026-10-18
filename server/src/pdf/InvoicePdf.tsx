import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  formatHoursCompact,
  formatInvoiceDate,
  formatInvoiceNumber,
  formatRate,
  formatUsd,
  type InvoiceDraft,
} from '@tt/shared';
import { LabelValue, Watermark } from './components';
import { colors, fontFamily, fontSize, fontWeight, page, rowHeight } from './theme';

/** Column widths, measured from the right margin. The task name takes the rest. */
const col = { rate: 70, qty: 50, amount: 80 };

const styles = StyleSheet.create({
  page: {
    paddingTop: page.invoiceTop,
    paddingBottom: page.bottom,
    paddingHorizontal: page.marginX,
    fontFamily,
    color: colors.text,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  billerName: { fontSize: fontSize.billerName, marginBottom: 4 },
  billerLine: {
    fontSize: fontSize.billerLine,
    lineHeight: rowHeight.billerLine / fontSize.billerLine,
  },
  details: { width: 180, paddingTop: 2 },
  detailGap: { marginTop: 17 },
  billTo: { marginTop: 34 },
  label: { fontSize: fontSize.label },
  company: { fontSize: fontSize.company, marginTop: 2 },
  companyLine: { fontSize: fontSize.companyLine, lineHeight: 1.6 },
  firstCompanyLine: { marginTop: 3 },
  table: { marginTop: 40, paddingLeft: 17 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  itemsWorked: { flex: 1, fontSize: fontSize.itemsHeader },
  headerCell: { fontSize: fontSize.label },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: rowHeight.invoice,
    fontSize: fontSize.invoiceRow,
  },
  task: { flex: 1, paddingRight: 12, color: colors.strong, fontWeight: fontWeight.medium },
  rate: { width: col.rate, textAlign: 'center' },
  qty: { width: col.qty, textAlign: 'center' },
  amount: { width: col.amount, textAlign: 'right' },
  totalBlock: {
    width: 280,
    marginTop: 25,
    marginLeft: 'auto',
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
  totalRow: {
    flexDirection: 'row',
    paddingTop: 8,
    fontSize: fontSize.invoiceTotal,
  },
  totalLabel: { width: 93, paddingLeft: 14 },
  totalHours: { flex: 1 },
});

/** "49 Hours", or "1 Hour" for exactly one. */
const hoursLabel = (minutes: number) =>
  minutes === 60 ? '1 Hour' : `${formatHoursCompact(minutes)} Hours`;

/** Non-empty lines of a multi-line field. */
const lines = (s: string) => s.split('\n').filter((l) => l.trim() !== '');

/**
 * An invoice: the issued snapshot, or a live draft (`draft`), which gets a DRAFT watermark and
 * shows the number it would be issued as.
 */
export function InvoicePdf({ invoice, draft = false }: { invoice: InvoiceDraft; draft?: boolean }) {
  const number = formatInvoiceNumber(invoice.invoiceNumber);
  const { biller, company } = invoice;
  const billerLines = [...lines(biller.address), biller.phone, biller.email].filter(Boolean);

  return (
    <Document title={draft ? `${number} (draft)` : number} author={biller.name || undefined}>
      <Page size={page.size} style={styles.page}>
        {draft && <Watermark />}

        <View style={styles.top}>
          <View>
            {biller.name && <Text style={styles.billerName}>{biller.name}</Text>}
            {billerLines.map((line, i) => (
              <Text key={i} style={styles.billerLine}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.details}>
            <LabelValue label="INVOICE" value={number} />
            <LabelValue
              label="DATE"
              value={formatInvoiceDate(invoice.invoiceDate)}
              style={styles.detailGap}
            />
            <LabelValue label="DUE" value={invoice.paymentTerms} style={styles.detailGap} />
            <LabelValue
              label="BALANCE DUE"
              value={`USD ${formatUsd(invoice.amountCents)}`}
              style={styles.detailGap}
            />
          </View>
        </View>

        <View style={styles.billTo}>
          <Text style={styles.label}>BILL TO</Text>
          {company.name && <Text style={styles.company}>{company.name}</Text>}
          {lines(company.address).map((line, i) => (
            <Text
              key={i}
              style={i === 0 ? [styles.companyLine, styles.firstCompanyLine] : styles.companyLine}
            >
              {line}
            </Text>
          ))}
        </View>

        <View style={styles.table}>
          <View style={styles.headerRow} wrap={false}>
            <Text style={styles.itemsWorked}>Items Worked</Text>
            <Text style={[styles.headerCell, styles.rate]}>RATE</Text>
            <Text style={[styles.headerCell, styles.qty]}>QTY</Text>
            <Text style={[styles.headerCell, styles.amount]}>AMOUNT</Text>
          </View>
          {invoice.lines.map((line) => (
            <View key={line.taskName} style={styles.row} wrap={false}>
              <Text style={styles.task}>{line.taskName}</Text>
              <Text style={styles.rate}>{formatRate(line.rateCents)}</Text>
              <Text style={styles.qty}>{formatHoursCompact(line.minutes)}</Text>
              <Text style={styles.amount}>{formatUsd(line.amountCents)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalBlock} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalHours}>{hoursLabel(invoice.totalMinutes)}</Text>
            <Text>USD {formatUsd(invoice.amountCents)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
