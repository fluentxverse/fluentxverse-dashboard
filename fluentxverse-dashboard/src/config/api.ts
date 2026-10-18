import { productionEndpoints } from './productionDomains';

const production = typeof window !== 'undefined' ? productionEndpoints(window.location.hostname) : undefined;
export const API_BASE_URL = production?.apiUrl
  || (import.meta.env.VITE_API_URL || 'http://localhost:8765').trim().replace(/\/+$/, '');
