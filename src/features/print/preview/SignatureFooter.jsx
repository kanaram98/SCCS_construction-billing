import SignaturePlacement, { signatureStyle } from './SignaturePlacement.jsx';

/** Date line and signature area. The signature is draggable when `editable`. */
export default function SignatureFooter({ firm, visible, editable, onLayoutChange }) {
  const showSignature = Boolean(firm.signature) && visible;
  return (
    <div className="signature-row">
      <span>Date: ______________</span>
      {editable && showSignature ? (
        <SignaturePlacement image={firm.signature} layout={firm.signatureLayout} onChange={onLayoutChange} />
      ) : (
        <div className="paper-signature-area">
          {showSignature && (
            <img className="signature-static-image" src={firm.signature} alt="" style={signatureStyle(firm.signatureLayout)} />
          )}
          <span className="paper-signature-caption">Signature</span>
        </div>
      )}
    </div>
  );
}
