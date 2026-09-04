import React, { useEffect, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { checkForAppUpdates, UpdateCheckResult } from '../utils/updateChecker';
import en from '../locales/en.json';

export interface UpdateNotificationProps {
  owner?: string;
  repo?: string;
  className?: string;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  owner = 'chorned',
  repo = 'frugaLLM-App',
  className = '',
}) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);

  useEffect(() => {
    let isMounted = true;
    checkForAppUpdates(owner, repo).then((result) => {
      if (isMounted && result.hasUpdate) {
        setUpdateInfo(result);
      }
    }).catch((err) => {
      console.warn('[UpdateNotification] Check failed:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [owner, repo]);

  if (!updateInfo || !updateInfo.hasUpdate) {
    return null;
  }

  const latest = updateInfo.latestVersion || '';
  const current = updateInfo.currentVersion || '';
  const releaseUrl = updateInfo.htmlUrl || `https://github.com/${owner}/${repo}/releases/latest`;

  const badgeText = (en.updateNotification?.badgeText || 'Update v{{latestVersion}} available')
    .replace('{{latestVersion}}', latest);

  const fullText = (en.updateNotification?.updateAvailable || 'Update Available: FrugaLLM v{{latestVersion}} is out (you have v{{currentVersion}}).')
    .replace('{{latestVersion}}', latest)
    .replace('{{currentVersion}}', current);

  const handleOpenRelease = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await openUrl(releaseUrl);
    } catch (err) {
      console.warn('[UpdateNotification] Failed to open release in browser:', err);
    }
  };

  return (
    <div
      data-testid="update-notification"
      className={className}
      title={fullText}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginRight: '10px',
      }}
    >
      <button
        type="button"
        data-testid="update-notification-action"
        className="btn-cta"
        onClick={handleOpenRelease}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(234, 179, 8, 0.12)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: '9999px',
          padding: '2px 10px',
          color: '#CA8A04',
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.01em',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(234, 179, 8, 0.22)';
          e.currentTarget.style.borderColor = 'rgba(234, 179, 8, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(234, 179, 8, 0.12)';
          e.currentTarget.style.borderColor = 'rgba(234, 179, 8, 0.3)';
        }}
      >
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: '#EAB308',
            boxShadow: '0 0 6px rgba(234, 179, 8, 0.6)',
            flexShrink: 0,
          }}
        />
        <span>{badgeText}</span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginLeft: '1px', opacity: 0.8 }}
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </button>
    </div>
  );
};
