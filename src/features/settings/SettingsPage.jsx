import { PageHeading } from '../../components/ui';
import { tr as t } from '../../i18n/translate.js';
import AppPreferencesCard from './AppPreferencesCard.jsx';
import PaymentDetailsCard from '../project/PaymentDetailsCard.jsx';
import BackupCard from '../backup/BackupCard.jsx';
import HistoryCard from './HistoryCard.jsx';

/** Things set up once: work-item rates, bank/UPI details, backup and app preferences. */
export default function SettingsPage() {
  return (
    <section>
      <PageHeading title={t('Settings')} description={t('Payment details, history, backup and app preferences.')} />
      <PaymentDetailsCard />
      <HistoryCard />
      <BackupCard />
      <AppPreferencesCard />
    </section>
  );
}
