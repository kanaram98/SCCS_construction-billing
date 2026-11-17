/**
 * One-shot select that copies something into another section.
 * It always shows the placeholder; choosing a section fires `onSelect(sectionId)`.
 */
export default function CopyToSectionSelect({ sections, currentSectionId, placeholder, label, className, onSelect }) {
  return (
    <select
      className={className}
      aria-label={label}
      value=""
      disabled={sections.length < 2}
      onChange={(event) => onSelect(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {sections.filter((section) => section.id !== currentSectionId).map((section) => (
        <option key={section.id} value={section.id}>{section.name}</option>
      ))}
    </select>
  );
}
