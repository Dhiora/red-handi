import './feedback.css';

export function BrandMark({celebrating = false}) {
  return (
    <div className={`rh-brand-scene${celebrating ? ' rh-brand-scene--celebrating' : ''}`} aria-hidden="true">
      <div className="rh-brand-ring" />
      <div className="rh-brand-ring-track" />
      <img className="rh-brand-logo" src="/logo.png" alt="" />
    </div>
  );
}

export default function BrandLoader({visible = true, message = 'Good things take a little dum.'}) {
  if (!visible) return null;
  return (
    <div className="rh-loader" role="status" aria-live="polite" aria-label="Loading RedHandi">
      <div className="rh-loader-card">
        <span className="rh-feedback-eyebrow">FRESH FROM THE HANDI</span>
        <BrandMark />
        <h2>{message}</h2>
        <p>Your next craving is almost here.</p>
        <div className="rh-loading-rail" aria-hidden="true"><span /></div><span className="rh-loader-caption">SLOW COOKED. WHOLEHEARTED.</span>
      </div>
    </div>
  );
}
