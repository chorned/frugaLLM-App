import React, { useState, useEffect } from 'react';
import { submitIssueReport, getDiagnosticData } from '../services/tauri';
import { Bug, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import en from '../locales/en.json';

interface IssueReporterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DiagnosticPayload {
  app_version: string;
  os_info: string;
  logs: string;
}

export const IssueReporterModal: React.FC<IssueReporterModalProps> = ({
  isOpen,
  onClose,
}) => {
  const strings = en.issueReporter;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<DiagnosticPayload | null>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setEmail('');
      setIncludeDiagnostics(true);
      setShowPreview(false);
      setSubmitStatus('idle');
      setErrorMessage(null);
      setIsLoadingDiagnostics(true);

      getDiagnosticData()
        .then((data: any) => {
          setDiagnosticData(data);
        })
        .catch((err: any) => {
          console.warn('Failed to retrieve diagnostic data from Tauri IPC:', err);
          setDiagnosticData({
            app_version: 'unknown',
            os_info: 'unknown',
            logs: 'Diagnostic logs could not be retrieved.',
          });
        })
        .finally(() => {
          setIsLoadingDiagnostics(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      setErrorMessage(strings.feedback.validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const accessKey =
        (typeof process !== 'undefined' && (process as any).env?.VITE_WEB3FORMS_ACCESS_KEY !== undefined)
          ? (process as any).env?.VITE_WEB3FORMS_ACCESS_KEY
          : ((import.meta as any).env?.VITE_WEB3FORMS_ACCESS_KEY || '4864c240-bf9b-40cf-82b3-e24c1766a559');

      if (!accessKey || accessKey === 'YOUR_ACCESS_KEY_HERE') {
        throw new Error(strings.feedback.missingKeyError);
      }

      const diagnosticSection =
        includeDiagnostics && diagnosticData
          ? `\n\n--- System Diagnostics ---\nApp Version: ${diagnosticData.app_version}\nOS: ${diagnosticData.os_info}\n\nSanitized Logs:\n${diagnosticData.logs}`
          : '';

      const fullMessage = `${description.trim()}${diagnosticSection}`;

      const payload = {
        access_key: accessKey,
        subject: `[FrugaLLM Issue] ${title.trim()}`,
        from_name: email.trim() ? email.split('@')[0] : 'FrugaLLM User',
        email: email.trim() || 'noreply@frugallm.internal',
        message: fullMessage,
      };

      await submitIssueReport(payload);

      setSubmitStatus('success');
    } catch (err: any) {
      console.error('Failed to submit issue report:', err);
      setSubmitStatus('error');
      setErrorMessage(typeof err === 'string' ? err : err?.message || strings.feedback.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-modal-title"
      data-testid="issue-reporter-modal"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--zen-surface)',
          border: '1px solid var(--zen-border)',
          borderRadius: '24px',
          padding: '26px',
          boxShadow: 'var(--zen-shadow-modal)',
          color: 'var(--zen-text)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          fontFamily: 'inherit',
          animation: 'fadeIn 0.15s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.24)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#EF4444',
            }}
          >
            <Bug size={20} />
          </div>
          <div>
            <h3
              id="issue-modal-title"
              style={{
                margin: 0,
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--zen-text)',
              }}
            >
              {strings.title}
            </h3>
            <p
              style={{
                margin: '2px 0 0 0',
                fontSize: '0.78rem',
                color: 'var(--zen-text-secondary)',
                lineHeight: 1.3,
              }}
            >
              {strings.subtitle}
            </p>
          </div>
        </div>

        {submitStatus === 'success' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '14px',
              padding: '24px 12px',
            }}
          >
            <CheckCircle2 size={44} color="#10B981" />
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              {strings.feedback.successTitle}
            </h4>
            <p
              style={{
                margin: 0,
                fontSize: '0.85rem',
                color: 'var(--zen-text-secondary)',
                lineHeight: 1.4,
              }}
            >
              {strings.feedback.successMessage}
            </p>
            <button
              onClick={onClose}
              data-testid="close-issue-button"
              className="btn-cta btn-cta-primary"
              style={{
                marginTop: '12px',
                padding: '10px 24px',
                borderRadius: '9999px',
                backgroundColor: 'var(--zen-accent)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {strings.buttons.close}
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
          >
            {errorMessage && (
              <div
                role="alert"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#EF4444',
                  fontSize: '0.8rem',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="issue-title"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--zen-text-secondary)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {strings.fields.title.label} *
              </label>
              <input
                id="issue-title"
                aria-label={strings.fields.title.label}
                data-testid="issue-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={strings.fields.title.placeholder}
                disabled={isSubmitting}
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--zen-surface-hover)',
                  border: '1px solid var(--zen-border)',
                  color: 'var(--zen-text)',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="issue-description"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--zen-text-secondary)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {strings.fields.description.label} *
              </label>
              <textarea
                id="issue-description"
                aria-label={strings.fields.description.label}
                data-testid="issue-description-input"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={strings.fields.description.placeholder}
                disabled={isSubmitting}
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--zen-surface-hover)',
                  border: '1px solid var(--zen-border)',
                  color: 'var(--zen-text)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Contact Email (Optional) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="issue-email"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--zen-text-secondary)',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {strings.fields.email.label}
              </label>
              <input
                id="issue-email"
                aria-label={strings.fields.email.label}
                data-testid="issue-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={strings.fields.email.placeholder}
                disabled={isSubmitting}
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--zen-surface-hover)',
                  border: '1px solid var(--zen-border)',
                  color: 'var(--zen-text)',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Include Diagnostics Checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                id="include-diagnostics-checkbox"
                data-testid="include-diagnostics-checkbox"
                type="checkbox"
                checked={includeDiagnostics}
                onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                disabled={isSubmitting}
                style={{
                  cursor: 'pointer',
                  width: '16px',
                  height: '16px',
                  accentColor: 'var(--zen-accent)',
                }}
              />
              <label
                htmlFor="include-diagnostics-checkbox"
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--zen-text)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                {strings.fields.includeDiagnostics.label}
              </label>
            </div>

            {/* Collapsible Diagnostics Preview */}
            {includeDiagnostics && (
              <div
                style={{
                  backgroundColor: 'var(--zen-surface-hover)',
                  border: '1px solid var(--zen-border)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  data-testid="toggle-diagnostics-preview"
                  onClick={() => setShowPreview(!showPreview)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--zen-text)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span>
                    {showPreview
                      ? strings.diagnostics.hideToggle
                      : strings.diagnostics.previewToggle}
                  </span>
                  {showPreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showPreview && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderTop: '1px solid var(--zen-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      fontSize: '0.75rem',
                      color: 'var(--zen-text-secondary)',
                    }}
                  >
                    {isLoadingDiagnostics ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: 'var(--zen-text-secondary)',
                        }}
                      >
                        <Loader2 size={14} className="spin" />
                        <span>{strings.diagnostics.loading}</span>
                      </div>
                    ) : diagnosticData ? (
                      <>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <strong style={{ color: 'var(--zen-text)' }}>
                            {strings.diagnostics.appVersion}:
                          </strong>
                          <span>{diagnosticData.app_version}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <strong style={{ color: 'var(--zen-text)' }}>
                            {strings.diagnostics.os}:
                          </strong>
                          <span>{diagnosticData.os_info}</span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            marginTop: '4px',
                          }}
                        >
                          <strong style={{ color: 'var(--zen-text)' }}>
                            {strings.diagnostics.logs}:
                          </strong>
                          <pre
                            style={{
                              margin: 0,
                              padding: '10px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(0, 0, 0, 0.25)',
                              color: 'var(--zen-text)',
                              fontSize: '0.7rem',
                              lineHeight: 1.4,
                              maxHeight: '140px',
                              overflowY: 'auto',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              fontFamily: 'monospace',
                            }}
                          >
                            {diagnosticData.logs}
                          </pre>
                        </div>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--zen-text-secondary)',
                            fontStyle: 'italic',
                          }}
                        >
                          {strings.diagnostics.sanitizedNotice}
                        </span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '10px',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                data-testid="cancel-issue-button"
                className="btn-cta btn-cta-secondary"
                style={{
                  padding: '10px 18px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--zen-surface-hover)',
                  color: 'var(--zen-text)',
                  border: '1px solid var(--zen-border)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {strings.buttons.cancel}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                data-testid="submit-issue-button"
                className="btn-cta btn-cta-primary"
                style={{
                  padding: '10px 22px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--zen-accent)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isSubmitting && <Loader2 size={14} className="spin" />}
                <span>
                  {isSubmitting
                    ? strings.buttons.submitting
                    : strings.buttons.submit}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
