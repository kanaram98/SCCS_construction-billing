import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import AssessmentIcon from '@mui/icons-material/AssessmentOutlined';
import CloseIcon from '@mui/icons-material/Close';
import EngineeringIcon from '@mui/icons-material/EngineeringOutlined';
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import StraightenIcon from '@mui/icons-material/Straighten';
import { APP_MARK, DEFAULT_BRANDING } from '../../config/brand.js';
import { useBilling } from '../../state/BillingContext.jsx';
import { useIsPhone } from '../../hooks/useIsMobile.js';
import { VIEWS } from '../../config/app.js';
import { LANGUAGES, getLanguage, tr as t } from '../../i18n/translate.js';

const FEATURES = [
  { icon: <StraightenIcon />, title: 'Measurement bills', detail: 'Type 15.4 for 15 ft 4 in. Totals and the PDF bill are made for you.' },
  { icon: <EngineeringIcon />, title: 'Labour', detail: 'Daily attendance, wages and payments for every worker.' },
  { icon: <PaymentsIcon />, title: 'Site expenses', detail: 'Write down each day’s expenses for every project.' },
  { icon: <AssessmentIcon />, title: 'Project reports', detail: 'Billed, received, expenses and labour cost in one statement.' }
];

/** First-run welcome after sign-in: firm header, language, what the app does. Close it, or start a bill / see a sample. */
export default function WelcomeDialog({ onNavigate }) {
  const { data, actions } = useBilling();
  const fullScreen = useIsPhone();
  const firmName = data.firm?.name || DEFAULT_BRANDING.name;

  function close() {
    actions.data.setOnboarded(true);
  }

  function finish(withSample) {
    if (withSample) actions.bills.addSample();
    actions.data.setOnboarded(true);
    onNavigate(withSample ? VIEWS.entry : VIEWS.bills, withSample ? undefined : { newBill: 'bill' });
  }

  return (
    <Dialog open fullScreen={fullScreen} maxWidth="xs" fullWidth className="no-print" aria-labelledby="welcome-title" onClose={close}>
      <Box sx={{ position: 'relative', px: 3, pt: 4, pb: 3, textAlign: 'center', color: '#fff', background: `linear-gradient(135deg, ${DEFAULT_BRANDING.colors.orange} 0%, ${DEFAULT_BRANDING.colors.amber} 100%)` }}>
        <IconButton aria-label={t('Close')} onClick={close} sx={{ position: 'absolute', top: 8, right: 8, color: '#fff' }}><CloseIcon /></IconButton>
        <Box sx={{ width: 72, height: 72, mx: 'auto', mb: 1.5, borderRadius: 3, bgcolor: '#fff', display: 'grid', placeItems: 'center', boxShadow: 2 }}>
          <Box component="img" src={APP_MARK} alt="" sx={{ height: 52, width: 29, objectFit: 'contain' }} />
        </Box>
        <Typography id="welcome-title" variant="h5" sx={{ fontWeight: 800 }}>{t('Welcome to Construction Billing')}</Typography>
        <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.95 }}>{firmName}</Typography>
      </Box>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, py: 3 }}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          color="primary"
          size="small"
          value={getLanguage()}
          onChange={(_event, language) => language && actions.preferences.setLanguage(language)}
          aria-label="Language"
        >
          {Object.entries(LANGUAGES).map(([value, label]) => (
            <ToggleButton key={value} value={value} sx={{ py: 1, fontSize: 15, textTransform: 'none' }}>{label}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack spacing={1.75}>
          {FEATURES.map((feature) => (
            <Stack key={feature.title} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'action.hover', color: 'primary.main' }}>{feature.icon}</Box>
              <div>
                <Typography variant="subtitle2">{t(feature.title)}</Typography>
                <Typography variant="body2" color="text.secondary">{t(feature.detail)}</Typography>
              </div>
            </Stack>
          ))}
        </Stack>

        <Stack spacing={1.25} sx={{ mt: 'auto' }}>
          <Button size="large" variant="contained" onClick={() => finish(false)}>{t('Start my first bill')}</Button>
          <Button size="large" variant="outlined" onClick={() => finish(true)}>{t('See a sample bill')}</Button>
          <Button color="inherit" onClick={close}>{t('Maybe later')}</Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
