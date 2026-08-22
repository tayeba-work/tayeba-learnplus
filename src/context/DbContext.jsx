import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs,
  getDoc
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail
} from 'firebase/auth';
import seedOrders from './seed_orders.json';

const DbContext = createContext();
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

const formatUsername = (email) => {
  if (!email) return 'Tayeba Samma';
  if (email.toLowerCase().includes('tayebasam')) {
    return 'Tayeba Samma';
  }
  const part = email.split('@')[0];
  return part
    .split(/[._-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const useDb = () => useContext(DbContext);

export const DbProvider = ({ children }) => {

  // ─── 1. STATE ────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState(() => {
    try { return JSON.parse(localStorage.getItem('telesales_orders') || '[]'); }
    catch { return []; }
  });

  const [products, setProducts] = useState(() => {
    try {
      const s = localStorage.getItem('telesales_products');
      return s ? JSON.parse(s) : [
        { id: '1', name: 'LearnPlus Premium Course', price: 1550 },
        { id: '2', name: 'LearnPlus Interactive Book', price: 1200 },
        { id: '3', name: 'LearnPlus Software Suite', price: 4500 }
      ];
    } catch { return []; }
  });

  const [dailyTarget, setDailyTarget] = useState(() => {
    const s = localStorage.getItem('telesales_daily_target');
    return s ? parseInt(s, 10) : 10;
  });

  // User Profile details (Name, Phone, base64 Avatar)
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const s = localStorage.getItem('telesales_profile');
      return s ? JSON.parse(s) : { displayName: 'Tayeba Samma', phone: '', avatar: null };
    } catch {
      return { displayName: 'Tayeba Samma', phone: '', avatar: null };
    }
  });

  const [firebaseConfig, setFirebaseConfig] = useState(() => {
    if (
      import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID
    ) {
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      return {
        apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
        projectId:         projectId,
        storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        appId:             import.meta.env.VITE_FIREBASE_APP_ID
      };
    }
    try {
      const s = localStorage.getItem('telesales_firebase_config');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });

  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [firebaseUser, setFirebaseUser]   = useState(null);
  const [authReady, setAuthReady]         = useState(false);
  const [isSyncing, setIsSyncing]         = useState(false);
  const [syncError, setSyncError]         = useState('');
  
  // Last logged in username for fast cache load spinner
  const [lastUser, setLastUser] = useState(() => {
    return localStorage.getItem('telesales_last_username') || 'Tayeba Samma';
  });

  const ordersRef = useRef(orders);
  useEffect(() => { ordersRef.current = orders; }, [orders]);

  // ─── 2. LOCAL STORAGE SYNC ────────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem('telesales_orders', JSON.stringify(orders)); } catch {}
  }, [orders]);

  useEffect(() => {
    try { localStorage.setItem('telesales_products', JSON.stringify(products)); } catch {}
  }, [products]);

  useEffect(() => {
    localStorage.setItem('telesales_daily_target', dailyTarget.toString());
  }, [dailyTarget]);

  useEffect(() => {
    try { localStorage.setItem('telesales_profile', JSON.stringify(userProfile)); } catch {}
  }, [userProfile]);

  useEffect(() => {
    if (firebaseConfig) {
      try { localStorage.setItem('telesales_firebase_config', JSON.stringify(firebaseConfig)); } catch {}
    } else {
      localStorage.removeItem('telesales_firebase_config');
    }
  }, [firebaseConfig]);

  // ─── 3. SAFE SEEDER ───────────────────────────────────────────────────────
  useEffect(() => {
    setOrders(prev => {
      const ids   = new Set(prev.map(o => o.id));
      const keys  = new Set(prev.map(o => `${o.phone}__${o.date}`));
      const fresh = seedOrders.filter(s => !ids.has(s.id) && !keys.has(`${s.phone}__${s.date}`));
      if (!fresh.length) return prev;
      return [...prev, ...fresh];
    });
  }, []);

  // ─── 4. THEME ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = localStorage.getItem('telesales_theme') || 'violet';
    const map = {
      violet:  ['262 83% 58%', '291 91% 65%'],
      emerald: ['142 70% 45%', '160 84% 39%'],
      cyan:    ['190 90% 45%', '210 95% 55%'],
      sunset:  ['15 95% 55%',  '345 90% 55%']
    };
    const [p, s] = map[t] || map.violet;
    document.documentElement.style.setProperty('--primary-glow', p);
    document.documentElement.style.setProperty('--secondary-glow', s);
  }, []);

  // ─── 5. FIREBASE INIT + SYNC ──────────────────────────────────────────────
  useEffect(() => {
    if (!firebaseConfig) {
      setIsFirebaseConnected(false);
      setFirebaseUser(null);
      setIsSyncing(false);
      setAuthReady(true);
      return;
    }

    let unsubAuth     = null;
    let unsubSnapshot = null;
    setIsSyncing(true);
    setSyncError('');

    const run = async () => {
      try {
        const defaultApp = getApps().find(a => a.name === '[DEFAULT]');
        if (defaultApp) await deleteApp(defaultApp);

        const cfg = {
          ...firebaseConfig,
          authDomain:    firebaseConfig.authDomain    || `${firebaseConfig.projectId}.firebaseapp.com`,
          storageBucket: firebaseConfig.storageBucket || `${firebaseConfig.projectId}.appspot.com`
        };

        const app  = initializeApp(cfg); 
        const db   = getFirestore(app);
        const auth = getAuth(app);

        try {
          const redirectResult = await getRedirectResult(auth);
          if (redirectResult?.user) {
            console.log('[Firebase] Redirect result resolved user:', redirectResult.user.email);
            setFirebaseUser({ uid: redirectResult.user.uid, email: redirectResult.user.email });
            setIsFirebaseConnected(true);
          }
        } catch (redirectErr) {
          console.error('[Firebase] Redirect error:', redirectErr);
          if (redirectErr.code === 'auth/web-storage-unsupported') {
            setSyncError('Browser blocks storage. Please use Email/Password sign-in.');
          } else {
            setSyncError('Google Login failed: ' + redirectErr.message);
          }
        }

        unsubAuth = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setIsFirebaseConnected(true);
            setFirebaseUser({ uid: user.uid, email: user.email });
            setAuthReady(true);
            setSyncError('');

            // Sync User Profile details from cloud if available
            try {
              const uDoc = await getDoc(doc(db, 'users', user.uid));
              if (uDoc.exists() && uDoc.data().profile) {
                const cloudProfile = uDoc.data().profile;
                setUserProfile(cloudProfile);
                localStorage.setItem('telesales_profile', JSON.stringify(cloudProfile));
                if (cloudProfile.displayName) {
                  setLastUser(cloudProfile.displayName);
                  localStorage.setItem('telesales_last_username', cloudProfile.displayName);
                }
              } else {
                // If cloud doesn't have a profile yet, seed it with our local state
                await setDoc(doc(db, 'users', user.uid), { profile: userProfile }, { merge: true });
              }
            } catch (pErr) {
              console.warn('[Firebase] Load profile error:', pErr.message);
            }

            const colRef = collection(db, 'users', user.uid, 'orders');

            // Sync local orders to cloud if Firestore empty
            try {
              const snap = await getDocs(colRef);
              if (snap.empty && ordersRef.current.length > 0) {
                const batch = writeBatch(db);
                ordersRef.current.forEach(o => batch.set(doc(colRef, o.id), o));
                await batch.commit();
                console.log('[Firebase] Initial upload done:', ordersRef.current.length, 'orders');
              }
            } catch (e) {
              console.warn('[Firebase] Initial upload failed:', e.message);
            }

            if (unsubSnapshot) unsubSnapshot();

            unsubSnapshot = onSnapshot(colRef, (snap) => {
              const toUpload = [];

              setOrders(prev => {
                const map = new Map(prev.map(o => [o.id, o]));
                let changed = false;

                snap.forEach(d => {
                  const remote = { id: d.id, ...d.data() };
                  const local  = map.get(remote.id);
                  if (!local) {
                    map.set(remote.id, remote); changed = true;
                  } else if ((remote.lastUpdated || 0) > (local.lastUpdated || 0)) {
                    map.set(remote.id, remote); changed = true;
                  } else if ((local.lastUpdated || 0) > (remote.lastUpdated || 0)) {
                    toUpload.push(local);
                  }
                });

                return changed ? Array.from(map.values()) : prev;
              });

              toUpload.forEach(o =>
                setDoc(doc(colRef, o.id), o).catch(e =>
                  console.warn('[Firebase] push stale order:', e.message)
                )
              );

              setIsSyncing(false);
            }, (err) => {
              console.error('[Firestore]', err);
              setSyncError(
                err.code === 'permission-denied'
                  ? 'Permission denied — check database rules.'
                  : 'Sync error: ' + err.message
              );
              setIsSyncing(false);
            });

          } else {
            setIsFirebaseConnected(false);
            setFirebaseUser(null);
            setIsSyncing(false);
            setAuthReady(true);
            if (unsubSnapshot) { unsubSnapshot(); unsubSnapshot = null; }
          }
        }, (err) => {
          console.error('[Auth]', err);
          setSyncError('Auth error: ' + err.message);
          setIsSyncing(false);
          setAuthReady(true);
        });

      } catch (err) {
        console.error('[Firebase init]', err);
        setSyncError('Firebase init failed: ' + err.message);
        setIsFirebaseConnected(false);
        setIsSyncing(false);
        setAuthReady(true);
      }
    };

    run();

    return () => {
      if (unsubAuth)     unsubAuth();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [firebaseConfig]);

  // ─── 6. AUTH ──────────────────────────────────────────────────────────────
  const getDefaultApp = () => {
    const app = getApps().find(a => a.name === '[DEFAULT]');
    if (!app) throw new Error('Firebase not initialized.');
    return app;
  };

  const loginWithEmail    = (email, pw) => signInWithEmailAndPassword(getAuth(getDefaultApp()), email, pw);
  const registerWithEmail = (email, pw) => createUserWithEmailAndPassword(getAuth(getDefaultApp()), email, pw);
  const logout            = ()          => signOut(getAuth(getDefaultApp()));
  
  const loginWithGoogle   = async () => {
    const auth = getAuth(getDefaultApp());
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      await signInWithPopup(auth, provider);
    } catch (popupErr) {
      console.warn('[Firebase] Popup sign-in blocked or failed, falling back to redirect:', popupErr);
      if (
        popupErr.code === 'auth/popup-blocked' || 
        popupErr.code === 'auth/popup-closed-by-user' ||
        popupErr.code === 'auth/cancelled-popup-request'
      ) {
        await signInWithRedirect(auth, provider);
      } else {
        throw popupErr;
      }
    }
  };
  
  const resetPassword     = (email)     => sendPasswordResetEmail(getAuth(getDefaultApp()), email);

  // ─── 7. PROFILE UPDATE ─────────────────────────────────────────────────────
  const updateUserProfile = async (fields) => {
    const updated = { ...userProfile, ...fields };
    setUserProfile(updated);
    localStorage.setItem('telesales_profile', JSON.stringify(updated));

    if (fields.displayName) {
      setLastUser(fields.displayName);
      localStorage.setItem('telesales_last_username', fields.displayName);
    }

    if (isFirebaseConnected && firebaseUser) {
      try {
        const app = getDefaultApp();
        const db = getFirestore(app);
        await setDoc(doc(db, 'users', firebaseUser.uid), { profile: updated }, { merge: true });
        console.log('[Firebase] Profile synced successfully.');
      } catch (e) {
        console.warn('[Firebase] Sync profile failed:', e.message);
      }
    }
  };

  // ─── 8. DB OPERATIONS ─────────────────────────────────────────────────────
  const colRef = () => {
    const app = getApps().find(a => a.name === '[DEFAULT]');
    if (!app || !firebaseUser) return null;
    return collection(getFirestore(app), 'users', firebaseUser.uid, 'orders');
  };

  const addOrder = async (data) => {
    const order = {
      id: generateId(), name: data.name || '', phone: data.phone || '',
      address: data.address || '', productName: data.productName || '',
      price: data.price ? parseInt(data.price, 10) : 0,
      status: data.status || 'pending', notes: data.notes || '',
      date: data.date || new Date().toISOString().split('T')[0],
      createdAt: Date.now(), lastUpdated: Date.now()
    };
    setOrders(prev => [order, ...prev]);
    const ref = colRef();
    if (ref) setDoc(doc(ref, order.id), order).catch(console.warn);
  };

  const updateOrder = async (id, fields) => {
    const ts = Date.now();
    let updated = null;
    setOrders(prev => prev.map(o => {
      if (o.id !== id) return o;
      updated = { ...o, ...fields, price: fields.price !== undefined ? parseInt(fields.price, 10) || 0 : o.price, lastUpdated: ts };
      return updated;
    }));
    const ref = colRef();
    if (ref && updated) setDoc(doc(ref, id), updated).catch(console.warn);
  };

  const bulkUpdateOrders = async (ids, fields) => {
    if (!ids?.length) return;
    const ts = Date.now();
    setOrders(prev => prev.map(o =>
      ids.includes(o.id)
        ? { ...o, ...fields, price: fields.price !== undefined ? parseInt(fields.price, 10) || 0 : o.price, lastUpdated: ts }
        : o
    ));
    const ref = colRef();
    if (!ref) return;
    const batch = writeBatch(getFirestore(getDefaultApp()));
    ordersRef.current.forEach(o => {
      if (!ids.includes(o.id)) return;
      const updated = { ...o, ...fields, price: fields.price !== undefined ? parseInt(fields.price, 10) || 0 : o.price, lastUpdated: ts };
      batch.set(doc(ref, o.id), updated);
    });
    batch.commit().catch(console.warn);
  };

  const deleteOrder = async (id) => {
    setOrders(prev => prev.filter(o => o.id !== id));
    const ref = colRef();
    if (ref) deleteDoc(doc(ref, id)).catch(console.warn);
  };

  const saveProducts      = (p)   => setProducts(p);
  const saveDailyTarget   = (t)   => setDailyTarget(t);
  const saveFirebaseConfig = (c)  => { setFirebaseConfig(c); if (!c) { setIsFirebaseConnected(false); setFirebaseUser(null); } };
  const clearAllData      = ()    => { setOrders([]); localStorage.removeItem('telesales_orders'); };
  const importOrders      = (arr) => setOrders(arr);

  return (
    <DbContext.Provider value={{
      orders, products, dailyTarget, firebaseConfig, lastUser, userProfile,
      isFirebaseConnected, firebaseUser, authReady, isSyncing, syncError,
      loginWithEmail, registerWithEmail, loginWithGoogle, resetPassword, logout, updateUserProfile,
      addOrder, updateOrder, bulkUpdateOrders, deleteOrder,
      saveProducts, saveDailyTarget, saveFirebaseConfig, clearAllData, importOrders
    }}>
      {children}
    </DbContext.Provider>
  );
};
