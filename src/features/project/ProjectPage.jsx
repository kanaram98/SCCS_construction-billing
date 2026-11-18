import { PageHeading } from '../../components/ui';
import { tr as t } from '../../i18n/translate.js';
import BillDetailsCard from './BillDetailsCard.jsx';

/** The open bill: its project and client, number, date and level names. */
export default function ProjectPage({ onNavigate }) {
  return (
    <section>
      <PageHeading title={t('Bill details')} description={t('Which project this bill is for.')} />
      <BillDetailsCard onNavigate={onNavigate} />
    </section>
  );
}
