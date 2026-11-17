import { TextButton } from '../../components/ui';
import { formatCurrency } from '../../domain/formatters.js';
import { getItemQuantity, getLineAmount } from '../../domain/calculations.js';
import { describeMeasurement, resolveRate } from '../../domain/rates.js';
import CopyToSectionSelect from './CopyToSectionSelect.jsx';

/** Entries in one area. Collapses into cards on small screens via CSS `data-label`s. */
export default function EntryTable({ items, rates, sections, sectionId, onEdit, onDelete, onCopy }) {
  return (
    <div className="entry-table-wrap">
      <table className="entry-table">
        <thead>
          <tr>
            <th scope="col">Work item</th>
            <th scope="col">Measurement</th>
            <th scope="col">Quantity</th>
            <th scope="col">Rate</th>
            <th scope="col">Amount</th>
            <th scope="col"><span className="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const rate = resolveRate(item, rates);
            return (
              <tr key={item.id}>
                <td className="entry-item-cell" data-label="Work item">
                  <strong>{rate.name}</strong>
                  {item.note && <small>{item.note}</small>}
                </td>
                <td className="entry-measurement-cell" data-label="Measurement">{describeMeasurement(item, rate)}</td>
                <td className="entry-quantity-cell" data-label="Quantity">{getItemQuantity(item, rate)} {rate.unit}</td>
                <td className="entry-rate-cell" data-label="Rate">{formatCurrency(rate.rate)} / {rate.unit}</td>
                <td className="entry-amount-cell" data-label="Amount"><strong>{formatCurrency(getLineAmount(item, rate))}</strong></td>
                <td data-label="Actions" className="entry-table-actions">
                  <TextButton onClick={() => onEdit(item)}>Edit</TextButton>
                  <TextButton danger onClick={() => onDelete(item.id)}>Delete</TextButton>
                  <CopyToSectionSelect
                    className="copy-item-select"
                    label={`Copy ${rate.name} to section`}
                    placeholder="Copy entry to section…"
                    sections={sections}
                    currentSectionId={sectionId}
                    onSelect={(targetSectionId) => onCopy(item.id, targetSectionId)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
