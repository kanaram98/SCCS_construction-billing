import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useBilling } from '../../state/BillingContext.jsx';
import { useIsPhone } from '../../hooks/useIsMobile.js';
import { VIEWS } from '../../config/app.js';
import { LANGUAGES, getLanguage, tr as t } from '../../i18n/translate.js';

const STEPS = [
  ['Add a floor', 'e.g. Ground floor, First floor'],
  ['Add rooms', 'e.g. Hall, Kitchen, Bedroom'],
  ['Add measurements', 'Type 15.4 for 15 ft 4 in. Totals and the PDF bill are made for you.']
];

/** First-run welcome: pick a language, learn the 3 steps, then start or look at a sample. */
export default function WelcomeDialog({ onNavigate }) {
  const { actions } = useBilling();
  const fullScreen = useIsPhone();

  function finish(withSample) {
    if (withSample) actions.bills.addSample();
    actions.data.setOnboarded(true);
    onNavigate(VIEWS.entry);
  }

  return (
    <Dialog open fullScreen={fullScreen} maxWidth="xs" fullWidth className="no-print" aria-labelledby="welcome-title">
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 4 }}>
        <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
          <Avatar variant="rounded" sx={{ bgcolor: 'primary.main', width: 56, height: 56, fontSize: 28, fontWeight: 800 }}>₹</Avatar>
          <Typography id="welcome-title" variant="h5">{t('Welcome to Construction Billing')}</Typography>
          <Typography color="text.secondary">{t('Make measurement bills on your phone, in feet and inches.')}</Typography>
        </Stack>

        <ToggleButtonGroup
          exclusive
          fullWidth
          color="primary"
          value={getLanguage()}
          onChange={(_event, language) => language && actions.preferences.setLanguage(language)}
          aria-label="Language"
        >
          {Object.entries(LANGUAGES).map(([value, label]) => (
            <ToggleButton key={value} value={value} sx={{ py: 1.25, fontSize: 16, textTransform: 'none' }}>{label}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack spacing={2}>
          {STEPS.map(([title, detail], index) => (
            <Stack key={title} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', color: 'secondary.contrastText', fontWeight: 700, fontSize: 16 }}>
                {index + 1}
              </Avatar>
              <div>
                <Typography variant="subtitle1">{t(title)}</Typography>
                <Typography variant="body2" color="text.secondary">{t(detail)}</Typography>
              </div>
            </Stack>
          ))}
        </Stack>

        <Stack spacing={1.25} sx={{ mt: 'auto' }}>
          <Button size="large" variant="contained" onClick={() => finish(false)}>{t('Start my first bill')}</Button>
          <Button size="large" variant="outlined" onClick={() => finish(true)}>{t('See a sample bill')}</Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
