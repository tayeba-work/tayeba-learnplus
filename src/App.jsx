import React, { useState, useEffect, useRef } from 'react';
import { DbProvider, useDb } from './context/DbContext';
import Dashboard from './components/Dashboard';
import MagicalParser from './components/MagicalParser';
import OrderList from './components/OrderList';
import Settings from './components/Settings';
import BottomNav from './components/BottomNav';
import { Sparkles, PhoneCall, Search, User, X } from 'lucide-react';
import './App.css';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const { firebaseUser, isFirebaseConnected, firebaseConfig, logout } = useDb();

  const dropdownRef = useRef(null);

  // Catch PWA installation prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  // Close profile dropdown when clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showProfileDropdown]);

  const handleHeaderSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    // If the user types anything and is not on the orders list tab, redirect them instantly!
    if (val.trim() !== '' && activeTab !== 'orders') {
      setActiveTab('orders');
    }
  };

  return (
    <div className="app-container animate-fade-in">
      {/* Header with Search and Profile */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <PhoneCall size={18} className="text-gradient" />
          <h1 className="app-title text-glow" style={{ fontSize: '15px', fontWeight: 800 }}>
            Learn<span className="text-gradient">Plus</span>
          </h1>
        </div>

        {/* Super Advanced Header Search Bar */}
        <div className="header-search-wrapper">
          <Search size={12} className="header-search-icon" />
          <input
            type="text"
            className="header-search-input"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={handleHeaderSearchChange}
          />
          {searchQuery && (
            <button 
              type="button" 
              className="header-search-clear" 
              onClick={() => setSearchQuery('')}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Profile Avatar Icon */}
        <div ref={dropdownRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button 
            type="button" 
            className="header-profile-btn" 
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            title="Profile & Settings"
          >
            {firebaseUser ? (
              <div className="avatar-initials">
                {firebaseUser.email.charAt(0).toUpperCase()}
              </div>
            ) : (
              <div className="avatar-initials" style={{ background: 'linear-gradient(135deg, hsl(var(--primary-glow)), hsl(var(--secondary-glow)))', color: 'white', fontWeight: 800 }}>
                T
              </div>
            )}
            <span className={`header-status-dot ${isFirebaseConnected ? 'online' : 'offline'}`} />
          </button>
          
          {showProfileDropdown && (
            <div className="profile-dropdown animate-fade-in" style={{ position: 'absolute', top: '38px', right: 0, zIndex: 999, width: '200px', padding: '12px', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(11, 15, 25, 0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                {/* User Identity Info */}
                <div style={{ paddingBottom: '6px', borderBottom: '1px dashed var(--border-light)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={firebaseUser ? firebaseUser.email : 'Tayeba Samma'}>
                    {firebaseUser ? firebaseUser.email : 'Tayeba Samma'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: isFirebaseConnected ? '#10b981' : '#94a3b8', boxShadow: isFirebaseConnected ? '0 0 4px #10b981' : 'none' }} />
                    <span style={{ fontSize: '9px', color: 'var(--text-gray-dark)', fontWeight: 700 }}>
                      {isFirebaseConnected ? 'Cloud Active' : 'Offline Sandbox'}
                    </span>
                  </div>
                </div>

                {/* Dropdown Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {showInstallBtn && (
                    <button 
                      type="button" 
                      onClick={handleInstallClick}
                      className="dropdown-item-btn"
                      style={{ color: '#10b981', fontWeight: 800, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', marginBottom: '4px' }}
                    >
                      📲 Install Phone App
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={() => { setActiveTab('settings'); setShowProfileDropdown(false); }}
                    className="dropdown-item-btn"
                  >
                    👤 Profile Settings
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setActiveTab('dashboard'); setShowProfileDropdown(false); }}
                    className="dropdown-item-btn"
                  >
                    📊 View Dashboard
                  </button>
                  {firebaseUser ? (
                    <button 
                      type="button" 
                      onClick={() => { logout(); setShowProfileDropdown(false); }}
                      className="dropdown-item-btn"
                      style={{ color: 'var(--status-cancelled)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', marginTop: '4px', borderRadius: 0 }}
                    >
                      🚪 Log Out Cloud
                    </button>
                  ) : (
                    <button 
                      type="button" 
                      onClick={() => { setActiveTab('settings'); setShowProfileDropdown(false); }}
                      className="dropdown-item-btn"
                      style={{ color: 'hsl(var(--primary-glow))', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', marginTop: '4px', borderRadius: 0 }}
                    >
                      🔐 Sign In / Connect
                    </button>
                  )}
                </div>
              </div>
          )}
        </div>
      </header>

      {/* Main Screen Content */}
      <div style={{ flexGrow: 1, overflowY: 'auto', paddingBottom: '12px' }}>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'parser' && <MagicalParser onSaveSuccess={() => setActiveTab('orders')} />}
        {activeTab === 'orders' && <OrderList searchQuery={searchQuery} setSearchQuery={setSearchQuery} />}
        {activeTab === 'settings' && <Settings />}
      </div>

      {/* Floating Action Button for Magic Paste (visible on other tabs) */}
      {activeTab !== 'parser' && (
        <button 
          className="fab-btn" 
          onClick={() => setActiveTab('parser')}
          title="Instant Paste Parser"
          type="button"
        >
          <Sparkles size={22} />
        </button>
      )}

      {/* Bottom Tab Bar Navigation */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

function App() {
  return (
    <DbProvider>
      <AppContent />
    </DbProvider>
  );
}

export default App;
