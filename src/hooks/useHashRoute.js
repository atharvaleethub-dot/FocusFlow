import { useEffect, useState } from 'react';

const DEFAULT_ROUTE = '/dashboard';

function readRoute() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return DEFAULT_ROUTE;
  return hash.startsWith('/') ? hash : DEFAULT_ROUTE;
}

export default function useHashRoute() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const handleChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', handleChange);
    return () => window.removeEventListener('hashchange', handleChange);
  }, []);

  return route;
}