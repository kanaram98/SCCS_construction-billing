import { PageHeading } from '../../components/ui';
import { tr as t } from '../../i18n/translate.js';
import FirmCard from './FirmCard.jsx';
import AdminOnly from '../account/AdminOnly.jsx';

/** Your firm: name, address, GST, logo and signature, used on every bill and PDF. */
export default function FirmPage() {
  return (
    <section>
      <PageHeading title={t('Firm')} description={t('Your own business details.')} />
      <AdminOnly><FirmCard /></AdminOnly>
    </section>
  );
}
