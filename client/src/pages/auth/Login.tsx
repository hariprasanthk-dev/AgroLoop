import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError, user } = useAuthStore();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const map = { admin: '/admin', client: '/client', farmer: '/farmer' };
      navigate(map[user.role], { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => { clearError(); }, [clearError]);

  const onSubmit = async (data: FormData) => {
    try {
      await login(data.email, data.password);
    } catch {/* handled in store */}
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
          <h2 className="text-xl font-bold text-slate-100 mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-6">Sign in to your account</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="you@example.com"
                  className="input-field pl-10"
                  id="login-email"
                />
              </div>
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  {...register('password')}
                  type="password"
                  placeholder="••••••••"
                  className="input-field pl-10"
                  id="login-password"
                />
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full mt-2"
              id="login-submit"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
