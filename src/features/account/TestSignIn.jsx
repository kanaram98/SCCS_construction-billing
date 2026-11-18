import { useState } from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { TextField } from '../../components/ui';
import { useCloud } from './CloudProvider.jsx';

const FILL = [
  { label: 'Fill admin', email: 'admin.test@example.com' },
  { label: 'Fill contractor', email: 'contractor.test@example.com' }
];
const TEST_PASSWORD = import.meta.env?.VITE_TEST_PASSWORD || '';

/** Test copy only: sign in with a fake email and password (the real app has Google sign-in only). Not translated on purpose. */
export default function TestSignIn() {
  const cloud = useCloud();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <form onSubmit={(event) => { event.preventDefault(); cloud.signInWithPassword(email.trim(), password); }}>
      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Test accounts</Typography>
      {TEST_PASSWORD && (
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          {FILL.map((account) => (
            <Button key={account.email} size="small" variant="outlined" onClick={() => { setEmail(account.email); setPassword(TEST_PASSWORD); }}>{account.label}</Button>
          ))}
        </Stack>
      )}
      <Stack spacing={1.5}>
        <TextField label="Test email" type="email" value={email} onChange={setEmail} />
        <TextField label="Test password" type="password" value={password} onChange={setPassword} />
        <Button type="submit" variant="outlined" disabled={!email || !password}>Sign in with test account</Button>
      </Stack>
    </form>
  );
}
