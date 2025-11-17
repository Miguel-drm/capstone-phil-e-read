import React from 'react';

interface AuthMessageModalProps {
  title?: string;
  message: string;
  onClose: () => void;
  actionLabel?: string;
}

const AuthMessageModal: React.FC<AuthMessageModalProps> = ({
  title = 'Notice',
  message,
  onClose,
  actionLabel = 'Close'
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-slate-900 text-center">{title}</h3>
        </div>
        <p className="text-sm text-slate-600 text-center mb-6">{message}</p>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
};

export default AuthMessageModal;

