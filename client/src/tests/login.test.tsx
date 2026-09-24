/**
 * Wrong-password regression test.
 *
 * Renders the real Login page, sends the form through the real axios
 * instance and interceptors, and answers with the server's 401. The error
 * must be shown, the user must not be logged out/redirected, and the page
 * must not reload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import api, { isSessionExpiredError } from '../api/axios';
import { useAuthStore } from '../stores/auth.store';
import Login from '../pages/auth/Login';

const unauthorized = (config: InternalAxiosRequestConfig, message: string) =>
  new AxiosError(message, 'ERR_BAD_REQUEST', config, null, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
    data: { success: false, message },
  });

describe('isSessionExpiredError', () => {
  const cfg = (url: string, withToken: boolean) =>
    ({ url, headers: withToken ? { Authorization: 'Bearer t' } : {} }) as unknown as InternalAxiosRequestConfig;

  it('ignores 401s from the auth endpoints (wrong password is not an expired session)', () => {
    expect(isSessionExpiredError({ config: cfg('/auth/login', false), response: { status: 401 } as never })).toBe(false);
    expect(isSessionExpiredError({ config: cfg('/auth/login', true), response: { status: 401 } as never })).toBe(false);
  });

  it('treats a 401 on an authenticated API call as an expired session', () => {
    expect(isSessionExpiredError({ config: cfg('/orders', true), response: { status: 401 } as never })).toBe(true);
  });

  it('ignores 401s on requests that carried no token', () => {
    expect(isSessionExpiredError({ config: cfg('/orders', false), response: { status: 401 } as never })).toBe(false);
  });
});

describe('Login page — wrong password', () => {
  const originalAdapter = api.defaults.adapter;
  const originalLocation = window.location.href;

  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, error: null, isLoading: false, _hasHydrated: true });
    api.defaults.adapter = (async (config) => {
      throw unauthorized(config, 'Invalid email or password.');
    }) as AxiosAdapter;
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    cleanup();
  });

  it('shows "Invalid email or password." and stays on the login page', async () => {
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout');

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<p>navigated away</p>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.input(screen.getByLabelText(/email/i, { selector: 'input' }), { target: { value: 'client@test.dev' } });
    fireEvent.input(screen.getByLabelText(/password/i, { selector: 'input' }), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await waitFor(() => screen.getByTestId('login-error'));
    expect(alert.textContent).toBe('Invalid email or password.');

    // Still on the login form, not logged out, no reload/redirect.
    expect(screen.queryByText('navigated away')).toBeNull();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy();
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(window.location.href).toBe(originalLocation);
    expect(useAuthStore.getState().error).toBe('Invalid email or password.');
    expect(useAuthStore.getState().token).toBeNull();
  });
});
