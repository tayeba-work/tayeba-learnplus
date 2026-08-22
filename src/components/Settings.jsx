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
  Check,
  CheckCircle,
  FileText
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
    logout,
    saveProducts,
    saveDailyTarget,
    saveFirebaseConfig,
    clearAllData,
    importOrders,
    orders
  } = useDb();

  // Settings internal sub-tabs
  const [subTab, setSubTab] = useState('profile'); // 'profile' or 'credentials'

  // Settings states
  const [newTarget, setNewTarget] = useState(dailyTarget);
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');
  
  // Theme & Personalization
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem('telesales_theme') || 'violet');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('telesales_sound_enabled') !== 'false');

  // Firebase configuration forms
  const [fbApiKey, setFbApiKey] = useState(firebaseConfig?.apiKey || '');
  const [fbAuthDomain, setFbAuthDomain] = useState(firebaseConfig?.authDomain || '');
  const [fbProjectId, setFbProjectId] = useState(firebaseConfig?.projectId || '');
  const [fbStorageBucket, setFbStorageBucket] = useState(firebaseConfig?.storageBucket || '');
  const [fbMessagingSenderId, setFbMessagingSenderId] = useState(firebaseConfig?.messagingSenderId || '');
  const [fbAppId, setFbAppId] = useState(firebaseConfig?.appId || '');

  // User credentials forms
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
      triggerNotification(`✅ Backup downloaded! ${orders.length} orders saved with all statuses.`);
    } catch (e) {
      triggerNotification('❌ Export failed: ' + e.message);
    }
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = ''; // reset input so same file can be re-imported
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let parsed = JSON.parse(event.target.result);
        
        // Support both raw array and our wrapped backup format
        const orderList = Array.isArray(parsed) ? parsed : (parsed.orders || []);
        
        if (!Array.isArray(orderList) || orderList.length === 0) {
          triggerNotification('⚠️ Invalid file: No orders found in backup.');
          return;
        }
        
        const isValid = orderList.every(o => o.name && o.phone && o.date);
        if (!isValid) {
          triggerNotification('⚠️ Invalid file structure: missing required fields.');
          return;
        }
        
        // MERGE: restore existing orders with backed-up statuses, add new ones
        const existingMap = new Map(orders.map(o => [o.id, o]));
        let restoredCount = 0;
        let addedCount = 0;
        
        orderList.forEach(backupOrder => {
          if (existingMap.has(backupOrder.id)) {
            // Update status from backup (restore the saved status)
            existingMap.set(backupOrder.id, { ...existingMap.get(backupOrder.id), status: backupOrder.status, notes: backupOrder.notes });
            restoredCount++;
          } else {
            existingMap.set(backupOrder.id, backupOrder);
            addedCount++;
          }
        });
        
        importOrders(Array.from(existingMap.values()));
        triggerNotification(`✅ Restored! ${restoredCount} statuses updated, ${addedCount} new orders added.`);
      } catch (err) {
        triggerNotification('❌ Failed to read backup: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveFirebase = (e) => {
    e.preventDefault();
    if (!fbApiKey.trim() || !fbProjectId.trim() || !fbAppId.trim()) {
      triggerNotification('⚠️ API Key, Project ID, and App ID are required.');
      return;
    }

    const config = {
      apiKey: fbApiKey.trim(),
      authDomain: fbAuthDomain.trim(),
      projectId: fbProjectId.trim(),
      storageBucket: fbStorageBucket.trim(),
      messagingSenderId: fbMessagingSenderId.trim(),
      appId: fbAppId.trim()
    };

    saveFirebaseConfig(config);
    triggerNotification('⚡ Configuration saved. Ready to log in!');
  };

  const handleDisconnectFirebase = () => {
    saveFirebaseConfig(null);
    setFbApiKey('');
    setFbAuthDomain('');
    setFbProjectId('');
    setFbStorageBucket('');
    setFbMessagingSenderId('');
    setFbAppId('');
    triggerNotification('🔌 Firebase disconnected.');
  };

  const handleUserAuth = async (e) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) return;

    try {
      if (isRegistering) {
        await registerWithEmail(loginEmail.trim(), loginPassword.trim());
        triggerNotification('🎉 Account created and logged in!');
      } else {
        await loginWithEmail(loginEmail.trim(), loginPassword.trim());
        triggerNotification('🔑 Logged in successfully!');
      }
      setLoginEmail('');
      setLoginPassword('');
    } catch (err) {
      console.error("Auth process error:", err);
      triggerNotification('❌ Error: ' + err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      triggerNotification('🔌 Logged out successfully.');
    } catch (err) {
      triggerNotification('❌ Error signing out: ' + err.message);
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
    <div className="app-content animate-slide-up">
      <h2 className="section-title">
        <SettingsIcon size={20} className="text-gradient" />
        Application Settings
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

      {/* Internal Sub-Tabs Navigation */}
      <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.03)', padding: '4px', borderRadius: '12px', marginBottom: '14px', border: '1px solid var(--border-light)' }}>
        <button
          type="button"
          onClick={() => setSubTab('profile')}
          className={`sub-tab-btn ${subTab === 'profile' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '12px',
            fontWeight: 700,
            background: subTab === 'profile' ? 'linear-gradient(135deg, hsl(var(--primary-glow)), hsl(var(--secondary-glow)))' : 'transparent',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.25s ease'
          }}
        >
          👤 Profile Settings
        </button>
        <button
          type="button"
          onClick={() => setSubTab('credentials')}
          className={`sub-tab-btn ${subTab === 'credentials' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: 'none',
            fontSize: '12px',
            fontWeight: 700,
            background: subTab === 'credentials' ? 'linear-gradient(135deg, hsl(var(--primary-glow)), hsl(var(--secondary-glow)))' : 'transparent',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.25s ease'
          }}
        >
          🔒 Cloud Credentials
        </button>
      </div>

      {/* SUB-TAB 1: PROFILE SETTINGS */}
      {subTab === 'profile' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* A. Identity Card */}
          <div className="glass-card target-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="avatar-initials" style={{ width: '48px', height: '48px', fontSize: '20px' }}>
                {firebaseUser ? firebaseUser.email.charAt(0).toUpperCase() : 'T'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'white', margin: 0 }}>
                    {firebaseUser ? firebaseUser.email.split('@')[0] : 'Tayeba Samma'}
                  </h3>
                  <span className="feedback-chip active" style={{ fontSize: '9px', padding: '1px 6px', background: 'rgba(139,92,246,0.15)', color: 'hsl(var(--primary-glow))', borderColor: 'rgba(139,92,246,0.2)' }}>
                    Telesales Pro
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {firebaseUser ? firebaseUser.email : 'Tayeba Samma (Local Sandbox)'}
                </span>
              </div>
            </div>

            {/* Performance Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', borderTop: '1px dashed var(--border-light)', paddingTop: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'white' }}>{stats.total}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Total</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'white' }}>{stats.today}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Today</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--status-confirmed)' }}>{stats.success}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Success</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--status-cancelled)' }}>{stats.cancel}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Cancel</div>
              </div>
            </div>
          </div>

          {/* B. Themes & Sound */}
          <div className="glass-card settings-section">
            <h3 className="stat-title" style={{ color: 'white', marginBottom: '12px' }}>
              <Palette size={16} /> Personalization Settings
            </h3>

            {/* Theme selection dots */}
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

            {/* Sound switch */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px dashed var(--border-light)', paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Volume2 size={16} style={{ color: 'var(--text-gray-light)' }} />
                <div>
                  <div style={{ fontSize: '12px', color: 'white', fontWeight: 600 }}>Dopamine Sound Feedback</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-gray-dark)' }}>Play futuristic beep on successful order</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSoundToggle}
                className={`feedback-chip ${soundEnabled ? 'active' : ''}`}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  background: soundEnabled ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.02)',
                  borderColor: soundEnabled ? '#10b981' : 'var(--border-light)',
                  color: soundEnabled ? '#10b981' : 'var(--text-gray-dark)'
                }}
              >
                {soundEnabled ? 'ENABLED' : 'MUTED'}
              </button>
            </div>
          </div>

          {/* C. Daily Target */}
          <form onSubmit={handleSaveTarget} className="glass-card settings-section">
            <h3 className="stat-title" style={{ color: 'white' }}>
              <Target size={16} /> Daily Sales Target
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                className="input-field"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="Orders target per day"
                min="1"
              />
              <button type="submit" className="btn-primary" style={{ padding: '12px 16px' }}>Save Target</button>
            </div>
          </form>

          {/* D. Product Catalog */}
          <div className="glass-card settings-section">
            <h3 className="stat-title" style={{ color: 'white' }}>
              <ShoppingBag size={16} /> Product Directory
            </h3>
            
            {/* Products List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto', marginBottom: '10px', paddingRight: '4px' }}>
              {products.map(p => (
                <div className="product-row-item animate-fade-in" key={p.id} style={{ padding: '6px 10px', borderRadius: '10px' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: 'white' }}>{p.name}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="feedback-chip active" style={{ fontSize: '10px', background: 'rgba(16,185,129,0.08)', color: '#10b981', borderColor: 'rgba(16,185,129,0.12)' }}>
                      {p.price.toLocaleString()} TK
                    </span>
                    <button 
                      type="button" 
                      onClick={() => handleDeleteProduct(p.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--status-cancelled)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                      title="Delete Product"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Product Form */}
            <form onSubmit={handleAddProduct} className="product-add-form" style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                className="input-field"
                style={{ fontSize: '12px', padding: '8px 10px', flex: 2 }}
                placeholder="Product Name"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                required
              />
              <input
                type="number"
                className="input-field"
                style={{ fontSize: '12px', padding: '8px 10px', flex: 1 }}
                placeholder="Price"
                value={newProdPrice}
                onChange={(e) => setNewProdPrice(e.target.value)}
                required
              />
              <button type="submit" className="btn-primary" style={{ padding: '8px 12px' }} title="Add product">
                <Plus size={16} />
              </button>
            </form>
          </div>

          {/* E. JSON Backup Operations */}
          <div className="glass-card settings-section" style={{ border: '1px solid rgba(251, 191, 36, 0.2)', background: 'linear-gradient(135deg, rgba(251,191,36,0.04), rgba(11,15,25,0.8))' }}>
            <h3 className="stat-title" style={{ color: 'white' }}>
              <Database size={16} style={{ color: '#fbbf24' }} /> 💾 Data Backup & Restore
            </h3>

            {/* Warning banner */}
            <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
              <p style={{ fontSize: '11px', color: '#fbbf24', margin: 0, lineHeight: 1.5, fontWeight: 600 }}>
                Firebase setup করার আগে অবশ্যই একটা Backup নিন। নতুন Google account-এ login করলে local data দেখা যাবে না।
              </p>
            </div>

            {/* Current data summary */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Current Database</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: 'white', marginTop: '2px' }}>{orders.length} Orders</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '10px', color: 'var(--status-confirmed)', fontWeight: 700 }}>✅ {orders.filter(o => ['confirmed','shipped','delivered'].includes(o.status)).length} Successful</div>
                <div style={{ fontSize: '10px', color: 'var(--status-pending)', fontWeight: 700, marginTop: '2px' }}>⏳ {orders.filter(o => o.status === 'pending').length} Pending</div>
                <div style={{ fontSize: '10px', color: 'var(--status-cancelled)', fontWeight: 700, marginTop: '2px' }}>❌ {orders.filter(o => ['cancelled','returned'].includes(o.status)).length} Cancelled</div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={handleExportBackup}
                className="btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Download size={15} /> Download Full Backup ({orders.length} orders + statuses)
              </button>

              <label
                className="btn-secondary"
                style={{ width: '100%', padding: '12px', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', margin: 0, boxSizing: 'border-box' }}
              >
                <Upload size={15} /> Restore from Backup File
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
              Restore করলে আপনার সব status ফিরে আসবে। নতুন orders add হবে, পুরোনো কিছু মুছবে না।
            </p>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: DATABASE & CLOUD CREDENTIALS */}
      {subTab === 'credentials' && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* A. Firebase Cloud Sync / Connection Badge */}
          <div className="glass-card settings-section">
            <h3 className="stat-title" style={{ color: 'white' }}>
              <Cloud size={16} /> Firebase Cloud Database status
            </h3>
            
            {firebaseConfig ? (
              <div className={`sync-status-indicator ${firebaseUser ? 'sync-connected' : 'sync-disconnected'}`} style={{ margin: '8px 0', padding: '10px' }}>
                {firebaseUser ? (
                  <>
                    <Wifi size={16} className={isSyncing ? 'animate-pulse' : ''} />
                    <div>
                      <strong style={{ fontSize: '12px', display: 'block' }}>Cloud Server Connected</strong>
                      <span style={{ fontSize: '10px', opacity: 0.8 }}>Syncing database logs under UID: {firebaseUser.uid.substring(0, 10)}...</span>
                    </div>
                  </>
                ) : (
                  <>
                    <WifiOff size={16} />
                    <div>
                      <strong style={{ fontSize: '12px', display: 'block' }}>Firebase Active, Offline Mode</strong>
                      <span style={{ fontSize: '10px', opacity: 0.8 }}>Please sign in below to sync orders.</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="sync-status-indicator sync-disconnected" style={{ margin: '8px 0', padding: '10px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-gray-dark)', borderColor: 'var(--border-light)' }}>
                <WifiOff size={16} />
                <div>
                  <strong style={{ fontSize: '12px', display: 'block', color: 'var(--text-muted)' }}>Local Sandbox Active</strong>
                  <span style={{ fontSize: '10px' }}>No Firebase config loaded. Setup Firebase credentials below to sync.</span>
                </div>
              </div>
            )}

            {syncError && (
              <div style={{ fontSize: '12px', color: 'var(--status-cancelled)', padding: '8px 12px', background: 'rgba(239,68,68,0.05)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.1)', marginTop: '8px' }}>
                ⚠️ Sync Error: {syncError}
              </div>
            )}
          </div>

          {/* B. Firebase Login/Register Form */}
          {firebaseConfig && (
            <div className="glass-card settings-section">
              <h3 className="stat-title" style={{ color: 'white', marginBottom: '12px' }}>
                <User size={16} /> Cloud User Authentication
              </h3>

              {firebaseUser ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-gray-light)', background: 'rgba(16, 185, 129, 0.05)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(16,185,129,0.1)' }}>
                    🎯 Signed in securely as <strong>{firebaseUser.email}</strong>. Data automatically uploads to cloud.
                  </div>
                  <button type="button" onClick={handleLogout} className="btn-secondary" style={{ width: '100%', padding: '10px', color: 'var(--status-cancelled)', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.03)' }}>
                    Disconnect Profile (Log Out)
                  </button>
                </div>
              ) : (
                <form onSubmit={handleUserAuth} className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ fontSize: '12px', color: 'white', fontWeight: 700, marginBottom: '2px' }}>
                    {isRegistering ? 'Create New Telesales Account' : 'Sign In to Cloud Database'}
                  </h4>
                  
                  <div className="field-group">
                    <span className="field-label" style={{ fontSize: '9px' }}><User size={8} /> Email</span>
                    <input
                      type="email"
                      className="input-field"
                      style={{ padding: '8px 10px', fontSize: '12px' }}
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="name@gmail.com"
                      required
                    />
                  </div>
                  
                  <div className="field-group">
                    <span className="field-label" style={{ fontSize: '9px' }}><Key size={8} /> Password</span>
                    <input
                      type="password"
                      className="input-field"
                      style={{ padding: '8px 10px', fontSize: '12px' }}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Password"
                      required
                    />
                  </div>

                  <button type="submit" className="btn-primary" style={{ padding: '10px', fontSize: '12px', marginTop: '4px' }}>
                    {isRegistering ? 'Create Account & Connect' : 'Log In & Connect'}
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setIsRegistering(!isRegistering)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-gray-dark)', fontSize: '11px', textDecoration: 'underline', cursor: 'pointer', marginTop: '2px' }}
                  >
                    {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Create one'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* C. Firebase Config Setup */}
          <div className="glass-card settings-section">
            <h3 className="stat-title" style={{ color: 'white', marginBottom: '12px' }}>
              <Key size={16} /> Firebase Project Credentials
            </h3>
            
            <form onSubmit={handleSaveFirebase} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="field-group">
                <span className="field-label" style={{ fontSize: '9px' }}>Firebase API Key *</span>
                <input
                  type="password"
                  className="input-field"
                  style={{ padding: '8px 10px', fontSize: '12px' }}
                  value={fbApiKey}
                  onChange={(e) => setFbApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  required
                />
              </div>
              
              <div className="field-group">
                <span className="field-label" style={{ fontSize: '9px' }}>Project ID *</span>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '8px 10px', fontSize: '12px' }}
                  value={fbProjectId}
                  onChange={(e) => setFbProjectId(e.target.value)}
                  placeholder="project-12345"
                  required
                />
              </div>
              
              <div className="field-group">
                <span className="field-label" style={{ fontSize: '9px' }}>App ID *</span>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '8px 10px', fontSize: '12px' }}
                  value={fbAppId}
                  onChange={(e) => setFbAppId(e.target.value)}
                  placeholder="1:123:web:123"
                  required
                />
              </div>
              
              <details style={{ margin: '2px 0' }}>
                <summary style={{ fontSize: '10px', color: 'var(--text-gray-dark)', cursor: 'pointer', outline: 'none' }}>Optional Config Parameters</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', paddingLeft: '8px', borderLeft: '1px solid var(--border-light)' }}>
                  <div className="field-group">
                    <span className="field-label" style={{ fontSize: '9px' }}>Auth Domain</span>
                    <input
                      type="text"
                      className="input-field"
                      style={{ padding: '8px 10px', fontSize: '12px' }}
                      value={fbAuthDomain}
                      onChange={(e) => setFbAuthDomain(e.target.value)}
                      placeholder="project-12345.firebaseapp.com"
                    />
                  </div>
                  <div className="field-group">
                    <span className="field-label" style={{ fontSize: '9px' }}>Storage Bucket</span>
                    <input
                      type="text"
                      className="input-field"
                      style={{ padding: '8px 10px', fontSize: '12px' }}
                      value={fbStorageBucket}
                      onChange={(e) => setFbStorageBucket(e.target.value)}
                      placeholder="project-12345.appspot.com"
                    />
                  </div>
                  <div className="field-group">
                    <span className="field-label" style={{ fontSize: '9px' }}>Messaging Sender ID</span>
                    <input
                      type="text"
                      className="input-field"
                      style={{ padding: '8px 10px', fontSize: '12px' }}
                      value={fbMessagingSenderId}
                      onChange={(e) => setFbMessagingSenderId(e.target.value)}
                      placeholder="9876543210"
                    />
                  </div>
                </div>
              </details>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button type="submit" className="btn-primary" style={{ flexGrow: 1, padding: '8px', fontSize: '12px' }}>
                  Save Config
                </button>
                {firebaseConfig && (
                  <button 
                    type="button" 
                    onClick={handleDisconnectFirebase} 
                    className="btn-secondary" 
                    style={{ color: 'var(--status-cancelled)', padding: '8px', fontSize: '12px' }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* D. Database Purge / Data Management */}
          <div className="glass-card settings-section" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <h3 className="stat-title" style={{ color: 'var(--status-cancelled)' }}>
              <Database size={16} /> Data Management
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-gray-dark)', marginBottom: '10px' }}>
              Purge all order logs stored locally on this browser. This does not delete data from Firebase if connected.
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
                  padding: '10px'
                }}
              >
                Clear Stored Orders ({orders.length})
              </button>
            ) : (
              <div className="glass-card animate-fade-in" style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '12px', border: '1px solid var(--status-cancelled)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>
                  <AlertTriangle size={15} style={{ color: 'var(--status-cancelled)' }} />
                  Are you sure? This cannot be undone!
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    onClick={handlePurge} 
                    className="btn-primary" 
                    style={{ background: 'var(--status-cancelled)', flexGrow: 1, padding: '8px 12px', fontSize: '12px' }}
                  >
                    Yes, Purge Data
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
      )}
    </div>
  );
};

export default Settings;
