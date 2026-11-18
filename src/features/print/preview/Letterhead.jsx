/**
 * Letterhead shared by bills and quotations: logo and firm details, a brand
 * colour stripe, the document title with its number/date, and a "Bill to" block.
 * `t` translates into the document's language.
 */
export default function Letterhead({ firm, t, title, meta = [], billTo }) {
  const contact = [firm.phone && `☎ ${firm.phone}`, firm.gstRegistered && firm.gstin && t('GSTIN: {gstin}', { gstin: firm.gstin })].filter(Boolean);
  return (
    <div className="letterhead">
      <div className="lh-top">
        {firm.logo
          ? <img className="lh-logo" src={firm.logo} alt="" />
          : (
            <div>
              <div className="lh-name-only">{firm.name || t('Firm name')}</div>
              {firm.tagline && <div className="lh-tagline">{firm.tagline}</div>}
            </div>
          )}
        <div className="lh-firm">
          {firm.logo && firm.name && <div className="lh-firm-name">{firm.name}</div>}
          {firm.logo && firm.tagline && <div className="lh-tagline">{firm.tagline}</div>}
          {firm.address && <div>{firm.address}</div>}
          {contact.length > 0 && <div>{contact.join(' · ')}</div>}
        </div>
      </div>
      <div className="lh-stripe" />
      <div className="lh-title">
        <h3>{title}</h3>
        <div className="lh-meta">{meta.filter(Boolean).map((line) => <div key={line}>{line}</div>)}</div>
      </div>
      {billTo && billTo.lines.some(Boolean) && (
        <div className="lh-billto">
          <div className="lh-billto-label">{billTo.label}</div>
          {billTo.lines.filter(Boolean).map((line, index) => <div key={index} className={index === 0 ? 'lh-billto-name' : undefined}>{line}</div>)}
        </div>
      )}
    </div>
  );
}
