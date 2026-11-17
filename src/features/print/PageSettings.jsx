import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { CollapsibleCard, SelectField, SwitchField, TextAreaField, TextField } from '../../components/ui';
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
    <CollapsibleCard className="no-print" title="Page setup">
      <Grid container spacing={2}>
        <Grid size={6}>
          <SelectField label="Paper size" value={settings.paper} options={PAPER_OPTIONS} onChange={(paper) => onChange({ paper })} />
        </Grid>
        <Grid size={6}>
          <SelectField label="Orientation" value={settings.orientation} options={ORIENTATIONS} onChange={(orientation) => onChange({ orientation })} />
        </Grid>
        <Grid size={6}>
          <TextField
            label="Margins (mm)"
            type="number"
            min={MARGIN_RANGE.min}
            max={MARGIN_RANGE.max}
            step="1"
            value={settings.margin}
            onChange={(margin) => onChange({ margin })}
          />
        </Grid>
        <Grid size={6}>
          <SelectField label="Text size" value={settings.fontSize} options={FONT_OPTIONS} onChange={(fontSize) => onChange({ fontSize: Number(fontSize) })} />
        </Grid>
      </Grid>
    </CollapsibleCard>
  );
}

export function LayoutSettings({ settings, footer, onChange, onFooterChange }) {
  return (
    <CollapsibleCard className="no-print" title="Headers, rows and footer">
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <SelectField label="Page header" value={settings.headerMode} options={HEADER_MODES} onChange={(headerMode) => onChange({ headerMode })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <SelectField label="Page break" value={settings.pageBreak} options={PAGE_BREAKS} onChange={(pageBreak) => onChange({ pageBreak })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <SelectField label="Summary detail" value={settings.summaryDetail} options={SUMMARY_DETAILS} onChange={(summaryDetail) => onChange({ summaryDetail })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Stack>
            <SwitchField label="Row numbers (1, 2, 3…)" checked={settings.rowNumbers} onChange={(rowNumbers) => onChange({ rowNumbers })} />
            <SwitchField label="Page numbers (Page 1 of N)" checked={settings.pageNumbers} onChange={(pageNumbers) => onChange({ pageNumbers })} />
            <SwitchField label="Bank / UPI payment details" checked={settings.paymentDetails} onChange={(paymentDetails) => onChange({ paymentDetails })} />
            <SwitchField label="UPI QR code for the balance" checked={settings.upiQr} onChange={(upiQr) => onChange({ upiQr })} />
          </Stack>
        </Grid>
        <Grid size={12}>
          <TextAreaField label="Footer lines (up to 3)" value={footer} onChange={onFooterChange} />
        </Grid>
      </Grid>
    </CollapsibleCard>
  );
}
