import SignaturePlacement, { signatureStyle } from './SignaturePlacement.jsx';

/** Date line and signature area. The signature is draggable when `editable`. `t` uses the bill's language. */
export default function SignatureFooter({ firm, visible, editable, onLayoutChange, t }) {
  const showSignature = Boolean(firm.signature) && visible;
  return (
    <div className="signature-row">
      <span>{t('Date: ______________')}</span>
      {editable && showSignature ? (
        <SignaturePlacement image={firm.signature} layout={firm.signatureLayout} caption={t('Signature')} onChange={onLayoutChange} />
      ) : (
        <div className="paper-signature-area">
          {showSignature && (
            <img className="signature-static-image" src={firm.signature} alt="" style={signatureStyle(firm.signatureLayout)} />
          )}
          <span className="paper-signature-caption">{t('Signature')}</span>
        </div>
      )}
    </div>
  );
}
