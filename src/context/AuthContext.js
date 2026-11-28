import React, { createContext, useContext, useState, useRef } from 'react';
import { setApiConfig, DEFAULT_BASE_URL } from '../api/config';
import { userApi } from '../api/userApi';
import { useQueryClient } from '@tanstack/react-query';

const AuthContext = createContext({
  username: '',
  password: '',
  baseUrl: DEFAULT_BASE_URL,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  login: async (_username, _password, _baseUrl) => {},
  logout: () => {},
  setServerUrl: (_url) => {},
});

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [baseUrl, setBaseUrlState] = useState(DEFAULT_BASE_URL);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const authAttemptRef = useRef(0);

  const setServerUrl = (url) => {
    const cleanUrl = url.replace(/\/+$/, '');
    if (cleanUrl !== baseUrl) {
      // Invalidate in-flight auth attempts, clear session state and cache
      authAttemptRef.current += 1;
      setUsername('');
      setPassword('');
      setUser(null);
      setError(null);
      setApiConfig({ baseUrl: cleanUrl, username: '', password: '' });
      queryClient.clear();
    } else {
      setApiConfig({ baseUrl: cleanUrl });
    }
    setBaseUrlState(cleanUrl);
  };

  const login = async (uName, pWord, customUrl) => {
    const attemptId = ++authAttemptRef.current;
    setIsLoading(true);
    setError(null);

    const activeUrl = (customUrl || baseUrl).replace(/\/+$/, '');
    setApiConfig({
      baseUrl: activeUrl,
      username: uName.trim(),
      password: pWord.trim(),
    });

    try {
      // Validate credentials by fetching user profile
      const profile = await userApi.getUserProfile();
      // Drop response if a new login, logout, or server change occurred
      if (attemptId !== authAttemptRef.current) return null;

      setUsername(uName.trim());
      setPassword(pWord.trim());
      setBaseUrlState(activeUrl);
      setUser(profile);
      queryClient.clear();
      return profile;
    } catch (err) {
      if (attemptId === authAttemptRef.current) {
        setError(err.message || 'Login failed');
        // Reset config
        setApiConfig({ username: '', password: '' });
      }
      throw err;
    } finally {
      if (attemptId === authAttemptRef.current) {
        setIsLoading(false);
      }
    }
  };

  const logout = () => {
    authAttemptRef.current += 1;
    setUsername('');
    setPassword('');
    setUser(null);
    setError(null);
    setApiConfig({ username: '', password: '' });
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{
        username,
        password,
        baseUrl,
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        logout,
        setServerUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
