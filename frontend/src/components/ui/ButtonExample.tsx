import React, { useState } from 'react';
import Button from './Button';

/**
 * ButtonExample - Demonstrates all button variants and states
 * This component showcases the design system's button implementation
 */
const ButtonExample: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleLoadingDemo = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-h1 mb-2">Button Component Examples</h1>
        <p className="text-body text-gray-600 mb-8">
          Showcasing all button variants, sizes, and states from the design system
        </p>

        {/* Button Variants */}
        <section className="bg-white rounded-xl p-6 shadow-md mb-6">
          <h2 className="text-h3 mb-4">Button Variants</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="ghost">Ghost Button</Button>
          </div>
        </section>

        {/* Button Sizes */}
        <section className="bg-white rounded-xl p-6 shadow-md mb-6">
          <h2 className="text-h3 mb-4">Button Sizes</h2>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="sm">Small (36px)</Button>
            <Button variant="primary" size="md">Medium (44px)</Button>
            <Button variant="primary" size="lg">Large (52px)</Button>
          </div>
        </section>

        {/* Loading States */}
        <section className="bg-white rounded-xl p-6 shadow-md mb-6">
          <h2 className="text-h3 mb-4">Loading States</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary" loading={loading} onClick={handleLoadingDemo}>
              {loading ? 'Loading...' : 'Click to Load'}
            </Button>
            <Button variant="secondary" loading>
              Loading Secondary
            </Button>
            <Button variant="outline" loading>
              Loading Outline
            </Button>
          </div>
        </section>

        {/* Disabled States */}
        <section className="bg-white rounded-xl p-6 shadow-md mb-6">
          <h2 className="text-h3 mb-4">Disabled States</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary" disabled>Disabled Primary</Button>
            <Button variant="secondary" disabled>Disabled Secondary</Button>
            <Button variant="outline" disabled>Disabled Outline</Button>
            <Button variant="ghost" disabled>Disabled Ghost</Button>
          </div>
        </section>

        {/* Full Width */}
        <section className="bg-white rounded-xl p-6 shadow-md mb-6">
          <h2 className="text-h3 mb-4">Full Width Button</h2>
          <Button variant="primary" fullWidth>
            Full Width Button
          </Button>
        </section>

        {/* All Variants with All Sizes */}
        <section className="bg-white rounded-xl p-6 shadow-md">
          <h2 className="text-h3 mb-4">Complete Matrix</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-h5 mb-2">Primary</h3>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary" size="sm">Small</Button>
                <Button variant="primary" size="md">Medium</Button>
                <Button variant="primary" size="lg">Large</Button>
              </div>
            </div>
            <div>
              <h3 className="text-h5 mb-2">Secondary</h3>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="secondary" size="sm">Small</Button>
                <Button variant="secondary" size="md">Medium</Button>
                <Button variant="secondary" size="lg">Large</Button>
              </div>
            </div>
            <div>
              <h3 className="text-h5 mb-2">Outline</h3>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="outline" size="sm">Small</Button>
                <Button variant="outline" size="md">Medium</Button>
                <Button variant="outline" size="lg">Large</Button>
              </div>
            </div>
            <div>
              <h3 className="text-h5 mb-2">Ghost</h3>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="ghost" size="sm">Small</Button>
                <Button variant="ghost" size="md">Medium</Button>
                <Button variant="ghost" size="lg">Large</Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ButtonExample;
