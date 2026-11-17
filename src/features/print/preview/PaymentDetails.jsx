import { formatCurrency } from '../../../domain/formatters.js';
import QrCode from './QrCode.jsx';

/** "Payment details" block with bank/UPI lines and an optional UPI QR code. */
export default function PaymentDetails({ block }) {
  if (!block) return null;
  return (
    <div className="paper-payment">
      <div>
        <div className="paper-payment-title">Payment details</div>
        {block.lines.map((line) => <div key={line}>{line}</div>)}
      </div>
      {block.qr && (
        <div className="paper-payment-qr">
          <QrCode matrix={block.qr.matrix} title="UPI payment QR code" />
          <div>Scan to pay {formatCurrency(block.qr.amount)}</div>
        </div>
      )}
    </div>
  );
}
