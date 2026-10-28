import { apiFetch } from './config';
import { User } from './types';

export const userApi = {
  /**
   * List all registered users on the platform.
   * Useful to discover users to start a conversation with.
   * GET /user
   */
  async getAllUsers(): Promise<User[]> {
    return apiFetch<User[]>('/user');
  },

  /**
   * Get user profile.
   * Returns target user profile if userId is passed, otherwise returns the caller profile.
   * GET /user/profile?user_id=...
   */
  async getUserProfile(userId?: string): Promise<User> {
    const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
    return apiFetch<User>(`/user/profile${query}`);
  },
};
