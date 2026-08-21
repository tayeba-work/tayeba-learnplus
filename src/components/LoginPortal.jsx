import React, { useState } from 'react';
import { useDb } from '../context/DbContext';
import { 
  Key, 
  User, 
  Sparkles, 
  AlertCircle, 
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Smartphone
} from 'lucide-react';

const LoginPortal = ({ onBypass }) => {
  const { 
    loginWithEmail, 
    registerWithEmail, 
    loginWithGoogle,
    resetPassword,
    firebaseConfig,
    isSyncing
  } = useDb();

  const [authMode, setAuthMode] = useState('login'); // 'login', 'register', 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      if (authMode === 'login') {
        if (!password) {
          setErrorMsg('⚠️ Password is required.');
          setLoading(false);
          return;
        }
        await loginWithEmail(email.trim(), password);
      } else if (authMode === 'register') {
        if (password.length < 6) {
          setErrorMsg('⚠️ Password must be at least 6 characters.');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setErrorMsg('⚠️ Passwords do not match.');
          setLoading(false);
          return;
        }
        await registerWithEmail(email.trim(), password);
      } else if (authMode === 'reset') {
        await resetPassword(email.trim());
        setInfoMsg('📧 Password reset email sent. Please check your inbox.');
        setAuthMode('login');
      }
    } catch (err) {
      console.error("Auth error:", err);
      setErrorMsg(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error("Google Auth error:", err);
      setErrorMsg(err.message || 'Google Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-portal-overlay animate-fade-in">
      <div className="glass-panel login-card animate-slide-up">
        {/* App Title & Branding */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div className="avatar-initials" style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, hsl(var(--primary-glow)), hsl(var(--secondary-glow)))' }}>
              <Smartphone size={20} />
            </div>
            <h1 className="app-title text-glow" style={{ fontSize: '24px', fontWeight: 800 }}>
              Learn<span className="text-gradient">Plus</span>
            </h1>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-gray-dark)', fontWeight: 500 }}>
            Super Advanced Telesales & Text Parsing Engine
          </p>
        </div>

        {/* Dynamic Alerts */}
        {errorMsg && (
          <div className="glass-card auth-alert error animate-fade-in" style={{ borderLeft: '4px solid var(--status-cancelled)', background: 'rgba(239, 68, 68, 0.08)', padding: '10px 12px', marginBottom: '16px', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <AlertCircle size={16} style={{ color: 'var(--status-cancelled)', flexShrink: 0, marginTop: '2px' }} />
            <span style={{ fontSize: '11.5px', color: 'white', lineHeight: '1.4' }}>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="glass-card auth-alert info animate-fade-in" style={{ borderLeft: '4px solid #10b981', background: 'rgba(16, 185, 129, 0.08)', padding: '10px 12px', marginBottom: '16px', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <ShieldAlert size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
            <span style={{ fontSize: '11.5px', color: 'white', lineHeight: '1.4' }}>{infoMsg}</span>
          </div>
        )}

        {/* Email & Password Authentication Form */}
        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {/* Form Title */}
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
            {authMode === 'login' && 'Log In to Portal'}
            {authMode === 'register' && 'Create Sales Profile'}
            {authMode === 'reset' && 'Reset Secure Password'}
          </h2>

          <div className="field-group">
            <span className="field-label" style={{ fontSize: '10px' }}><User size={10} /> Email Address</span>
            <input
              type="email"
              className="input-field"
              placeholder="name@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {authMode !== 'reset' && (
            <div className="field-group">
              <span className="field-label" style={{ fontSize: '10px' }}><Key size={10} /> Secure Password</span>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          {authMode === 'register' && (
            <div className="field-group">
              <span className="field-label" style={{ fontSize: '10px' }}><Key size={10} /> Confirm Password</span>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          {/* Form Actions */}
          <button 
            type="submit" 
            className="btn-primary" 
            style={{ width: '100%', padding: '12px', fontSize: '13px', marginTop: '6px', fontWeight: 700 }}
            disabled={loading}
          >
            {loading ? (
              <span className="animate-pulse">Authenticating Portal...</span>
            ) : (
              <>
                {authMode === 'login' && 'Sign In to Dashboard'}
                {authMode === 'register' && 'Register Sales Profile'}
                {authMode === 'reset' && 'Request Reset Link'}
                <ArrowRight size={14} style={{ marginLeft: '4px' }} />
              </>
            )}
          </button>
        </form>

        {/* Forgot Password Link */}
        {authMode === 'login' && (
          <div style={{ textAlign: 'right', marginTop: '8px' }}>
            <button 
              type="button" 
              onClick={() => setAuthMode('reset')}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-gray-dark)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Forgot password?
            </button>
          </div>
        )}

        {/* Separator */}
        {authMode !== 'reset' && firebaseConfig && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '20px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
            <span style={{ fontSize: '10px', color: 'var(--text-gray-dark)', fontWeight: 700, textTransform: 'uppercase' }}>Or Continue With</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-light)' }} />
          </div>
        )}

        {/* Google Authentication Button */}
        {authMode !== 'reset' && firebaseConfig && (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleGoogleAuth}
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '12px', 
              fontSize: '13px', 
              display: 'inline-flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px',
              fontWeight: 700,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-light)'
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Sign In with Google Account
          </button>
        )}

        {/* Sub Mode Toggles */}
        <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '1px dashed var(--border-light)', paddingTop: '14px' }}>
          {authMode === 'login' ? (
            <span style={{ fontSize: '11.5px', color: 'var(--text-gray-dark)' }}>
              Don't have an account?{' '}
              <button 
                type="button" 
                onClick={() => { setAuthMode('register'); setErrorMsg(''); }}
                style={{ background: 'transparent', border: 'none', color: 'hsl(var(--primary-glow))', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Sign Up Now
              </button>
            </span>
          ) : (
            <span style={{ fontSize: '11.5px', color: 'var(--text-gray-dark)' }}>
              Already registered?{' '}
              <button 
                type="button" 
                onClick={() => { setAuthMode('login'); setErrorMsg(''); }}
                style={{ background: 'transparent', border: 'none', color: 'hsl(var(--primary-glow))', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Back to Sign In
              </button>
            </span>
          )}
        </div>

        {/* Bypass Sandbox Button (Extremely Smart Bypass UX) */}
        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <button
            type="button"
            onClick={onBypass}
            style={{ 
              background: 'rgba(139, 92, 246, 0.05)', 
              border: '1px solid rgba(139, 92, 246, 0.15)',
              borderRadius: '10px',
              padding: '6px 12px',
              color: 'hsl(var(--primary-glow))',
              fontSize: '10.5px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s ease'
            }}
          >
            <Sparkles size={11} /> Proceed to Offline Local Sandbox Mode
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPortal;
