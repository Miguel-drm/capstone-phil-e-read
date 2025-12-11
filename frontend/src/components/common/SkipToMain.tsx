import React from 'react';

/**
 * SkipToMain component provides a keyboard-accessible link
 * that allows users to skip directly to the main content,
 * bypassing navigation and other repeated elements.
 * 
 * This is an important accessibility feature for keyboard
 * and screen reader users.
 */
const SkipToMain: React.FC = () => {
  return (
    <a 
      href="#main-content" 
      className="skip-to-main"
    >
      Skip to main content
    </a>
  );
};

export default SkipToMain;
