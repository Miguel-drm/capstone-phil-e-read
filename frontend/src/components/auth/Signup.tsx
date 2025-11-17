import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import capstoneLogo from '../../assets/img/capstone-logo.png';
import Swal from 'sweetalert2';
import AuthModalLayout from './AuthModalLayout';

interface SignupProps {
  onSwitchToLogin: () => void;
}

const Signup: React.FC<SignupProps> = ({ onSwitchToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signUp, signUpWithGoogle } = useAuth();
  const navigate = useNavigate();

  const validateEmail = (email: string): boolean => {
    const domain = email.split('@')[1]?.toLowerCase();
    return domain === 'admin.com' || domain === 'teacher.edu.ph' || domain?.includes('.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError('');
    
    if (!validateEmail(email)) {
      setError('Please use a valid email address');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    if (name && email && password) {
      setLoading(true);
      try {
        await signUp(email, password, name);
        await Swal.fire({
          icon: 'success',
          title: 'Account Created Successfully!',
          text: 'You can now log in with your credentials.',
          timer: 2000,
          timerProgressBar: true,
          showConfirmButton: false
        });
        onSwitchToLogin();
      } catch (error: any) {
        const errorMessage = getErrorMessage(error.code);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      await signUpWithGoogle();
      await Swal.fire({
        icon: 'success',
        title: 'Account Created Successfully!',
        text: 'You can now use your Google account to sign in.',
        timer: 2000,
        timerProgressBar: true,
        showConfirmButton: false
      });
      navigate('/auth-redirect');
    } catch (error: any) {
      const errorMessage = getErrorMessage(error.code);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'An account with this email already exists';
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password';
      case 'auth/operation-not-allowed':
        return 'Email/password accounts are not enabled. Please contact support';
      case 'auth/popup-closed-by-user':
        return 'Sign-up popup was closed';
      case 'auth/cancelled-popup-request':
        return 'Sign-up was cancelled';
      default:
        return 'An error occurred. Please try again';
    }
  };

  const nameError = touched && !name ? 'Name is required' : '';
  const emailError = touched && !email ? 'Email is required' : '';
  const passwordError = touched && !password ? 'Password is required' : '';
  const confirmPasswordError = touched && password !== confirmPassword ? 'Passwords do not match' : '';

  return (
    <AuthModalLayout>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 sm:p-8 w-full flex flex-col gap-4 shadow-2xl border border-slate-100">
        <div className="mb-2 text-center">
          <img src={capstoneLogo} alt="Capstone Logo" className="mx-auto mb-4 h-16 w-auto" />
          <h2 className="text-2xl font-bold text-blue-700 mb-1">Create Account</h2>
          <p className="text-gray-500 text-sm">Join us and start your journey!</p>
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            className={`w-full px-4 py-2 rounded-lg border ${nameError ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm`}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          {nameError && <div className="text-xs text-red-500 mt-1">{nameError}</div>}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`w-full px-4 py-2 rounded-lg border ${emailError ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm`}
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          {emailError && <div className="text-xs text-red-500 mt-1">{emailError}</div>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className={`w-full px-4 py-2 rounded-lg border ${passwordError ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm`}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          {passwordError && <div className="text-xs text-red-500 mt-1">{passwordError}</div>}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            className={`w-full px-4 py-2 rounded-lg border ${confirmPasswordError ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm`}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />
          {confirmPasswordError && <div className="text-xs text-red-500 mt-1">{confirmPasswordError}</div>}
        </div>

        {error && <div className="text-xs text-red-600 text-center">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-base transition-colors"
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        {/* Google Sign Up Button */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border-2 border-gray-300 hover:border-gray-400 bg-white text-gray-700 font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Sign up with Google
        </button>

        <div className="text-center text-sm text-gray-500 mt-2">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-blue-600 hover:underline font-medium"
          >
            Sign in
          </button>
        </div>
      </form>
    </AuthModalLayout>
  );
};

export default Signup; 