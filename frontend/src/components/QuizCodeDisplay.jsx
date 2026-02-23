/**
 * Affichage du code d'accès au quiz en grand + QR code.
 * Quand showLaunchButton est true, affiche un bouton « Lancé » pour démarrer le quiz (après Ouvert).
 */

import { QRCodeSVG } from 'qrcode.react';
import './QuizCodeDisplay.css';

export default function QuizCodeDisplay({ accessCode, onClose, title, showLaunchButton, onLaunch, launchLoading }) {
  const joinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join?code=${encodeURIComponent(accessCode || '')}`
    : '';

  return (
    <div className="quiz-code-overlay" role="dialog" aria-modal="true" aria-labelledby="quiz-code-title">
      <div className="quiz-code-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="quiz-code-modal">
        <h2 id="quiz-code-title" className="quiz-code-heading">
          {title || 'Quiz ouvert'}
        </h2>
        <p className="quiz-code-subtitle">Les participants peuvent rejoindre avec ce code ou en scannant le QR code</p>

        <div className="quiz-code-block">
          <span className="quiz-code-value" data-testid="access-code">{accessCode}</span>
        </div>

        {joinUrl && (
          <div className="quiz-code-qr">
            <QRCodeSVG value={joinUrl} size={220} level="M" includeMargin />
          </div>
        )}

        {showLaunchButton && (
          <button
            type="button"
            className="quiz-code-launch"
            onClick={onLaunch}
            disabled={launchLoading}
          >
            {launchLoading ? 'Démarrage…' : 'Lancé'}
          </button>
        )}

        <button type="button" className="quiz-code-close" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>
  );
}
