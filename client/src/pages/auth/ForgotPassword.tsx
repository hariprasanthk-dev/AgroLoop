import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type FormData = z.infer<typeof schema>;

const ForgotPassword: React.FC = () => {
  const { forgotPassword, isLoading } = useAuthStore();
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await forgotPassword(data.email);
      setSubmittedEmail(data.email);
      setSubmitted(true);
    } catch {
      // Even if the server returns an error, show success to prevent enumeration
      setSubmittedEmail(data.email);
      setSubmitted(true);
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
          {!submitted ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-100">Forgot password?</h2>
                  <p className="text-slate-400 text-sm">We'll send a reset link to your inbox</p>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      {...register('email')}
                      type="email"
                      placeholder="you@example.com"
                      className="input-field pl-10"
                      id="forgot-email"
                      autoFocus
                    />
                  </div>
                  {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary w-full mt-2"
                  id="forgot-submit"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  {isLoading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
            </>
          ) : (
            /* ── Success state ── */
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-100 mb-2">Check your inbox</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-1">
                If an account exists for
              </p>
              <p className="text-emerald-400 font-medium text-sm mb-4 break-all">{submittedEmail}</p>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                you'll receive a password reset link shortly.
                The link expires in <span className="text-amber-400 font-medium">10 minutes</span>.
              </p>
              <div className="text-xs text-slate-500 bg-slate-800/50 rounded-xl p-3 text-left">
                <p className="font-semibold text-slate-400 mb-1">Didn't receive the email?</p>
                <ul className="space-y-1">
                  <li>• Check your spam / junk folder</li>
                  <li>• Make sure the email address is correct</li>
                  <li>• Wait a minute and try again</li>
                </ul>
              </div>
            </div>
          )}

          <p className="text-center text-sm text-slate-500 mt-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
