import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Menu, Bell, User, X, Leaf, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-700 shadow-sm">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-emerald-950">
            Nusa<span className="text-emerald-700">Kas</span>
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:gap-8">
          {['Dashboard', 'Transaksi', 'Laporan', 'Pengaturan'].map((item, idx) => (
            <a
              key={item}
              href="#"
              className={`text-sm font-medium transition-colors ${
                idx === 0 ? 'text-emerald-700' : 'text-gray-500 hover:text-emerald-700'
              }`}
            >
              {item}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button className="relative rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
          </button>
          
          <div className="hidden md:block">
            <button className="flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 shadow-sm transition-all hover:border-gray-300 hover:shadow-md">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <User className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold text-gray-700">{user?.full_name || 'Juragan'}</span>
            </button>
          </div>

          <button
            onClick={logout}
            className="hidden md:flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Keluar"
          >
            <LogOut className="h-4 w-4" />
          </button>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-4 space-y-2 shadow-lg">
          {['Dashboard', 'Transaksi', 'Laporan', 'Pengaturan'].map((item) => (
            <a
              key={item}
              href="#"
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
            >
              {item}
            </a>
          ))}
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-base font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      )}
    </nav>
  );
};
