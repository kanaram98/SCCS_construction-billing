import Button from './Button.jsx';
import { IMAGE_UPLOAD } from '../../config/app.js';

/**
 * Image picker with preview and remove button. `onSelect` receives the chosen File.
 * @param {{ variant?: 'default'|'signature' }} props `signature` draws ruled lines behind the preview
 */
export default function ImageUploadField({ label, value, onSelect, onRemove, variant = 'default' }) {
  return (
    <div className="firm-image-field">
      <div className="firm-image-heading">
        <strong>{label}</strong>
        <small>PNG or JPG · up to 5 MB · resized for storage</small>
      </div>
      {value ? (
        <div className={`firm-image-preview ${variant === 'signature' ? 'signature-preview' : ''}`}>
          <img src={value} alt={`${label} preview`} />
        </div>
      ) : <div className="firm-image-placeholder">No image selected</div>}
      <div className="firm-image-actions">
        <label className="button file-button">
          {value ? 'Change image' : 'Choose image'}
          <input
            className="visually-hidden"
            type="file"
            accept={IMAGE_UPLOAD.acceptedTypes.join(',')}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onSelect(file);
            }}
          />
        </label>
        <Button variant="danger" disabled={!value} onClick={onRemove}>Remove</Button>
      </div>
    </div>
  );
}
