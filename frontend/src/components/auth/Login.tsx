import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import backgroundImage from '../../assets/img/bg.png';// Make sure to place bg.png in src/assets

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

  const { signIn, resetPassword } = useAuth();
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
      default:
        return 'An error occurred. Please try again';
    }
  };

  const emailError = touched && !email ? 'Email is required' : '';
  const passwordError = touched && !password ? 'Password is required' : '';

  if (showResetPassword) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center px-4 relative"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black opacity-40"></div>
        <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-md flex flex-col gap-4 relative z-10">
          <div className="mb-2 text-center">
            <h2 className="text-2xl font-bold text-blue-700 mb-1">Reset Password</h2>
            <p className="text-gray-500 text-sm">
              {resetEmailSent 
                ? 'Check your email for password reset instructions'
                : 'Enter your email to receive reset instructions'
              }
            </p>
          </div>
          
          {!resetEmailSent ? (
            <>
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  className={`w-full px-4 py-2 rounded-lg border ${error ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm`}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              {error && <div className="text-xs text-red-600 text-center">{error}</div>}
              <button
                onClick={handleResetPassword}
                disabled={loading}
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-base transition-colors"
              >
                {loading ? 'Sending...' : 'Send Reset Email'}
              </button>
            </>
          ) : (
            <div className="text-center">
              <div className="text-green-600 mb-4">
                <i className="fas fa-check-circle text-2xl"></i>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                We've sent a password reset link to {email}
              </p>
            </div>
          )}
          
          <button
            onClick={() => {
              setShowResetPassword(false);
              setResetEmailSent(false);
              setError('');
            }}
            className="w-full py-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-base transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 relative"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black opacity-40"></div>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 sm:p-8 w-full max-w-md flex flex-col gap-4 relative z-10">
        <div className="mb-2 text-center">
          <h2 className="text-2xl font-bold text-blue-700 mb-1">Sign In</h2>
          <p className="text-gray-500 text-sm">Welcome back! Please login to your account.</p>
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
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={`w-full px-4 py-2 rounded-lg border ${passwordError ? 'border-red-400' : 'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm pr-10`}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.657.336-3.236.938-4.675M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.062-4.675A9.956 9.956 0 0122 9c0 5.523-4.477 10-10 10-.69 0-1.366-.07-2.025-.2M9.88 9.88a3 3 0 104.24 4.24" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm2.828-2.828A9.956 9.956 0 0122 12c0 5.523-4.477 10-10 10S2 17.523 2 12c0-2.21.714-4.253 1.928-5.828" /></svg>
              )}
            </button>
          </div>
          {passwordError && <div className="text-xs text-red-500 mt-1">{passwordError}</div>}
        </div>
        {error && <div className="text-xs text-red-600 text-center">{error}</div>}
        
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-base transition-colors"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
        <div className="text-center">
          <button
            type="button"
            onClick={() => setShowResetPassword(true)}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Forgot your password?
          </button>
        </div>
        <div className="text-center text-sm text-gray-500 mt-2">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignup}
            className="text-blue-600 hover:underline font-medium"
          >
            Sign up
          </button>
        </div>
      </form>
    </div>
  );
};

export default Login; 