import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth.store';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    try {
      const res = await api.post('/auth/login', data);
      const { accessToken, refreshToken } = res.data.data;
      setTokens(accessToken, refreshToken);
      const profile = await api.get('/auth/me');
      setUser(profile.data.data);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Login failed';
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-2 bg-blue-600 rounded-xl">
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">JobScheduler</h1>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-5">Sign in to your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm text-gray-400 mb-1.5">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="input"
                placeholder="admin@example.com"
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm text-gray-400 mb-1.5">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="input"
                placeholder="••••••••"
                {...register('password')}
              />
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full justify-center" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Sign in
            </button>
          </form>

          <p className="mt-4 text-xs text-center text-gray-500">
            Demo: admin@example.com / Admin@123
          </p>
        </div>
      </div>
    </div>
  );
}
