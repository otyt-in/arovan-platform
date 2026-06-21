'use client';
import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // This checks your typed inputs against your Supabase Authentication accounts table
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError('Invalid credentials. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center bg-[#f4f1eb] p-4" style={{ minHeight: '100vh' }}>
      <div className="bg-white p-8 rounded-lg border border-[#e1d8cd] shadow-md w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="font-serif text-3xl font-medium tracking-tight">AROVAN</h1>
          <p className="text-xs text-[#746b61] uppercase tracking-wider mt-1">Product Master Secure Portal</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-[#4a443e] mb-1">Staff Email</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 border border-[#dcd3c9] rounded-md text-sm outline-none focus:border-[#171512] bg-[#fdfcfb]"
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-[#4a443e] mb-1">Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 border border-[#dcd3c9] rounded-md text-sm outline-none focus:border-[#171512] bg-[#fdfcfb]"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-2.5 bg-[#171512] text-white font-medium rounded-md text-sm hover:opacity-90 transition disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}