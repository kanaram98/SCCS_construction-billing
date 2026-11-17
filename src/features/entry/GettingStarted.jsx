import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { tr as t } from '../../i18n/translate.js';

/** Three-step checklist shown on the Entry screen until the first entry exists. */
export default function GettingStarted({ counts, levelName, sublevelName }) {
  const steps = [
    { done: counts.sections > 0, label: t('Add {level}', { level: levelName }), hint: t('Tap the “+ {level}” button above.', { level: levelName }) },
    { done: counts.areas > 0, label: t('Add {level}', { level: sublevelName }), hint: t('Open the {level} and tap “Add {sublevel}”.', { level: levelName, sublevel: sublevelName }) },
    { done: counts.items > 0, label: t('Add an entry'), hint: t('Tap “Add entry” and type the measurements, e.g. 15.4 for 15 ft 4 in.') }
  ];
  const nextIndex = steps.findIndex((step) => !step.done);

  return (
    <Card sx={{ mb: 1.5, borderColor: 'secondary.main', borderWidth: 2 }}>
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>{t('Getting started')}</Typography>
        <Stack spacing={1}>
          {steps.map((step, index) => (
            <Stack key={step.label} direction="row" spacing={1.25} sx={{ alignItems: 'flex-start' }}>
              {step.done
                ? <CheckCircleIcon color="success" fontSize="small" sx={{ mt: 0.25 }} />
                : <RadioButtonUncheckedIcon color={index === nextIndex ? 'secondary' : 'disabled'} fontSize="small" sx={{ mt: 0.25 }} />}
              <div>
                <Typography variant="body2" sx={{ fontWeight: index === nextIndex ? 700 : 500, textDecoration: step.done ? 'line-through' : 'none', color: step.done ? 'text.secondary' : 'text.primary' }}>
                  {step.label}
                </Typography>
                {index === nextIndex && <Typography variant="caption" color="text.secondary">{step.hint}</Typography>}
              </div>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
