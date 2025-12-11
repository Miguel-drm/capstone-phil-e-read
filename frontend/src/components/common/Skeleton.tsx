import React from 'react';

interface SkeletonProps {
  variant?: 'text' | 'title' | 'avatar' | 'button' | 'card' | 'rectangular';
  width?: string;
  height?: string;
  className?: string;
  count?: number;
}

const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
  count = 1
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'text':
        return 'skeleton-text';
      case 'title':
        return 'skeleton-title';
      case 'avatar':
        return 'skeleton-avatar w-10 h-10';
      case 'button':
        return 'skeleton-button';
      case 'card':
        return 'skeleton-card';
      case 'rectangular':
        return 'skeleton';
      default:
        return 'skeleton';
    }
  };

  const skeletonStyle = {
    width: width || undefined,
    height: height || undefined
  };

  const skeletons = Array.from({ length: count }, (_, index) => (
    <div
      key={index}
      className={`${getVariantClasses()} ${className}`}
      style={skeletonStyle}
      aria-hidden="true"
    />
  ));

  return count > 1 ? (
    <div className="space-y-2">
      {skeletons}
    </div>
  ) : (
    <>{skeletons}</>
  );
};

export default Skeleton;
