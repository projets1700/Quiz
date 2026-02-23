/**
 * Fond motivant, animé et légèrement gamifié (dégradé animé + orbes + étoiles).
 * Les bulles utilisent des animations CSS pures pour un mouvement fluide et naturel.
 * Logo CEA affiché sur les pages Accueil et Home (sans fond noir).
 */
import { useLocation } from 'react-router-dom';
import './AnimatedBackground.css';

const ORB_CONFIG = [
  { w: 80, h: 80, left: '10%', top: '20%', opacity: 0.85, anim: 'orb-float-1', duration: 32 },
  { w: 60, h: 60, left: '75%', top: '15%', opacity: 0.8, anim: 'orb-float-2', duration: 11 },
  { w: 50, h: 50, left: '25%', top: '60%', opacity: 0.88, anim: 'orb-float-4', duration: 8 },
  { w: 70, h: 70, left: '80%', top: '55%', opacity: 0.82, anim: 'orb-float-5', duration: 19 },
  { w: 40, h: 40, left: '15%', top: '80%', opacity: 0.9, anim: 'orb-float-6', duration: 14 },
  { w: 90, h: 90, left: '60%', top: '25%', opacity: 0.78, anim: 'orb-float-7', duration: 22 },
  { w: 55, h: 55, left: '35%', top: '40%', opacity: 0.85, anim: 'orb-float-8', duration: 29 },
];

export default function AnimatedBackground() {
  const { pathname } = useLocation();
  const showLogo = pathname === '/' || pathname === '/home';

  return (
    <div className="app-bg" aria-hidden="true">
      <div className="app-bg-gradient" />
      {showLogo && (
        <div className="app-bg-logo-cea" aria-hidden="true">
          <img src="/logo-cea.png" alt="" />
        </div>
      )}
      <div className="app-bg-glow" />
      <div className="app-bg-glow-2" />
      <div className="app-bg-orbs">
        {ORB_CONFIG.map((config, i) => (
          <div
            key={i}
            className="app-bg-orb"
            style={{
              width: config.w,
              height: config.h,
              left: config.left,
              top: config.top,
              background: `radial-gradient(circle at 25% 25%, #1976d2 0%, #2196f3 30%, #64b5f6 55%, #9ccc65 80%, #CBE256 100%)`,
              animation: `${config.anim} ${config.duration}s ease-in-out infinite`,
              animationDelay: `${-i * 2.3}s`,
            }}
          />
        ))}
      </div>
      <div className="app-bg-stars" />
    </div>
  );
}
