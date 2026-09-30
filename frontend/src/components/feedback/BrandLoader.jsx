import './feedback.css';

export function BrandMark({celebrating = false}) {
  return (
    <div className={`rh-brand-scene${celebrating ? ' rh-brand-scene--celebrating' : ''}`} aria-hidden="true">
      <div className="rh-brand-halo" />
      <div className="rh-brand-orbit rh-brand-orbit--one" />
      <div className="rh-brand-orbit rh-brand-orbit--two" />
      <div className="rh-brand-model">
        <img className="rh-brand-depth" src="/logo.png" alt="" />
        <img className="rh-brand-face" src="/logo.png" alt="" />
      </div>
      <div className="rh-brand-shadow" />
    </div>
  );
}

export default function BrandLoader({visible = true, message = 'A little magic is cooking.'}) {
  if (!visible) return null;
  return (
    <div className="rh-loader" role="status" aria-live="polite" aria-label="Loading RedHandi">
      <div className="rh-loader-card">
        <span className="rh-feedback-eyebrow">THE REDHANDI EXPERIENCE</span>
        <BrandMark />
        <h2>{message}</h2>
        <p>Big flavour. Worth a little anticipation.</p>
        <div className="rh-loading-dots" aria-hidden="true"><i /><i /><i /></div>
      </div>
    </div>
  );
}
