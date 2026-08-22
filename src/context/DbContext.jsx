import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import seedOrders from './seed_orders.json';

const DbContext = createContext();
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);

export const useDb = () => useContext(DbContext);

export const DbProvider = ({ children }) => {

  // ─── 1. STATE INITIALIZATION FROM LOCALSTORAGE ────────────────────────────
  const [orders, setOrders] = useState(() => {
    try {
      const local = localStorage.getItem('telesales_orders');
      return local ? JSON.parse(local) : [];
    } catch { return []; }
  });

  const [products, setProducts] = useState(() => {
    try {
      const local = localStorage.getItem('telesales_products');
      return local ? JSON.parse(local) : [
        { id: '1', name: 'LearnPlus Premium Course', price: 1550 },
        { id: '2', name: 'LearnPlus Interactive Book', price: 1200 },
        { id: '3', name: 'LearnPlus Software Suite', price: 4500 }
      ];
    } catch { return []; }
  });

  const [dailyTarget, setDailyTarget] = useState(() => {
    const local = localStorage.getItem('telesales_daily_target');
    return local ? parseInt(local, 10) : 10;
  });

  const [firebaseConfig, setFirebaseConfig] = useState(() => {
    if (
      import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID
    ) {
      return {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      };
    }
    try {
      const local = localStorage.getItem('telesales_firebase_config');
      return local ? JSON.parse(local) : null;
    } catch { return null; }
  });

  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  // Use refs to hold stable references for use inside async closures
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
    if (firebaseConfig) {
      try { localStorage.setItem('telesales_firebase_config', JSON.stringify(firebaseConfig)); } catch {}
    } else {
      localStorage.removeItem('telesales_firebase_config');
    }
  }, [firebaseConfig]);

  // ─── 3. SAFE SEEDER — never overwrites existing orders ───────────────────
  useEffect(() => {
    setOrders(prev => {
      const existingIds = new Set(prev.map(o => o.id));
      const existingPhoneDates = new Set(prev.map(o => `${o.phone}__${o.date}`));
      const newOrders = seedOrders.filter(s => {
        const key = `${s.phone}__${s.date}`;
        return !existingIds.has(s.id) && !existingPhoneDates.has(key);
      });
      if (newOrders.length === 0) return prev;
      console.log(`[Seeder] Added ${newOrders.length} new orders (existing untouched).`);
      return [...prev, ...newOrders];
    });
  }, []);

  // ─── 4. INITIALIZE THEME ─────────────────────────────────────────────────
  useEffect(() => {
    const savedTheme = localStorage.getItem('telesales_theme') || 'violet';
    const themes = {
      violet:  { primary: '262 83% 58%', secondary: '291 91% 65%' },
      emerald: { primary: '142 70% 45%', secondary: '160 84% 39%' },
      cyan:    { primary: '190 90% 45%', secondary: '210 95% 55%' },
      sunset:  { primary: '15 95% 55%',  secondary: '345 90% 55%' }
    };
    const t = themes[savedTheme] || themes.violet;
    document.documentElement.style.setProperty('--primary-glow', t.primary);
    document.documentElement.style.setProperty('--secondary-glow', t.secondary);
  }, []);

  // ─── 5. FIREBASE AUTH + FIRESTORE SYNC ENGINE ────────────────────────────
  useEffect(() => {
    if (!firebaseConfig) {
      setIsFirebaseConnected(false);
      setFirebaseUser(null);
      setIsSyncing(false);
      return;
    }

    let unsubscribeSnapshot = null;
    let unsubscribeAuth = null;
    setIsSyncing(true);
    setSyncError('');

    const initFirebase = async () => {
      try {
        // FIX 1: Properly re-initialize Firebase when config changes.
        // Delete any existing app so we can init with the new config.
        const apps = getApps();
        if (apps.length > 0) {
          await deleteApp(apps[0]);
        }

        const finalConfig = {
          ...firebaseConfig,
          authDomain: firebaseConfig.authDomain || `${firebaseConfig.projectId}.firebaseapp.com`,
          storageBucket: firebaseConfig.storageBucket || `${firebaseConfig.projectId}.appspot.com`
        };

        const app = initializeApp(finalConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);

        unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
          if (user) {
            setIsFirebaseConnected(true);
            setFirebaseUser({ uid: user.uid, email: user.email });
            setSyncError('');

            const userOrdersRef = collection(db, 'users', user.uid, 'orders');

            // FIX 3: On first login, upload all local orders to Firestore if cloud is empty.
            try {
              const cloudSnapshot = await getDocs(userOrdersRef);
              if (cloudSnapshot.empty && ordersRef.current.length > 0) {
                console.log(`[Firebase] Cloud empty. Uploading ${ordersRef.current.length} local orders…`);
                const batch = writeBatch(db);
                ordersRef.current.forEach(order => {
                  const ref = doc(userOrdersRef, order.id);
                  batch.set(ref, order);
                });
                await batch.commit();
                console.log('[Firebase] Initial upload complete.');
              }
            } catch (uploadErr) {
              console.warn('[Firebase] Initial upload failed:', uploadErr.message);
            }

            // Start real-time sync listener
            if (unsubscribeSnapshot) unsubscribeSnapshot();

            unsubscribeSnapshot = onSnapshot(userOrdersRef, (snapshot) => {
              // FIX 2: Collect orders to push OUTSIDE of setOrders, then push after.
              const ordersToUpload = [];

              setOrders(prev => {
                const localMap = new Map(prev.map(o => [o.id, o]));
                let changed = false;

                snapshot.forEach(docSnap => {
                  const remote = { id: docSnap.id, ...docSnap.data() };
                  const local = localMap.get(remote.id);

                  if (!local) {
                    // New order from cloud
                    localMap.set(remote.id, remote);
                    changed = true;
                  } else if ((remote.lastUpdated || 0) > (local.lastUpdated || 0)) {
                    // Cloud is newer → take cloud version
                    localMap.set(remote.id, remote);
                    changed = true;
                  } else if ((local.lastUpdated || 0) > (remote.lastUpdated || 0)) {
                    // Local is newer → mark for upload (do NOT call setDoc here)
                    ordersToUpload.push(local);
                  }
                });

                return changed ? Array.from(localMap.values()) : prev;
              });

              // FIX 2 (cont): Push stale-local orders to cloud AFTER state update
              if (ordersToUpload.length > 0) {
                ordersToUpload.forEach(order => {
                  setDoc(doc(userOrdersRef, order.id), order).catch(e =>
                    console.warn('[Firebase] Push local order failed:', e.message)
                  );
                });
              }

              setIsSyncing(false);
            }, (err) => {
              console.error('[Firestore] Snapshot error:', err);
              if (err.code === 'permission-denied') {
                setSyncError('Permission denied. Check Firestore Security Rules in Firebase Console.');
              } else {
                setSyncError('Sync error: ' + err.message);
              }
              setIsSyncing(false);
            });

          } else {
            // Logged out
            setIsFirebaseConnected(false);
            setFirebaseUser(null);
            setIsSyncing(false);
            if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
          }
        });

      } catch (err) {
        console.error('[Firebase] Init error:', err);
        setSyncError('Firebase init failed: ' + err.message);
        setIsFirebaseConnected(false);
        setIsSyncing(false);
      }
    };

    initFirebase();

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [firebaseConfig]);


  // ─── 6. AUTH METHODS ─────────────────────────────────────────────────────
  const getActiveApp = () => {
    const apps = getApps();
    if (apps.length === 0) throw new Error('Firebase not initialized. Enter credentials first.');
    return apps[0];
  };

  const loginWithEmail = async (email, password) => {
    setSyncError('');
    const auth = getAuth(getActiveApp());
    await signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = async (email, password) => {
    setSyncError('');
    const auth = getAuth(getActiveApp());
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    const apps = getApps();
    if (apps.length === 0) return;
    const auth = getAuth(apps[0]);
    await signOut(auth);
  };

  const loginWithGoogle = async () => {
    setSyncError('');
    const auth = getAuth(getActiveApp());
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const resetPassword = async (email) => {
    setSyncError('');
    const auth = getAuth(getActiveApp());
    await sendPasswordResetEmail(auth, email);
  };


  // ─── 7. DATABASE OPERATIONS ───────────────────────────────────────────────
  const getDb = () => {
    const apps = getApps();
    if (apps.length === 0) return null;
    return getFirestore(apps[0]);
  };

  const addOrder = async (orderData) => {
    const newOrder = {
      id: generateId(),
      name: orderData.name || '',
      phone: orderData.phone || '',
      address: orderData.address || '',
      productName: orderData.productName || '',
      price: orderData.price ? parseInt(orderData.price, 10) : 0,
      status: orderData.status || 'pending',
      notes: orderData.notes || '',
      date: orderData.date || new Date().toISOString().split('T')[0],
      createdAt: Date.now(),
      lastUpdated: Date.now()
    };

    setOrders(prev => [newOrder, ...prev]);

    if (isFirebaseConnected && firebaseUser) {
      try {
        const db = getDb();
        if (db) await setDoc(doc(db, 'users', firebaseUser.uid, 'orders', newOrder.id), newOrder);
      } catch (e) { console.warn('[Firebase] addOrder offline:', e.message); }
    }
  };

  const updateOrder = async (id, updatedFields) => {
    const ts = Date.now();
    let finalOrder = null;

    setOrders(prev => prev.map(order => {
      if (order.id === id) {
        finalOrder = {
          ...order,
          ...updatedFields,
          price: updatedFields.price !== undefined ? parseInt(updatedFields.price, 10) || 0 : order.price,
          lastUpdated: ts
        };
        return finalOrder;
      }
      return order;
    }));

    if (isFirebaseConnected && firebaseUser && finalOrder) {
      try {
        const db = getDb();
        if (db) await setDoc(doc(db, 'users', firebaseUser.uid, 'orders', id), finalOrder);
      } catch (e) { console.warn('[Firebase] updateOrder offline:', e.message); }
    }
  };

  // FIX 4: Use ordersRef to avoid stale closure in bulkUpdateOrders
  const bulkUpdateOrders = async (ids, updatedFields) => {
    if (!ids || ids.length === 0) return;
    const ts = Date.now();

    setOrders(prev => prev.map(order => {
      if (ids.includes(order.id)) {
        return {
          ...order,
          ...updatedFields,
          price: updatedFields.price !== undefined ? parseInt(updatedFields.price, 10) || 0 : order.price,
          lastUpdated: ts
        };
      }
      return order;
    }));

    if (isFirebaseConnected && firebaseUser) {
      try {
        const db = getDb();
        if (!db) return;
        const batch = writeBatch(db);
        // Use ordersRef.current (always fresh) instead of stale `orders`
        ordersRef.current.forEach(order => {
          if (ids.includes(order.id)) {
            const updated = {
              ...order,
              ...updatedFields,
              price: updatedFields.price !== undefined ? parseInt(updatedFields.price, 10) || 0 : order.price,
              lastUpdated: ts
            };
            batch.set(doc(db, 'users', firebaseUser.uid, 'orders', order.id), updated);
          }
        });
        await batch.commit();
      } catch (e) { console.warn('[Firebase] bulkUpdate offline:', e.message); }
    }
  };

  const deleteOrder = async (id) => {
    setOrders(prev => prev.filter(o => o.id !== id));

    if (isFirebaseConnected && firebaseUser) {
      try {
        const db = getDb();
        if (db) await deleteDoc(doc(db, 'users', firebaseUser.uid, 'orders', id));
      } catch (e) { console.warn('[Firebase] deleteOrder offline:', e.message); }
    }
  };

  const saveProducts = (updatedProducts) => setProducts(updatedProducts);
  const saveDailyTarget = (target) => setDailyTarget(target);

  const saveFirebaseConfig = (config) => {
    setFirebaseConfig(config);
    if (!config) {
      setIsFirebaseConnected(false);
      setFirebaseUser(null);
    }
  };

  const clearAllData = () => {
    setOrders([]);
    localStorage.removeItem('telesales_orders');
  };

  const importOrders = (newOrders) => setOrders(newOrders);

  return (
    <DbContext.Provider value={{
      orders,
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
      resetPassword,
      logout,
      addOrder,
      updateOrder,
      bulkUpdateOrders,
      deleteOrder,
      saveProducts,
      saveDailyTarget,
      saveFirebaseConfig,
      clearAllData,
      importOrders
    }}>
      {children}
    </DbContext.Provider>
  );
};
