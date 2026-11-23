import { useEffect, useState } from 'react';

export default function SplashScreen({ onComplete }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onComplete?.(), 500); // Wait for fade out animation
    }, 4000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-500">
      {/* Background decorative subtle warmth rings */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-rose-50/60 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-rose-50/60 blur-3xl" />
      </div>

      {/* Logo and content */}
      <div className="relative flex flex-col items-center justify-center p-8">
        {/* Logo container */}
        <div className="relative mb-6">
          <div className="w-28 h-28 md:w-36 md:h-36 bg-white rounded-3xl shadow-[0_8px_30px_rgba(255,56,92,0.12)] border border-neutral-100 flex items-center justify-center p-4">
            <img
              src="/logo.svg"
              alt="SmashZone Logo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Brand name */}
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#222222] tracking-tight mb-2">
          Smash<span className="text-[#ff385c]">Zone</span>
        </h1>

        {/* Tagline */}
        <p className="text-sm md:text-base text-[#717171] font-medium tracking-widest uppercase">
          Nền tảng đặt sân cầu lông
        </p>

        {/* Loading indicator */}
        <div className="mt-8">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-[#ff385c] rounded-full animate-bounce" />
            <div className="w-2.5 h-2.5 bg-[#ff385c] rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
            <div className="w-2.5 h-2.5 bg-[#ff385c] rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>
      </div>
    </div>
  );
}


