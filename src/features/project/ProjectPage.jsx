import { PageHeading } from '../../components/ui';
import BillDetailsCard from './BillDetailsCard.jsx';
import AmountsCard from './AmountsCard.jsx';
import FirmCard from './FirmCard.jsx';

export default function ProjectPage() {
  return (
    <section>
      <PageHeading title="Project" description="Bill, client, amounts and your firm details." />
      <BillDetailsCard />
      <AmountsCard />
      <FirmCard />
    </section>
  );
}
