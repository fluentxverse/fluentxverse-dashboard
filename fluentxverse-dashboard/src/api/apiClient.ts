import axios, { AxiosError } from 'axios';

import { API_BASE_URL } from '../config/api';
import { isLessonMediaRequest, normalizeLessonMedia } from '../../../shared/lessonMedia';

// Create a shared axios instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Session expired event - components can listen to this
export const SESSION_EXPIRED_EVENT = 'fxv:session-expired';

// Flag to prevent multiple redirects
let isHandlingUnauthorized = false;

// Set up response interceptor to handle 401 errors
apiClient.interceptors.response.use(
  (response) => {
    if (isLessonMediaRequest(response.config.url)) response.data = normalizeLessonMedia(response.data, API_BASE_URL);
    return response;
  },
  (error: AxiosError) => {
    // Check if it's a 401 Unauthorized error
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      
      // Don't show session expired modal for auth-related endpoints
      // These are expected to return 401 when not logged in
      const isAuthEndpoint = url.includes('/login') || 
                             url.includes('/logout') || 
                             url.includes('/me') ||
                             url.includes('/register');
      
      // Only show session expired for non-auth endpoints (actual session timeouts)
      if (!isAuthEndpoint && !isHandlingUnauthorized) {
        isHandlingUnauthorized = true;
        
        console.warn('[API] Session expired or unauthorized');
        
        // Clear any stored auth data
        localStorage.removeItem('fxv_admin_id');
        
        // Dispatch custom event for session expired
        // Components can listen to this to show a modal or redirect
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, {
          detail: { 
            message: 'Your session has expired. Please log in again.',
            url: error.config?.url
          }
        }));
        
        // Reset flag after a short delay to allow new requests
        setTimeout(() => {
          isHandlingUnauthorized = false;
        }, 1000);
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
