import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import App from '../../src/App.jsx';
import theme from '../../src/theme.js';
import { STORAGE_KEYS } from '../../src/config/app.js';

/** A bill with two floors and three entries; total ₹13,895 after 18% GST, ₹100 discount and ₹5,000 advance. */
export const SAMPLE_STATE = {
  bills: [{
    id: 'b1', number: '1', date: '2026-11-01', projectName: 'Lake View Villa', client: 'Sample Client',
    firstLevelName: 'Floor', secondLevelName: 'Room', discount: '100', taxRate: '18', advance: '5000', footer: '',
    sections: [
      { id: 's1', name: 'Ground floor', areas: [
        { id: 'a1', name: 'Hall', items: [
          { id: 'i1', rateId: 'floor-tiles', name: 'Floor tiles', unit: 'sqft', type: 'area', rate: 85, count: 1, length: '12.6', width: '10.0', note: '' },
          { id: 'i2', rateId: 'skirting', name: 'Skirting', unit: 'rft', type: 'length', rate: 30, count: 2, length: '12.6', note: '' }
        ] },
        { id: 'a2', name: 'Kitchen', items: [
          { id: 'i3', rateId: 'gas-hole', name: 'Gas hole', unit: 'nos', type: 'count', rate: 250, count: 2, note: '' }
        ] }
      ] },
      { id: 's2', name: 'First floor', areas: [] }
    ]
  }, { id: 'b2', number: '2', date: '2026-10-01', projectName: 'Office fitout', client: 'Other Co', sections: [] }],
  activeBillId: 'b1',
  firm: { name: 'Acme Interiors' },
  // The starter rates are the firm's own quotation; these tests use a small made-up price list.
  rates: [
    { id: 'floor-tiles', name: 'Floor tiles', unit: 'sqft', type: 'area', rate: 85 },
    { id: 'skirting', name: 'Skirting', unit: 'rft', type: 'length', rate: 30 },
    { id: 'gas-hole', name: 'Gas hole', unit: 'nos', type: 'count', rate: 250 }
  ]
};

/** Renders the whole app, optionally with saved data, and returns a user-event instance. */
export function renderApp(savedState) {
  if (savedState) window.localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(savedState));
  const user = userEvent.setup();
  const result = render(<ThemeProvider theme={theme}><App /></ThemeProvider>);
  return { user, ...result };
}

/** Reads the saved app state from localStorage. */
export function savedState() {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEYS.state));
}
