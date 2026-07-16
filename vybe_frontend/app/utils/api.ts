const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('vybe_access_token');
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('vybe_refresh_token');
}

export function saveTokens(access: string, refresh: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('vybe_access_token', access);
  localStorage.setItem('vybe_refresh_token', refresh);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('vybe_access_token');
  localStorage.removeItem('vybe_refresh_token');
  localStorage.removeItem('vybe_user');
}

export async function apiLogout() {
  try {
    await apiFetch('/auth/logout/', { method: 'POST' });
  } catch (err) {
    console.error("Backend logout error:", err);
  }
  clearTokens();
}

export function getSavedUser() {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('vybe_user');
  try {
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function saveUser(user: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('vybe_user', JSON.stringify(user));
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: any;
}

export async function apiFetch(endpoint: string, options: FetchOptions = {}) {
  const token = getAccessToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include'
  };

  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    
    // Attempt parsing JSON
    let data = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { text };
      }
    }
    if (!response.ok) {
      // Don't auto-redirect on 401 if we're on the login page already
      if (response.status === 401) {
        clearTokens();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
          window.location.href = '/login';
        }
      }
      if (response.status === 429) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      }
      
      // Extract error messages from DRF responses
      let errorMsg = 'An error occurred';
      if (data) {
        if (data.detail) {
          errorMsg = typeof data.detail === 'object' ? JSON.stringify(data.detail) : data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        } else if (data.error) {
          errorMsg = data.error;
        } else if (data.non_field_errors) {
          errorMsg = Array.isArray(data.non_field_errors) ? data.non_field_errors.join(' ') : data.non_field_errors;
        } else {
          // Handle field-level DRF validation errors like {username: ["Already exists."]}
          const fieldErrors = Object.entries(data)
            .map(([key, val]) => {
              if (Array.isArray(val)) {
                return `${key}: ${val.join(', ')}`;
              }
              if (typeof val === 'string') {
                return `${key}: ${val}`;
              }
              if (typeof val === 'object' && val !== null) {
                return `${key}: ${JSON.stringify(val)}`;
              }
              return '';
            })
            .filter(Boolean)
            .join('. ');
          if (fieldErrors) {
            errorMsg = fieldErrors;
          }
        }
      }
      const errorObj = new Error(errorMsg);
      (errorObj as any).status = response.status;
      (errorObj as any).data = data;
      throw errorObj;
    }

    return data;
  } catch (error: any) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    throw error;
  }
}
