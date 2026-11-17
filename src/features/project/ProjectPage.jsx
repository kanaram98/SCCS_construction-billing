import { PageHeading } from '../../components/ui';
import BackupCard from '../backup/BackupCard.jsx';
import BillDetailsCard from './BillDetailsCard.jsx';
import AmountsCard from './AmountsCard.jsx';
import FirmCard from './FirmCard.jsx';
import PaymentDetailsCard from './PaymentDetailsCard.jsx';

export default function ProjectPage() {
  return (
    <section>
      <PageHeading title="Project" description="Bill, client, amounts and your firm details." />
      <BillDetailsCard />
      <AmountsCard />
      <FirmCard />
      <PaymentDetailsCard />
      <BackupCard />
    </section>
  );
}
