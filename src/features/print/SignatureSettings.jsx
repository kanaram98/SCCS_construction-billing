import { Button, CollapsibleCard, SelectField } from '../../components/ui';
import { SIGNATURE_MODES, SIGNATURE_WIDTH_RANGE } from '../../domain/print-settings.js';

export default function SignatureSettings({ settings, hasSignature, onChange, onWidthChange, onResetPlacement }) {
  return (
    <CollapsibleCard className="no-print print-settings-group" title="Digital signature">
      <div className="form-grid print-settings-grid">
        <SelectField label="Show signature on" value={settings.signatureMode} options={SIGNATURE_MODES} onChange={(signatureMode) => onChange({ signatureMode })} />
        <label>Signature width · {settings.signatureWidth} mm
          <input
            type="range"
            min={SIGNATURE_WIDTH_RANGE.min}
            max={SIGNATURE_WIDTH_RANGE.max}
            value={settings.signatureWidth}
            onChange={(event) => onWidthChange(event.target.value)}
          />
        </label>
      </div>
      {hasSignature && (
        <div className="signature-placement-help">
          <span>Drag the signature in the preview footer to position it, or use its corner handle to resize.</span>
          <Button onClick={onResetPlacement}>Reset placement</Button>
        </div>
      )}
    </CollapsibleCard>
  );
}
