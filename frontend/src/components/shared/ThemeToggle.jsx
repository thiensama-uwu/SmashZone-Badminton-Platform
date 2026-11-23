import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`relative p-2 rounded-xl transition-all duration-300 btn-press ${
        isDark
          ? 'bg-surface-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          : 'bg-surface-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
      } ${className}`}
      aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
    >
      <div className="relative w-5 h-5">
        <Sun
          className={`absolute inset-0 transition-all duration-500 ${
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`}
          size={20}
          strokeWidth={2}
        />
        <Moon
          className={`absolute inset-0 transition-all duration-500 ${
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
          }`}
          size={20}
          strokeWidth={2}
        />
      </div>
    </button>
  );
}
