import BillDetailsCard from './BillDetailsCard.jsx';
import AmountsCard from './AmountsCard.jsx';
import FirmCard from './FirmCard.jsx';

export default function ProjectPage() {
  return (
    <section>
      <h1>Project and bill details</h1>
      <BillDetailsCard />
      <AmountsCard />
      <FirmCard />
    </section>
  );
}
