import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import backgroundImage from '../../assets/img/bg.png'; // Make sure to place bg.png in src/assets
import Swal from 'sweetalert2';

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

  const { signUp } = useAuth();

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
      default:
        return 'An error occurred. Please try again';
    }
  };

  const nameError = touched && !name ? 'Name is required' : '';
  const emailError = touched && !email ? 'Email is required' : '';
  const passwordError = touched && !password ? 'Password is required' : '';
  const confirmPasswordError = touched && password !== confirmPassword ? 'Passwords do not match' : '';

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
    </div>
  );
};

export default Signup; 