import { Button, CollapsibleCard } from '../../components/ui';
import { getPrintDocument } from '../../domain/print-settings.js';

/** Choose which documents to export and reorder them. */
export default function DocumentSelection({ settings, selectedCount, onToggle, onMove }) {
  const { documentOrder } = settings;
  return (
    <CollapsibleCard className="no-print print-settings-group" title="Documents in the PDF" meta={`${selectedCount} selected`} defaultOpen>
      <p>Use the arrows to choose the order of documents in your export.</p>
      <div className="print-document-list">
        {documentOrder.map((documentId, index) => {
          const { label } = getPrintDocument(documentId);
          return (
            <div className="print-document-option" key={documentId}>
              <label className="check-option">
                <input type="checkbox" checked={settings.documents[documentId]} onChange={() => onToggle(documentId)} />
                {label}
              </label>
              <div>
                <Button size="compact" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(documentId, -1)}>↑</Button>
                <Button size="compact" aria-label={`Move ${label} down`} disabled={index === documentOrder.length - 1} onClick={() => onMove(documentId, 1)}>↓</Button>
              </div>
            </div>
          );
        })}
      </div>
    </CollapsibleCard>
  );
}
