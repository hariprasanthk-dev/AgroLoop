import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';

const schema = z
  .object({
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

type PageState = 'idle' | 'success' | 'error';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const { resetPassword, isLoading } = useAuthStore();

  const [pageState, setPageState] = useState<PageState>(token ? 'idle' : 'error');
  const [errorMsg, setErrorMsg] = useState<string>(
    token ? '' : 'Invalid or missing reset token. Please request a new password reset link.'
  );
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Auto-redirect to login after success
  useEffect(() => {
    if (pageState !== 'success') return;
    const timer = setTimeout(() => navigate('/login', { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [pageState, navigate]);

  const onSubmit = async (data: FormData) => {
    if (!token) return;
    try {
      await resetPassword(token, data.password);
      setPageState('success');
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ??
        'Failed to reset password. The link may have expired.';
      setErrorMsg(msg);
      setPageState('error');
    }
  };

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

        <div className="glass-card p-8">
          {/* ── Success state ─────────────────────────────────────────────── */}
          {pageState === 'success' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-100 mb-2">Password reset!</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Your password has been updated successfully.
                Redirecting you to the login page…
              </p>
              <div className="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-emerald-500 animate-[shrink_3s_linear_forwards]" style={{ width: '100%', animation: 'progress 3s linear forwards' }} />
              </div>
            </div>
          )}

          {/* ── Error state ───────────────────────────────────────────────── */}
          {pageState === 'error' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 mb-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-100 mb-2">Link expired or invalid</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">{errorMsg}</p>
              <Link to="/forgot-password" className="btn-primary inline-flex">
                Request a new link
              </Link>
            </div>
          )}

          {/* ── Form state ────────────────────────────────────────────────── */}
          {pageState === 'idle' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Set new password</h2>
                  <p className="text-slate-400 text-sm">Choose a strong password</p>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* New password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      {...register('password')}
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="input-field pl-10 pr-10"
                      id="reset-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      {...register('confirmPassword')}
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="input-field pl-10 pr-10"
                      id="reset-confirm-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full mt-2"
                  id="reset-submit"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  {isLoading ? 'Resetting…' : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          {pageState !== 'success' && (
            <p className="text-center text-sm text-slate-500 mt-6">
              Remember your password?{' '}
              <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
