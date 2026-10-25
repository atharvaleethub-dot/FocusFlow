import { useEffect, useState } from 'react';

// Re-renders on a timer so "now" indicators stay current. The interval is cleaned up on unmount.
export default function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}