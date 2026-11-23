import { Outlet } from 'react-router-dom';
import ThemeToggle from '../components/shared/ThemeToggle';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-background animate-fade-in relative">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <Outlet />
    </div>
  );
}
