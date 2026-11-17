import { PageHeading } from '../../components/ui';
import { tr as t } from '../../i18n/translate.js';
import BillDetailsCard from './BillDetailsCard.jsx';
import FirmCard from './FirmCard.jsx';

/** Who the bill is for and who it is from: bill & client details, and your firm. */
export default function ProjectPage() {
  return (
    <section>
      <PageHeading title={t('Project')} description={t('Client and firm details.')} />
      <BillDetailsCard />
      <FirmCard />
    </section>
  );
}
