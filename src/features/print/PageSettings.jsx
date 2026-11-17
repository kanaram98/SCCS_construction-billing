import { CollapsibleCard, SelectField, TextAreaField, TextField, ToggleSelectField } from '../../components/ui';
import {
  FONT_SIZES,
  HEADER_MODES,
  MARGIN_RANGE,
  ORIENTATIONS,
  PAGE_BREAKS,
  PAPER_SIZES,
  SUMMARY_DETAILS
} from '../../domain/print-settings.js';

const PAPER_OPTIONS = Object.entries(PAPER_SIZES).map(([value, { label }]) => ({ value, label }));
const FONT_OPTIONS = FONT_SIZES.map((size) => ({ value: size, label: `${size} pt` }));

export function PageSetupSettings({ settings, onChange }) {
  return (
    <CollapsibleCard className="no-print print-settings-group" title="Page setup" defaultOpen>
      <div className="form-grid print-settings-grid">
        <SelectField label="Paper size" value={settings.paper} options={PAPER_OPTIONS} onChange={(paper) => onChange({ paper })} />
        <SelectField label="Orientation" value={settings.orientation} options={ORIENTATIONS} onChange={(orientation) => onChange({ orientation })} />
        <TextField
          label="Margins (mm)"
          type="number"
          min={MARGIN_RANGE.min}
          max={MARGIN_RANGE.max}
          step="1"
          value={settings.margin}
          onChange={(margin) => onChange({ margin })}
        />
        <SelectField label="Text size" value={settings.fontSize} options={FONT_OPTIONS} onChange={(fontSize) => onChange({ fontSize: Number(fontSize) })} />
      </div>
    </CollapsibleCard>
  );
}

export function LayoutSettings({ settings, footer, onChange, onFooterChange }) {
  return (
    <CollapsibleCard className="no-print print-settings-group" title="Headers, rows and footer">
      <div className="form-grid print-settings-grid">
        <SelectField label="Page header" value={settings.headerMode} options={HEADER_MODES} onChange={(headerMode) => onChange({ headerMode })} />
        <SelectField label="Page break" value={settings.pageBreak} options={PAGE_BREAKS} onChange={(pageBreak) => onChange({ pageBreak })} />
        <ToggleSelectField
          label="Row numbers"
          value={settings.rowNumbers}
          onLabel="1, 2, 3…"
          offLabel="Off"
          offFirst
          onChange={(rowNumbers) => onChange({ rowNumbers })}
        />
        <SelectField label="Summary detail" value={settings.summaryDetail} options={SUMMARY_DETAILS} onChange={(summaryDetail) => onChange({ summaryDetail })} />
        <ToggleSelectField
          label="Page numbers"
          value={settings.pageNumbers}
          onLabel="Page 1 of N"
          offLabel="Off"
          onChange={(pageNumbers) => onChange({ pageNumbers })}
        />
      </div>
      <TextAreaField className="full-field" label="Footer lines (up to 3)" rows="3" value={footer} onChange={onFooterChange} />
    </CollapsibleCard>
  );
}
