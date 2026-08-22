import React, { useState, useMemo, useEffect } from 'react';
import { useDb } from '../context/DbContext';
import { 
  Settings as SettingsIcon, 
  Target, 
  ShoppingBag, 
  Trash2, 
  Plus,
  Wifi,
  WifiOff,
  AlertTriangle,
  User,
  Key,
  Volume2,
  Palette,
  Check,
  Camera
} from 'lucide-react';

const Settings = () => {
  const {
    products,
    dailyTarget,
    firebaseConfig,
    isFirebaseConnected,
    firebaseUser,
    isSyncing,
    syncError,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    logout,
    updateUserProfile,
    userProfile,
    saveProducts,
    saveDailyTarget,
    saveMonthlyTarget,
    clearAllData,
    orders,
    monthlyTarget
  } = useDb();

  // Profile configuration states
  const [profileName, setProfileName] = useState(userProfile.displayName || 'Tayeba Samma');
  const [profilePhone, setProfilePhone] = useState(userProfile.phone || '');
  const [profileRole, setProfileRole] = useState(userProfile.role || 'Sales Executive');

  // General states
  const [newTarget, setNewTarget] = useState(dailyTarget);
  const [newMonthlyTarget, setNewMonthlyTarget] = useState(monthlyTarget);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  
  // Theme & Personalization
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem('telesales_theme') || 'violet');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('telesales_sound_enabled') !== 'false');

  // Inline User credentials forms
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const [notification, setNotification] = useState('');
  
  // Danger zone reset confirmation
  const [confirmClear, setConfirmClear] = useState(false);
  const [resetTimer, setResetTimer] = useState(10); // 10 seconds wait timer

  // Statistics
  const todayStr = new Date().toISOString().split('T')[0];
  const stats = useMemo(() => {
    const todayOrders = orders.filter(o => o.date === todayStr);
    const successfulCount = orders.filter(o => ['confirmed', 'shipped', 'delivered'].includes(o.status)).length;
    const cancelledCount = orders.filter(o => ['cancelled', 'returned'].includes(o.status)).length;
    
    return {
      total: orders.length,
      today: todayOrders.length,
      success: successfulCount,
      cancel: cancelledCount
    };
  }, [orders, todayStr]);

  // Sync state values on profile change
  useEffect(() => {
    if (userProfile) {
      setProfileName(userProfile.displayName || 'Tayeba Samma');
      setProfilePhone(userProfile.phone || '');
      setProfileRole(userProfile.role || 'Sales Executive');
    }
  }, [userProfile]);

  // Count down timer for Danger Zone
  useEffect(() => {
    let interval = null;
    if (confirmClear && resetTimer > 0) {
      interval = setInterval(() => {
        setResetTimer((prev) => prev - 1);
      }, 1000);
    } else if (!confirmClear) {
      setResetTimer(10); // reset back to 10s if cancelled
    }
    return () => clearInterval(interval);
  }, [confirmClear, resetTimer]);

  // Handlers
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await updateUserProfile({
        displayName: profileName.trim(),
        phone: profilePhone.trim(),
        role: profileRole.trim()
      });
      triggerNotification('👤 Profile details updated!');
    } catch (err) {
      triggerNotification('❌ Profile update failed: ' + err.message);
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    triggerNotification('⚙️ Resizing and optimizing photo…');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 250; // Perfect size for circular profile avatar
          let width = img.width;
          let height = img.height;

          // Scale maintaining aspect ratio
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 85% quality (reduces 5MB phone photos to ~20KB instantly!)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);

          await updateUserProfile({ avatar: compressedBase64 });
          triggerNotification('📸 Profile picture updated and optimized!');
        } catch (err) {
          console.error('[AvatarOptimizationError]', err);
          triggerNotification('❌ Photo processing failed: ' + err.message);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };


  const handleSaveTarget = (e) => {
    e.preventDefault();
    saveDailyTarget(parseInt(newTarget, 10) || 10);
    saveMonthlyTarget(parseInt(newMonthlyTarget, 10) || 300);
    triggerNotification('🎯 Sales goals updated.');
  };

  const handleAddProduct = (e) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrice) return;
    
    const newProd = {
      id: Date.now().toString(),
      name: newProdName.trim(),
      price: parseInt(newProdPrice, 10) || 0
    };

    saveProducts([...products, newProd]);
    setNewProdName('');
    setNewProdPrice('');
    triggerNotification('✅ Product added to catalog.');
  };

  const handleDeleteProduct = (prodId) => {
    const filtered = products.filter(p => p.id !== prodId);
    saveProducts(filtered);
    triggerNotification('🗑️ Product deleted.');
  };

  const handleThemeChange = (themeId) => {
    setActiveTheme(themeId);
    const themes = {
      violet: { primary: '262 83% 58%', secondary: '291 91% 65%' },
      emerald: { primary: '142 70% 45%', secondary: '160 84% 39%' },
      cyan: { primary: '190 90% 45%', secondary: '210 95% 55%' },
      sunset: { primary: '15 95% 55%', secondary: '345 90% 55%' }
    };
    const t = themes[themeId];
    document.documentElement.style.setProperty('--primary-glow', t.primary);
    document.documentElement.style.setProperty('--secondary-glow', t.secondary);
    localStorage.setItem('telesales_theme', themeId);
    triggerNotification(`🎨 Color scheme changed!`);
  };

  const handleSoundToggle = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem('telesales_sound_enabled', nextVal.toString());
    triggerNotification(nextVal ? '🔊 Audio feedback enabled' : '🔇 Audio feedback muted');
  };

  const handleUserAuth = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) return;

    try {
      if (isRegistering) {
        await registerWithEmail(loginEmail.trim(), loginPassword.trim());
        triggerNotification('🎉 Account registered successfully!');
      } else {
        await loginWithEmail(loginEmail.trim(), loginPassword.trim());
        triggerNotification('🔑 Logged in successfully!');
      }
      setLoginEmail('');
      setLoginPassword('');
    } catch (err) {
      triggerNotification('❌ Sign-in failed: ' + err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle();
      triggerNotification('🔑 Logged in with Google!');
    } catch (err) {
      triggerNotification('❌ Sign-in failed: ' + err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      triggerNotification('🔌 Signed out successfully.');
    } catch (err) {
      triggerNotification('❌ Sign-out failed: ' + err.message);
    }
  };

  const handlePurge = () => {
    clearAllData();
    setConfirmClear(false);
    triggerNotification('🗑️ Database completely reset.');
  };

  const triggerNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3500);
  };

  return (
    <div className="app-content animate-slide-up" style={{ paddingBottom: '30px' }}>
      <h2 className="section-title">
        <SettingsIcon size={20} className="text-gradient" />
        My Settings
      </h2>

      {notification && (
        <div 
          className="glass-card animate-fade-in" 
          style={{ 
            padding: '10px', 
            background: 'rgba(139, 92, 246, 0.15)',
            color: 'white',
            fontWeight: 700,
            fontSize: '12px',
            textAlign: 'center',
            border: '1px solid hsl(var(--primary-glow))',
            borderRadius: '12px',
            marginBottom: '12px'
          }}
        >
          {notification}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* 1. Sleek Account Profile Settings Panel */}
        <div className="glass-card target-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          <h3 className="stat-title" style={{ color: 'white', fontSize: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', marginBottom: '4px' }}>
            👤 Profile & Identity
          </h3>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            
            {/* Avatar Selector */}
            <div style={{ position: 'relative', width: '70px', height: '70px', flexShrink: 0 }}>
              {userProfile.avatar ? (
                <img 
                  src={userProfile.avatar} 
                  alt="Profile" 
                  style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '2.5px solid hsl(var(--primary-glow))' }}
                />
              ) : (
                <div 
                  style={{ 
                    width: '70px', 
                    height: '70px', 
                    borderRadius: '50%', 
                    background: 'linear-gradient(135deg, hsl(var(--primary-glow)), hsl(var(--secondary-glow)))',
                    color: 'white',
                    fontSize: '26px',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2.5px solid hsl(var(--primary-glow))',
                    textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  {profileName.charAt(0).toUpperCase()}
                </div>
              )}
              
              {/* Photo Upload Trigger Icon overlay */}
              <label 
                style={{ 
                  position: 'absolute', 
                  bottom: '-2px', 
                  right: '-2px', 
                  background: 'hsl(var(--primary-glow))', 
                  color: 'white', 
                  borderRadius: '50%', 
                  width: '24px', 
                  height: '24px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer',
                  border: '2px solid #0b0f19',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  transition: 'transform 0.2s ease'
                }}
                className="hover-scale"
                title="Change Photo"
              >
                <Camera size={12} />
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleAvatarUpload} 
                  style={{ display: 'none' }} 
                />
              </label>
            </div>

            {/* Sync Badge and Description */}
            <div style={{ flexGrow: 1, minWidth: '150px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'white' }}>{profileName}</span>
                <span className="feedback-chip active" style={{ fontSize: '9px', padding: '1px 6px', background: 'rgba(16,185,129,0.1)', color: '#10b981', borderColor: 'rgba(16,185,129,0.15)' }}>
                  {firebaseUser ? 'Connected Account' : 'Guest Profile'}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                {firebaseUser ? firebaseUser.email : 'Your data is currently saved on this phone only'}
              </span>
            </div>
          </div>

          {/* Sync Status Badge */}
          <div className={`sync-status-indicator ${isFirebaseConnected ? 'sync-connected' : 'sync-disconnected'}`} style={{ padding: '8px 12px', borderRadius: '8px', margin: 0, border: '1px solid rgba(255,255,255,0.03)' }}>
            {isFirebaseConnected ? (
              <>
                <Wifi size={14} className={isSyncing ? 'animate-pulse' : ''} style={{ color: '#10b981' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981' }}>✓ Your data is secure in Cloud</span>
              </>
            ) : (
              <>
                <WifiOff size={14} style={{ color: 'var(--text-gray-dark)' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Offline (Saved locally on this phone)</span>
              </>
            )}
          </div>

          {syncError && (
            <div style={{ fontSize: '11px', color: 'var(--status-cancelled)', padding: '6px 10px', background: 'rgba(239,68,68,0.05)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.1)' }}>
              ⚠️ Sync Notice: {syncError}
            </div>
          )}

          {/* Profile Editing Form */}
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            <div className="field-group">
              <span className="field-label" style={{ fontSize: '9px' }}>Full Name</span>
              <input
                type="text"
                className="input-field"
                style={{ padding: '8px 10px', fontSize: '12px' }}
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Full Name"
                required
              />
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <div className="field-group" style={{ flex: 1 }}>
                <span className="field-label" style={{ fontSize: '9px' }}>Phone Number</span>
                <input
                  type="tel"
                  className="input-field"
                  style={{ padding: '8px 10px', fontSize: '12px' }}
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                />
              </div>
              <div className="field-group" style={{ flex: 1 }}>
                <span className="field-label" style={{ fontSize: '9px' }}>Role / Designation</span>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '8px 10px', fontSize: '12px' }}
                  value={profileRole}
                  onChange={(e) => setProfileRole(e.target.value)}
                  placeholder="Sales Representative"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ padding: '10px', fontSize: '12px', fontWeight: 700, marginTop: '2px' }}>
              Save Profile Details
            </button>
          </form>

          {/* User Signin/Signout Action Card */}
          <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '10px', marginTop: '4px' }}>
            {firebaseUser ? (
              <button 
                type="button" 
                onClick={handleLogout} 
                className="btn-secondary" 
                style={{ width: '100%', padding: '10px', color: 'var(--status-cancelled)', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.03)', fontSize: '12px', fontWeight: 700 }}
              >
                Sign Out
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <form onSubmit={handleUserAuth} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ fontSize: '11px', color: 'white', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {isRegistering ? 'Create Backup Account' : 'Sign in to Sync with Cloud'}
                  </h4>
                  <input
                    type="email"
                    className="input-field"
                    style={{ padding: '8px 10px', fontSize: '12px' }}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Email Address"
                    required
                  />
                  <input
                    type="password"
                    className="input-field"
                    style={{ padding: '8px 10px', fontSize: '12px' }}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Password"
                    required
                  />
                  <button type="submit" className="btn-primary" style={{ padding: '9px', fontSize: '12px', fontWeight: 700 }}>
                    {isRegistering ? 'Register & Connect' : 'Login & Connect'}
                  </button>
                </form>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                  <button 
                    type="button" 
                    onClick={() => setIsRegistering(!isRegistering)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                  >
                    {isRegistering ? 'Have account? Sign In' : 'Need account? Create one'}
                  </button>
                  <button 
                    type="button" 
                    onClick={handleGoogleSignIn}
                    style={{ background: 'transparent', border: 'none', color: 'hsl(var(--primary-glow))', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    ⚡ Google Login
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Sales Goal Settings (Daily & Monthly) */}
        <div className="glass-card settings-section">
          <h3 className="stat-title" style={{ color: 'white' }}>
            <Target size={16} /> My Sales Goals
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-gray-dark)', marginBottom: '10px' }}>
            Configure your daily and monthly sales targets to track progress on the dashboard.
          </p>
          <form onSubmit={handleSaveTarget} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="field-group" style={{ flex: 1 }}>
                <span className="field-label" style={{ fontSize: '9px' }}>Daily Target (Orders)</span>
                <input
                  type="number"
                  className="input-field"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  placeholder="e.g. 10"
                  style={{ padding: '8px 10px', fontSize: '12px' }}
                  min="1"
                  required
                />
              </div>
              <div className="field-group" style={{ flex: 1 }}>
                <span className="field-label" style={{ fontSize: '9px' }}>Monthly Target (Orders)</span>
                <input
                  type="number"
                  className="input-field"
                  value={newMonthlyTarget}
                  onChange={(e) => setNewMonthlyTarget(e.target.value)}
                  placeholder="e.g. 300"
                  style={{ padding: '8px 10px', fontSize: '12px' }}
                  min="1"
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ padding: '10px', fontSize: '12px', fontWeight: 700 }}>
              Update Sales Goals
            </button>
          </form>
        </div>

        {/* 3. Product Catalog Management */}
        <div className="glass-card settings-section">
          <h3 className="stat-title" style={{ color: 'white' }}>
            <ShoppingBag size={16} /> My Products
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-gray-dark)', marginBottom: '10px' }}>
            Add course products and set prices to compute total order value automatically when parsing messages.
          </p>

          <form onSubmit={handleAddProduct} style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Product Name"
              value={newProdName}
              onChange={(e) => setNewProdName(e.target.value)}
              style={{ flex: 2, padding: '8px 10px', fontSize: '12px' }}
              required
            />
            <input
              type="number"
              className="input-field"
              placeholder="Price"
              value={newProdPrice}
              onChange={(e) => setNewProdPrice(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', fontSize: '12px' }}
              required
            />
            <button type="submit" className="btn-primary" style={{ padding: '8px 12px' }} title="Add product">
              <Plus size={16} />
            </button>
          </form>

          {/* Product list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxTransit: '200px', overflowY: 'auto' }}>
            {products.map((prod) => (
              <div 
                key={prod.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '8px 10px', 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid var(--border-light)', 
                  borderRadius: '10px' 
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'white' }}>{prod.name}</span>
                  <span style={{ fontSize: '10px', color: 'hsl(var(--primary-glow))', fontWeight: 700 }}>৳ {prod.price}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(prod.id)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-gray-dark)', cursor: 'pointer', padding: '4px' }}
                  title="Delete product"
                >
                  <Trash2 size={14} className="hover-red" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Themes & Customizations */}
        <div className="glass-card settings-section">
          <h3 className="stat-title" style={{ color: 'white', marginBottom: '12px' }}>
            <Palette size={16} /> Colors & Audio
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-gray-light)' }}>Theme Color:</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'violet', color: '#8b5cf6', name: 'Violet' },
                { id: 'emerald', color: '#10b981', name: 'Emerald' },
                { id: 'cyan', color: '#06b6d4', name: 'Cyan' },
                { id: 'sunset', color: '#f97316', name: 'Sunset' },
              ].map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleThemeChange(theme.id)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: theme.color,
                    border: activeTheme === theme.id ? '2px solid white' : '2px solid transparent',
                    boxShadow: activeTheme === theme.id ? `0 0 10px ${theme.color}` : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    padding: 0
                  }}
                  title={theme.name}
                >
                  {activeTheme === theme.id && <Check size={12} style={{ color: 'white' }} />}
                </button>
              ))}
            </div>
          </div>

          {/* Sound toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed var(--border-light)', paddingTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Volume2 size={16} style={{ color: 'var(--text-gray-light)' }} />
              <div>
                <div style={{ fontSize: '12px', color: 'white', fontWeight: 600 }}>Dopamine Audio Feedback</div>
                <div style={{ fontSize: '10px', color: 'var(--text-gray-dark)' }}>Play futuristic chime sound on order updates</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSoundToggle}
              style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                backgroundColor: soundEnabled ? 'hsl(var(--primary-glow))' : 'rgba(255,255,255,0.1)',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background-color 0.25s ease',
                padding: 0
              }}
            >
              <span
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  position: 'absolute',
                  top: '3px',
                  left: soundEnabled ? '19px' : '3px',
                  transition: 'left 0.25s ease'
                }}
              />
            </button>
          </div>
        </div>

        {/* 5. Danger Zone (Purge Data with 10s Timer) */}
        <div className="glass-card settings-section" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <h3 className="stat-title" style={{ color: 'var(--status-cancelled)' }}>
            <AlertTriangle size={16} /> Danger Zone
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-gray-dark)', marginBottom: '10px' }}>
            Purge all order logs stored locally on this device. This does not delete cloud-synchronized data.
          </p>

          {!confirmClear ? (
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={() => {
                setConfirmClear(true);
                setResetTimer(10);
              }}
              style={{ 
                color: 'var(--status-cancelled)', 
                background: 'rgba(239, 68, 68, 0.05)',
                borderColor: 'rgba(239, 68, 68, 0.2)',
                width: '100%',
                padding: '10px',
                fontSize: '12px',
                fontWeight: 700
              }}
            >
              Reset Local Orders ({orders.length})
            </button>
          ) : (
            <div className="glass-card animate-fade-in" style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '12px', border: '1px solid var(--status-cancelled)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>
                <AlertTriangle size={15} style={{ color: 'var(--status-cancelled)' }} />
                This action is permanent! Proceed?
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  onClick={handlePurge} 
                  className="btn-primary" 
                  disabled={resetTimer > 0}
                  style={{ 
                    background: resetTimer > 0 ? '#4b2e2e' : 'var(--status-cancelled)', 
                    color: resetTimer > 0 ? '#94a3b8' : 'white',
                    cursor: resetTimer > 0 ? 'not-allowed' : 'pointer',
                    flexGrow: 1, 
                    padding: '8px 12px', 
                    fontSize: '12px', 
                    fontWeight: 700 
                  }}
                >
                  {resetTimer > 0 ? `Yes, Purge Data (${resetTimer}s)` : 'Yes, Purge Data'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setConfirmClear(false)} 
                  className="btn-secondary"
                  style={{ flexGrow: 1, padding: '8px 12px', fontSize: '12px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Settings;
