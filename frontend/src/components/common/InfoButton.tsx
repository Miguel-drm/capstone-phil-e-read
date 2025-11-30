import React, { useState } from 'react';
import type { ReactNode } from 'react';
import Tooltip from '@/components/common/Tooltip';

interface InfoButtonProps {
  title: string;
  children: ReactNode;
  buttonClassName?: string;
  tooltipText?: string;
}

const InfoButton: React.FC<InfoButtonProps> = ({ 
  title, 
  children, 
  buttonClassName = '',
  tooltipText = 'About'
}) => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Tooltip text={tooltipText} position="top">
        <button
          onClick={() => setShowModal(true)}
          className={`inline-flex items-center justify-center w-9 h-9 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full transition-colors ${buttonClassName}`}
        >
          <i className="fas fa-info-circle text-lg"></i>
        </button>
      </Tooltip>

      {/* Info Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" 
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-fade-in" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                <i className="fas fa-info-circle text-blue-500"></i>
                {title}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-sm text-gray-700 space-y-3">
              {children}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InfoButton;
