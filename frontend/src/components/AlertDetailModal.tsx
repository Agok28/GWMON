import { useEffect, useState } from 'react';
import type { AlertDetail } from '../types/alerts';
import { fetchAlertById } from '../api/alerts';
import SeverityBadge from './SeverityBadge';

interface AlertDetailModalProps {
  alertId: number | null;
  onClose: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default function AlertDetailModal({ alertId, onClose }: AlertDetailModalProps) {
  const [detail, setDetail] = useState<AlertDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (alertId === null) {
      setDetail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAlertById(alertId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load alert');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [alertId]);

  useEffect(() => {
    if (alertId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [alertId, onClose]);

  if (alertId === null) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            Alert #{alertId}
            {detail && <SeverityBadge severity={detail.severity} />}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {loading && <div className="modal-state">Loading alert…</div>}
          {error && <div className="error-banner">{error}</div>}

          {detail && !loading && (
            <>
              <div className="modal-meta">
                <div className="meta-row">
                  <span className="meta-label">Time</span>
                  <span className="meta-value time-cell">{formatTime(detail.timestamp)}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Signature</span>
                  <span className="meta-value">
                    {detail.signature ?? '—'}
                    {detail.signature_id != null && (
                      <span className="meta-sub"> (SID {detail.signature_id})</span>
                    )}
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Category</span>
                  <span className="meta-value">{detail.category ?? '—'}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Source</span>
                  <span className="meta-value ip-cell">
                    {detail.src_ip ?? '—'}
                    {detail.src_port != null && `:${detail.src_port}`}
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Destination</span>
                  <span className="meta-value ip-cell">
                    {detail.dest_ip ?? '—'}
                    {detail.dest_port != null && `:${detail.dest_port}`}
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Protocol</span>
                  <span className="meta-value">{detail.proto ?? '—'}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Action</span>
                  <span className="meta-value">{detail.action ?? '—'}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Direction</span>
                  <span className="meta-value">{detail.direction ?? '—'}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Interface</span>
                  <span className="meta-value">{detail.in_iface ?? '—'}</span>
                </div>
                {detail.flow_id != null && (
                  <div className="meta-row">
                    <span className="meta-label">Flow ID</span>
                    <span className="meta-value">{detail.flow_id}</span>
                  </div>
                )}
              </div>

              <div className="modal-section-title">Raw event</div>
              <pre className="json-viewer">
                {JSON.stringify(detail.raw ?? {}, null, 2)}
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
