import { Outlet } from 'react-router-dom';
import Navbar from '../components/shared/Navbar';
import Footer from '../components/shared/Footer';

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-canvas text-ink antialiased">
      {/* Sidebar navigation */}
      <Navbar />

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-x-hidden">
        <main className="flex-1 animate-fade-in">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
