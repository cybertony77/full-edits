import { createPortal } from 'react-dom';
import styles from './ImportExistingOnlineItemModal.module.css';

/** Full-page loader (same visual as homework import overlay). */
export default function MarketingPageLoader({ label = 'Loading', sub = 'Please wait…' }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.overlay}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className={styles.card}>
        <div className={styles.spinnerWrap} aria-hidden>
          <div className={styles.spinner} />
          <div className={styles.spinnerInner} />
        </div>
        <p className={styles.label}>
          <span className={styles.loadingText}>
            {label}
            <span className={styles.ellipsis} aria-hidden>
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </span>
        </p>
        {sub ? <p className={styles.sub}>{sub}</p> : null}
      </div>
    </div>,
    document.body
  );
}
