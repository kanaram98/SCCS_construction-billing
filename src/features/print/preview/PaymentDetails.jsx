import { formatCurrency } from '../../../domain/formatters.js';
import QrCode from './QrCode.jsx';

/** "Payment details" block with bank/UPI lines and an optional UPI QR code. `t` uses the bill's language. */
export default function PaymentDetails({ block, t }) {
  if (!block) return null;
  return (
    <div className="paper-payment">
      <div>
        <div className="paper-payment-title">{t('Payment details')}</div>
        {block.lines.map((line) => <div key={line}>{line}</div>)}
      </div>
      {block.qr && (
        <div className="paper-payment-qr">
          <QrCode matrix={block.qr.matrix} title="UPI QR" />
          <div>{t('Scan to pay {amount}', { amount: formatCurrency(block.qr.amount) })}</div>
        </div>
      )}
    </div>
  );
}
