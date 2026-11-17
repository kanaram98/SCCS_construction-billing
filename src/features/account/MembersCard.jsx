import { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import PersonAddIcon from '@mui/icons-material/PersonAddAlt';
import PersonRemoveIcon from '@mui/icons-material/PersonRemoveOutlined';
import { Card, SelectField, TextField, useConfirm, useNotify } from '../../components/ui';
import { cloudConfig } from '../../backend/config.js';
import { ROLES } from '../../domain/permissions.js';
import { tr as t } from '../../i18n/translate.js';
import { useCloud } from './CloudProvider.jsx';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Admin: who is in the workspace, invite a Google account, remove someone. */
export default function MembersCard() {
  const cloud = useCloud();
  const notify = useNotify();
  const confirm = useConfirm();
  const [invites, setInvites] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('contractor');
  const [submitted, setSubmitted] = useState(false);
  const isAdmin = cloud.role === 'admin' && cloud.can('manageMembers');
  const firebase = cloud.firebase;

  useEffect(() => {
    if (!isAdmin || !firebase) return;
    cloud.refreshMembers();
    import('../../backend/session.js')
      .then(({ listInvites }) => listInvites({ db: firebase.db, fs: firebase.fs }, cloudConfig.workspaceId))
      .then(setInvites)
      .catch(() => setInvites([]));
  }, [isAdmin, firebase]);

  if (!isAdmin || !firebase) return null;
  const cloudArgs = { db: firebase.db, fs: firebase.fs };
  const session = () => import('../../backend/session.js');
  const emailError = submitted && !EMAIL_PATTERN.test(email.trim()) ? t('Enter a Gmail address, e.g. name@gmail.com.') : '';

  async function invite(event) {
    event.preventDefault();
    setSubmitted(true);
    if (!EMAIL_PATTERN.test(email.trim())) return;
    try {
      const { inviteMember, listInvites } = await session();
      await inviteMember(cloudArgs, cloudConfig.workspaceId, { email, role, invitedBy: cloud.user.uid });
      setInvites(await listInvites(cloudArgs, cloudConfig.workspaceId));
      notify(t('Invited {email}. They join the first time they sign in with that Google account.', { email: email.trim().toLowerCase() }), 'success');
      setEmail('');
      setSubmitted(false);
    } catch (error) {
      notify(t('Could not invite: {reason}', { reason: error.code || error.message }), 'error');
    }
  }

  async function remove(member) {
    const ok = await confirm({
      title: t('Remove {name}?', { name: member.name }),
      message: t('They lose access to the workspace at once. Data on their phone stays there but no longer syncs.'),
      confirmLabel: t('Remove'),
      danger: true
    });
    if (!ok) return;
    const { removeMember } = await session();
    await removeMember(cloudArgs, cloudConfig.workspaceId, member.uid);
    cloud.refreshMembers();
  }

  async function cancel(entry) {
    const { cancelInvite, listInvites } = await session();
    await cancelInvite(cloudArgs, cloudConfig.workspaceId, entry.email);
    setInvites(await listInvites(cloudArgs, cloudConfig.workspaceId));
  }

  return (
    <Card title={t('People')} description={t('Who can use this workspace. Contractors do all daily work; only the admin manages people, firm details and permanent deletes.')}>
      <List dense disablePadding>
        {cloud.members.map((member) => (
          <ListItem
            key={member.uid}
            disableGutters
            secondaryAction={member.uid !== cloud.user.uid && (
              <IconButton aria-label={t('Remove {name}', { name: member.name })} onClick={() => remove(member)}><PersonRemoveIcon /></IconButton>
            )}
          >
            <ListItemText primary={member.name} secondary={member.email} />
            <Chip size="small" label={t(ROLES[member.role] || member.role)} sx={{ mr: member.uid !== cloud.user.uid ? 5 : 0 }} />
          </ListItem>
        ))}
        {invites.map((entry) => (
          <ListItem key={entry.email} disableGutters secondaryAction={<Button size="small" onClick={() => cancel(entry)}>{t('Cancel')}</Button>}>
            <ListItemText primary={entry.email} secondary={t('Invited as {role} · not joined yet', { role: t(ROLES[entry.role]) })} />
          </ListItem>
        ))}
      </List>
      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>{t('Invite someone')}</Typography>
      <Grid container spacing={1.5} component="form" onSubmit={invite} noValidate>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label={t('Google account (Gmail)')} type="email" value={email} error={emailError} onChange={setEmail} />
        </Grid>
        <Grid size={{ xs: 7, sm: 3 }}>
          <SelectField label={t('Role')} value={role} options={ROLES} onChange={setRole} />
        </Grid>
        <Grid size={{ xs: 5, sm: 3 }} sx={{ display: 'flex', alignItems: 'center' }}>
          <Button type="submit" variant="contained" startIcon={<PersonAddIcon />} fullWidth>{t('Invite')}</Button>
        </Grid>
      </Grid>
    </Card>
  );
}
