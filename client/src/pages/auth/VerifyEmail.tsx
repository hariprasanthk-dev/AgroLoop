import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, Mail } from 'lucide-react';
import { authApi } from '../../api/auth.api';

type VerifyState = 'loading' | 'success' | 'error';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<VerifyState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const calledRef = useRef(false); // prevent React StrictMode double-call

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    const verify = async () => {
      if (!token) {
        setErrorMsg('Verification token is missing from the URL.');
        setState('error');
        return;
      }

      try {
        const res = await authApi.verifyEmail(token);
        const data = res.data.data as { verified: boolean; error?: string } | undefined;
        if (data?.verified) {
          setState('success');
        } else {
          setErrorMsg(data?.error ?? 'Verification failed.');
          setState('error');
        }
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } } })
            ?.response?.data?.message ??
          'Invalid or expired verification link.';
        setErrorMsg(msg);
        setState('error');
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-xl shadow-emerald-500/30 mb-4">
            <span className="text-3xl">🧅</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gradient">AgroLoop</h1>
          <p className="text-slate-400 text-sm mt-1">Zero-Waste Onion Supply Chain</p>
        </div>

        <div className="glass-card p-8 text-center">

          {/* ── Loading ──────────────────────────────────────────────────── */}
          {state === 'loading' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
              <h2 className="text-xl font-bold text-slate-100 mb-2">Verifying your email…</h2>
              <p className="text-slate-400 text-sm">Please wait a moment.</p>
            </>
          )}

          {/* ── Success ──────────────────────────────────────────────────── */}
          {state === 'success' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-100 mb-2">Email verified! 🎉</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Your account is now active. You can sign in to AgroLoop.
              </p>
              <Link
                to="/login"
                className="btn-primary inline-flex"
                id="verify-go-login"
              >
                Go to Sign In
              </Link>
            </>
          )}

          {/* ── Error ────────────────────────────────────────────────────── */}
          {state === 'error' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-100 mb-2">Verification failed</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">{errorMsg}</p>

              <div className="space-y-3">
                <Link
                  to="/login"
                  className="btn-primary w-full inline-flex justify-center"
                  id="verify-error-login"
                >
                  <Mail className="w-4 h-4" />
                  Sign in to resend verification
                </Link>
                <p className="text-xs text-slate-500">
                  After signing in, use the banner in your dashboard to request a new link.
                </p>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
