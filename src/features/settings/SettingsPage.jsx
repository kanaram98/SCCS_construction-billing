import { PageHeading } from '../../components/ui';
import { tr as t } from '../../i18n/translate.js';
import AppPreferencesCard from './AppPreferencesCard.jsx';
import RatesPage from '../rates/RatesPage.jsx';
import PaymentDetailsCard from '../project/PaymentDetailsCard.jsx';
import BackupCard from '../backup/BackupCard.jsx';

/** Things set up once: work-item rates, bank/UPI details, backup and app preferences. */
export default function SettingsPage() {
  return (
    <section>
      <PageHeading title={t('Settings')} description={t('Rates, payment details, backup and app preferences.')} />
      <RatesPage embedded />
      <PaymentDetailsCard />
      <BackupCard />
      <AppPreferencesCard />
    </section>
  );
}
