import React, { useState, useMemo } from 'react';
import { useDb } from '../context/DbContext';
import { 
  Settings as SettingsIcon, 
  Target, 
  ShoppingBag, 
  Cloud, 
  Trash2, 
  Database,
  Plus,
  Wifi,
  WifiOff,
  AlertTriangle,
  User,
  Key,
  Download,
  Upload,
  Volume2,
  Palette,
  Check
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
    saveProducts,
    saveDailyTarget,
    clearAllData,
    importOrders,
    orders,
    lastUser
  } = useDb();

  // Settings states
  const [newTarget, setNewTarget] = useState(dailyTarget);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  
  // Theme & Personalization
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem('telesales_theme') || 'violet');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('telesales_sound_enabled') !== 'false');

  // Inline User credentials forms (for logging in if not authenticated)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const [notification, setNotification] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

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

  // Handlers
  const handleSaveTarget = (e) => {
    e.preventDefault();
    saveDailyTarget(parseInt(newTarget, 10) || 10);
    triggerNotification('✅ Daily target updated.');
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
    triggerNotification('✅ Product added successfully.');
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
    triggerNotification(`🎨 Theme changed to ${themeId.charAt(0).toUpperCase() + themeId.slice(1)}!`);
  };

  const handleSoundToggle = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem('telesales_sound_enabled', nextVal.toString());
    triggerNotification(nextVal ? '🔊 Chime feedback enabled' : '🔇 Chime feedback muted');
  };

  const handleExportBackup = () => {
    try {
      const backup = {
        exportedAt: new Date().toISOString(),
        exportedAtLocal: new Date().toLocaleString('en-GB'),
        appVersion: 'LearnPlus Telesales v1',
        totalOrders: orders.length,
        orders: orders
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `learnplus_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      triggerNotification(`✅ Backup downloaded! ${orders.length} orders saved.`);
    } catch (e) {
      triggerNotification('❌ Export failed: ' + e.message);
    }
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let parsed = JSON.parse(event.target.result);
        const orderList = Array.isArray(parsed) ? parsed : (parsed.orders || []);
        
        if (!Array.isArray(orderList) || orderList.length === 0) {
          triggerNotification('⚠️ Invalid file: No orders found.');
          return;
        }
        
        const isValid = orderList.every(o => o.name && o.phone && o.date);
        if (!isValid) {
          triggerNotification('⚠️ Invalid structure: missing required fields.');
          return;
        }
        
        const existingMap = new Map(orders.map(o => [o.id, o]));
        let restoredCount = 0;
        let addedCount = 0;
        
        orderList.forEach(backupOrder => {
          if (existingMap.has(backupOrder.id)) {
            existingMap.set(backupOrder.id, { 
              ...existingMap.get(backupOrder.id), 
              status: backupOrder.status, 
              notes: backupOrder.notes || '' 
            });
            restoredCount++;
          } else {
            existingMap.set(backupOrder.id, backupOrder);
            addedCount++;
          }
        });
        
        importOrders(Array.from(existingMap.values()));
        triggerNotification(`✅ Restored! ${restoredCount} updated, ${addedCount} added.`);
      } catch (err) {
        triggerNotification('❌ Failed to read backup: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleUserAuth = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) return;

    try {
      if (isRegistering) {
        await registerWithEmail(loginEmail.trim(), loginPassword.trim());
        triggerNotification('🎉 Account created successfully!');
      } else {
        await loginWithEmail(loginEmail.trim(), loginPassword.trim());
        triggerNotification('🔑 Logged in successfully!');
      }
      setLoginEmail('');
      setLoginPassword('');
    } catch (err) {
      triggerNotification('❌ Error: ' + err.message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle();
      triggerNotification('🔑 Logged in with Google!');
    } catch (err) {
      triggerNotification('❌ Google Error: ' + err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      triggerNotification('🔌 Logged out successfully.');
    } catch (err) {
      triggerNotification('❌ Error: ' + err.message);
    }
  };

  const handlePurge = () => {
    clearAllData();
    setConfirmClear(false);
    triggerNotification('🗑️ All local orders cleared.');
  };

  const triggerNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3500);
  };

  return (
    <div className="app-content animate-slide-up" style={{ paddingBottom: '30px' }}>
      <h2 className="section-title">
        <SettingsIcon size={20} className="text-gradient" />
        Settings & Account
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
        
        {/* 1. Account & Cloud sync status */}
        <div className="glass-card target-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="avatar-initials" style={{ width: '48px', height: '48px', fontSize: '20px', background: 'linear-gradient(135deg, hsl(var(--primary-glow)), hsl(var(--secondary-glow)))', color: 'white', fontWeight: 800 }}>
              {firebaseUser ? firebaseUser.email.charAt(0).toUpperCase() : lastUser.charAt(0).toUpperCase()}
            </div>
            <div style={{ flexGrow: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {firebaseUser ? lastUser : 'Guest User'}
                </h3>
                <span className="feedback-chip active" style={{ fontSize: '9px', padding: '1px 6px', background: 'rgba(139,92,246,0.15)', color: 'hsl(var(--primary-glow))', borderColor: 'rgba(139,92,246,0.2)' }}>
                  {firebaseUser ? 'Synced Profile' : 'Local Mode'}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {firebaseUser ? firebaseUser.email : 'No Cloud account linked'}
              </span>
            </div>
          </div>

          {/* Sync Connection Badge */}
          <div className={`sync-status-indicator ${isFirebaseConnected ? 'sync-connected' : 'sync-disconnected'}`} style={{ padding: '8px 12px', borderRadius: '8px', margin: 0 }}>
            {isFirebaseConnected ? (
              <>
                <Wifi size={14} className={isSyncing ? 'animate-pulse' : ''} />
                <span style={{ fontSize: '11px', fontWeight: 600 }}>Cloud Server Connected & Synced</span>
              </>
            ) : (
              <>
                <WifiOff size={14} />
                <span style={{ fontSize: '11px', fontWeight: 600 }}>Local Offline Sandbox (No cloud sync)</span>
              </>
            )}
          </div>

          {syncError && (
            <div style={{ fontSize: '11px', color: 'var(--status-cancelled)', padding: '6px 10px', background: 'rgba(239,68,68,0.05)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.1)' }}>
              ⚠️ Sync alert: {syncError}
            </div>
          )}

          {/* User Signin/Signout Action Card */}
          <div style={{ borderTop: '1px dashed var(--border-light)', paddingTop: '10px', marginTop: '4px' }}>
            {firebaseUser ? (
              <button 
                type="button" 
                onClick={handleLogout} 
                className="btn-secondary" 
                style={{ width: '100%', padding: '10px', color: 'var(--status-cancelled)', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.03)', fontSize: '12px', fontWeight: 700 }}
              >
                Log Out from Cloud Account
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <form onSubmit={handleUserAuth} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ fontSize: '11px', color: 'white', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {isRegistering ? 'Create Cloud Backup Account' : 'Sign in to sync with Cloud'}
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
                    {isRegistering ? 'Register & Link' : 'Login & Link'}
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
                    ⚡ Login with Google
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Daily Sales Goal */}
        <div className="glass-card settings-section">
          <h3 className="stat-title" style={{ color: 'white' }}>
            <Target size={16} /> Daily Sales Target
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-gray-dark)', marginBottom: '10px' }}>
            Set your daily goal to track achievement percentage on the dashboard.
          </p>
          <form onSubmit={handleSaveTarget} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="number"
              className="input-field"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="e.g. 10"
              style={{ flexGrow: 1, padding: '8px 12px' }}
              min="1"
              required
            />
            <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: '12px', fontWeight: 700 }}>
              Update Goal
            </button>
          </form>
        </div>

        {/* 3. Product Catalog Management */}
        <div className="glass-card settings-section">
          <h3 className="stat-title" style={{ color: 'white' }}>
            <ShoppingBag size={16} /> Product Price Catalog
          </h3>
          <p style={{ fontSize: '11px', color: 'var(--text-gray-dark)', marginBottom: '10px' }}>
            Configure course products and prices to calculate total sales value during parsing.
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
            <Palette size={16} /> Appearance & Personalization
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-gray-light)' }}>Theme Color Color:</span>
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

        {/* 5. Database Backup & Restore */}
        <div className="glass-card settings-section" style={{ border: '1px solid rgba(251, 191, 36, 0.2)', background: 'linear-gradient(135deg, rgba(251,191,36,0.04), rgba(11,15,25,0.8))' }}>
          <h3 className="stat-title" style={{ color: 'white' }}>
            <Database size={16} style={{ color: '#fbbf24' }} /> Database Backup & Restore
          </h3>

          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
            <p style={{ fontSize: '11px', color: '#fbbf24', margin: 0, lineHeight: 1.5, fontWeight: 600 }}>
              Backup your data periodically. You can download the JSON backup file and restore it on any other phone or device.
            </p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Orders in Database</div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: 'white', marginTop: '2px' }}>{orders.length} Logs</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: 'var(--status-confirmed)', fontWeight: 700 }}>✅ {stats.success} Success</div>
              <div style={{ fontSize: '10px', color: 'var(--status-pending)', fontWeight: 700, marginTop: '2px' }}>⏳ {stats.today} Today</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              onClick={handleExportBackup}
              className="btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Download size={15} /> Download Full Backup File ({orders.length} orders)
            </button>

            <label
              className="btn-secondary"
              style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', margin: 0, boxSizing: 'border-box' }}
            >
              <Upload size={15} /> Restore database from backup file
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>

        {/* 6. Danger Zone (Purge Data) */}
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
              onClick={() => setConfirmClear(true)}
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
                  style={{ background: 'var(--status-cancelled)', flexGrow: 1, padding: '8px 12px', fontSize: '12px', fontWeight: 700 }}
                >
                  Yes, Purge Local Orders
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
