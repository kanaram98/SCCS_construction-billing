import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import MuiCard from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

/** Page title with optional description and an action on the right. */
export function PageHeading({ title, eyebrow, description, action }) {
  return (
    <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
      <Box sx={{ minWidth: 0 }}>
        {eyebrow && <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650 }} noWrap component="div">{eyebrow}</Typography>}
        <Typography variant="h5" component="h1">{title}</Typography>
        {description && <Typography variant="body2" color="text.secondary">{description}</Typography>}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Stack>
  );
}

export function Card({ title, description, action, className, children, sx }) {
  return (
    <MuiCard className={className} sx={{ mb: 2, ...sx }}>
      <CardContent sx={{ '&:last-child': { pb: 2 } }}>
        {(title || action) && (
          <Stack direction="row" sx={{ mb: description ? 0.5 : 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
            {title && <Typography variant="h6" component="h2">{title}</Typography>}
            {action}
          </Stack>
        )}
        {description && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{description}</Typography>}
        {children}
      </CardContent>
    </MuiCard>
  );
}

/** Expandable settings card. */
export function CollapsibleCard({ title, meta, defaultOpen = false, className, children }) {
  return (
    <Accordion defaultExpanded={defaultOpen} className={className} sx={{ mb: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" sx={{ width: '100%', pr: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1">{title}</Typography>
          {meta && <Typography variant="caption" color="text.secondary">{meta}</Typography>}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}

export function StatCard({ label, value }) {
  return (
    <MuiCard sx={{ height: '100%' }}>
      <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Typography variant="h6" color="primary" sx={{ mt: 0.5 }} noWrap>{value}</Typography>
      </CardContent>
    </MuiCard>
  );
}
