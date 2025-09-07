'use client';

import React from 'react';

export function usePageVisibility(callback: (isInitial: boolean, timeInactive: number) => void) {
  const isInitialLoad = React.useRef(true);
  const inactiveSince = React.useRef<number | null>(null);

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        inactiveSince.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        const timeInactive = inactiveSince.current ? Date.now() - inactiveSince.current : 0;
        callback(isInitialLoad.current, timeInactive);
        isInitialLoad.current = false;
        inactiveSince.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [callback]);
}
