/**
 * TennisGate — wraps any route that belongs to the global TennisX product.
 *
 * In MVP the mode is always 'hoa'.  Any direct navigation to a tennis route
 * (e.g. /leagues-ladders, /manage-ladders) will:
 *   1. Trigger the "Tennis is Coming Soon" modal.
 *   2. Redirect back to the HOA home ("/").
 *
 * When Tennis is ready to ship, remove this file and replace the <TennisGate>
 * wrappers in App.tsx with the real page components.
 */
import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useMode } from '@/contexts/ModeContext';

const TennisGate = () => {
  const { triggerTennisComingSoon } = useMode();

  useEffect(() => {
    triggerTennisComingSoon();
  }, [triggerTennisComingSoon]);

  // Redirect to HOA home while the modal opens
  return <Navigate to="/" replace />;
};

export default TennisGate;
