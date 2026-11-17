import { useState } from 'react';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card, ImageUploadField, TextField } from '../../components/ui';
import { getRequiredDetailErrors } from '../../domain/validation.js';
import { optimizeImage } from '../../services/image.js';

const IMAGE_LABELS = { logo: 'Firm logo', signature: 'Signature' };

export default function FirmCard() {
  const { data, bill, actions } = useBilling();
  const { firm } = data;
  const [imageMessage, setImageMessage] = useState('');
  const update = actions.firm.update;
  const nameError = getRequiredDetailErrors(bill, firm).firmName;

  async function uploadImage(field, file) {
    setImageMessage('');
    try {
      update({ [field]: await optimizeImage(file) });
      setImageMessage(`${IMAGE_LABELS[field]} saved on this device.`);
    } catch (error) {
      console.error(`Could not save firm ${field}.`, error);
      setImageMessage(error.message || `Could not save firm ${field}.`);
    }
  }

  return (
    <Card title="Your firm" description="Saved on this device and reused on every bill and PDF.">
      <div className="form-grid">
        <TextField label="Firm name" required value={firm.name} error={nameError} onChange={(name) => update({ name })} />
        <TextField label="Address" value={firm.address} onChange={(address) => update({ address })} />
        <TextField label="Phone" value={firm.phone} onChange={(phone) => update({ phone })} />
        <TextField label="GSTIN" value={firm.gstin} onChange={(gstin) => update({ gstin })} />
      </div>
      <div className="firm-assets-grid">
        {Object.entries(IMAGE_LABELS).map(([field, label]) => (
          <ImageUploadField
            key={field}
            label={label}
            variant={field === 'signature' ? 'signature' : 'default'}
            value={firm[field]}
            onSelect={(file) => uploadImage(field, file)}
            onRemove={() => update({ [field]: '' })}
          />
        ))}
      </div>
      {imageMessage && <p className="asset-message" role="status">{imageMessage}</p>}
    </Card>
  );
}
