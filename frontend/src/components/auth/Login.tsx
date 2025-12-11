import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import capstoneLogo from '../../assets/img/capstone-logo.png';
import AuthModalLayout from './AuthModalLayout';
import Swal from 'sweetalert2';
import { Button } from '../ui';

interface LoginProps {
  onSwitchToSignup: () => void;
}

const Login: React.FC<LoginProps> = ({ onSwitchToSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn, resetPassword, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError('');
    
    if (email && password) {
      setLoading(true);
      try {
        await signIn(email, password);
        // Redirect to auth-redirect after successful sign-in
        navigate('/auth-redirect');
      } catch (error: any) {
        const errorMessage = getErrorMessage(error.code);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await resetPassword(email);
      setResetEmailSent(true);
    } catch (error: any) {
      const errorMessage = getErrorMessage(error.code);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/auth-redirect');
    } catch (error: any) {
      const errorMessage = getErrorMessage(error.code);
      if (error.code === 'auth/user-not-registered') {
        await Swal.fire({
          icon: 'warning',
          title: 'Google account not registered',
          text: 'Please sign up first using this Google account.',
          confirmButtonText: 'OK',
          confirmButtonColor: '#2563eb'
        });
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email address';
      case 'auth/wrong-password':
        return 'Incorrect password';
      case 'auth/invalid-email':
        return 'Invalid email address';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later';
      case 'auth/user-disabled':
        return 'This account has been disabled';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed';
      case 'auth/cancelled-popup-request':
        return 'Sign-in was cancelled';
      case 'auth/user-not-registered':
        return 'Google account not registered. Please sign up first.';
      default:
        return 'An error occurred. Please try again';
    }
  };

  const emailError = touched && !email ? 'Email is required' : '';
  const passwordError = touched && !password ? 'Password is required' : '';

  if (showResetPassword) {
    return (
      <AuthModalLayout>
        <div className="bg-white rounded-2xl p-8 w-full flex flex-col gap-6 shadow-2xl border border-gray-200">
          <div className="mb-2 text-center">
            <img src={capstoneLogo} alt="Capstone Logo" className="mx-auto mb-6 h-16 w-auto" />
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Reset Password</h2>
            <p className="text-gray-600 text-base">
              {resetEmailSent 
                ? 'Check your email for password reset instructions'
                : 'Enter your email to receive reset instructions'
              }
            </p>
          </div>
          
          {!resetEmailSent ? (
            <>
              <div>
                <label htmlFor="reset-email" className="input-label">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  className={`input w-full ${error ? 'input-error' : ''}`}
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              {error && (
                <div className="input-error-message justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}
              <Button
                onClick={handleResetPassword}
                loading={loading}
                variant="primary"
                fullWidth
              >
                Send Reset Email
              </Button>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="text-green-600 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-base text-gray-600 mb-4">
                We've sent a password reset link to <span className="font-semibold">{email}</span>
              </p>
            </div>
          )}
          
          <Button
            onClick={() => {
              setShowResetPassword(false);
              setResetEmailSent(false);
              setError('');
            }}
            variant="secondary"
            fullWidth
          >
            Back to Login
          </Button>
        </div>
      </AuthModalLayout>
    );
  }

  return (
    <AuthModalLayout>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 w-full flex flex-col gap-6 shadow-2xl border border-gray-200">
        <div className="mb-2 text-center">
          <img src={capstoneLogo} alt="Capstone Logo" className="mx-auto mb-6 h-16 w-auto" />
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Sign In</h2>
          <p className="text-gray-600 text-base">Welcome back! Please login to your account.</p>
        </div>
        <div>
          <label htmlFor="email" className="input-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`input w-full ${emailError ? 'input-error' : ''}`}
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          {emailError && (
            <div className="input-error-message">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {emailError}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="password" className="input-label">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={`input w-full pr-12 ${passwordError ? 'input-error' : ''}`}
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.657.336-3.236.938-4.675M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.062-4.675A9.956 9.956 0 0122 9c0 5.523-4.477 10-10 10-.69 0-1.366-.07-2.025-.2M9.88 9.88a3 3 0 104.24 4.24" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm2.828-2.828A9.956 9.956 0 0122 12c0 5.523-4.477 10-10 10S2 17.523 2 12c0-2.21.714-4.253 1.928-5.828" /></svg>
              )}
            </button>
          </div>
          {passwordError && (
            <div className="input-error-message">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {passwordError}
            </div>
          )}
        </div>
        {error && (
          <div className="input-error-message justify-center">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
        
        <Button
          type="submit"
          loading={loading}
          variant="primary"
          fullWidth
        >
          Sign In
        </Button>
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowResetPassword(true)}
            className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors"
          >
            Forgot your password?
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 h-11 rounded-lg border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 bg-white text-gray-700 font-semibold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
          Sign in with Google
        </button>

        <div className="text-center text-base text-gray-600 mt-2">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="text-blue-600 hover:text-blue-700 hover:underline font-semibold transition-colors"
          >
            Sign up
          </button>
        </div>
      </form>
    </AuthModalLayout>
  );
};

export default Login; 