import React, { type ReactNode } from 'react';
import backgroundImage from '../../assets/img/bg.png';

interface AuthModalLayoutProps {
  children: ReactNode;
}

const AuthModalLayout: React.FC<AuthModalLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={backgroundImage}
          alt="Background"
          className="w-full h-full object-cover opacity-70"
        />
      </div>
      <div className="absolute inset-0 bg-slate-950/30 backdrop-blur-[1px]" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-slate-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-lg mx-auto">
        {children}
      </div>
    </div>
  );
};

export default AuthModalLayout;

