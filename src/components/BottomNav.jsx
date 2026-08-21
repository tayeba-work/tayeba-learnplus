import React from 'react';
import { LayoutDashboard, Sparkles, ShoppingBag, Settings } from 'lucide-react';

const BottomNav = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'parser', label: 'Magic Paste', icon: Sparkles },
    { id: 'orders', label: 'Orders List', icon: ShoppingBag },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="bottom-nav-container">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`nav-btn ${isActive ? 'active' : ''}`}
            aria-label={item.label}
          >
            <div className="icon-wrapper">
              <Icon size={20} className={isActive ? 'pulse' : ''} />
            </div>
            <span className="nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
