import { useMemo } from 'react';
import { buildDocument, toTableCells } from '../../../documents/document-model.js';
import { formatCurrency } from '../../../domain/formatters.js';
import { getFooterLines, getPageWidthMm } from '../../../domain/print-settings.js';
import { buildPaymentBlock } from '../../../documents/payment-block.js';
import PaperHeader from './PaperHeader.jsx';
import PaymentDetails from './PaymentDetails.jsx';
import SignatureFooter from './SignatureFooter.jsx';

const MM_TO_PX = 3.7795;

/** On-screen width of the paper in CSS pixels for the chosen paper size and orientation. */
export function getPaperWidthPx(printSettings) {
  return Math.round(getPageWidthMm(printSettings) * MM_TO_PX);
}

const ROW_CLASSES = {
  section: 'section-band',
  area: 'area-band',
  total: 'area-total-row',
  sectionTotal: 'section-total-row',
  grandTotal: 'grand-row'
};

/**
 * HTML rendering of one printable document, used for the on-screen preview and
 * for browser printing. Page breaks become `entry-break-before` rows.
 */
export default function DocumentPreview({
  bill,
  firm,
  rates,
  documentType,
  printSettings,
  signatureVisible = false,
  editableSignature = false,
  className = '',
  onSignatureLayoutChange
}) {
  const { columns, chunks } = useMemo(
    () => buildDocument(documentType, bill, rates, printSettings, { money: formatCurrency }),
    [documentType, bill, rates, printSettings]
  );
  const paymentBlock = useMemo(
    () => buildPaymentBlock(documentType, bill, rates, firm, printSettings),
    [documentType, bill, rates, firm, printSettings]
  );
  const repeatHeader = printSettings.headerMode === 'all';
  const header = <PaperHeader bill={bill} firm={firm} documentType={documentType} />;
  const footerLines = getFooterLines(bill.footer);
  const pageStyle = {
    maxWidth: `${getPaperWidthPx(printSettings)}px`,
    '--paper-margin': `${printSettings.margin}mm`,
    '--print-font-size': `${printSettings.fontSize}pt`
  };

  return (
    <article
      className={['paper', 'print-document', repeatHeader && 'paper-header-repeat', className].filter(Boolean).join(' ')}
      style={pageStyle}
    >
      <header className="paper-header">{header}</header>
      <table>
        <thead>
          {repeatHeader && <tr className="print-repeat-header"><th colSpan={columns.length}>{header}</th></tr>}
          <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {chunks.flatMap((rows, chunkIndex) => rows.map((row, rowIndex) => {
            const classes = [ROW_CLASSES[row.kind], chunkIndex > 0 && rowIndex === 0 && 'entry-break-before'];
            return (
              <tr key={`${chunkIndex}-${rowIndex}`} className={classes.filter(Boolean).join(' ') || undefined}>
                {toTableCells(row, columns.length).map((cell, cellIndex) => (
                  <td key={cellIndex} colSpan={cell.span > 1 ? cell.span : undefined}>{cell.text}</td>
                ))}
              </tr>
            );
          }))}
        </tbody>
      </table>
      <PaymentDetails block={paymentBlock} />
      {footerLines.length > 0 && (
        <div className="paper-footer">{footerLines.map((line, index) => <div key={index}>{line}</div>)}</div>
      )}
      <SignatureFooter
        firm={firm}
        visible={signatureVisible}
        editable={editableSignature}
        onLayoutChange={onSignatureLayoutChange}
      />
    </article>
  );
}
