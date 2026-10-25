import { useEffect, useState } from 'react';

const QUERY = '(pointer: fine)';

// True for mouse/trackpad. Touch-only devices get no drag-and-drop (native drag is unreliable there).
export default function useFinePointer() {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY).matches : true
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const list = window.matchMedia(QUERY);
    const handleChange = (event) => setMatches(event.matches);
    list.addEventListener('change', handleChange);
    return () => list.removeEventListener('change', handleChange);
  }, []);

  return matches;
}