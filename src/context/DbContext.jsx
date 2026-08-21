import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot,
  writeBatch
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
  // 1. STATE INITIALIZATION FROM LOCALSTORAGE
  const [orders, setOrders] = useState(() => {
    const local = localStorage.getItem('telesales_orders');
    return local ? JSON.parse(local) : [];
  });

  const [products, setProducts] = useState(() => {
    const local = localStorage.getItem('telesales_products');
    return local ? JSON.parse(local) : [
      { id: '1', name: 'LearnPlus Premium Course', price: 1550 },
      { id: '2', name: 'LearnPlus Interactive Book', price: 1200 },
      { id: '3', name: 'LearnPlus Software Suite', price: 4500 }
    ];
  });

  const [dailyTarget, setDailyTarget] = useState(() => {
    const local = localStorage.getItem('telesales_daily_target');
    return local ? parseInt(local, 10) : 10;
  });

  const [firebaseConfig, setFirebaseConfig] = useState(() => {
    // 1. Prioritize environment variables for easy PWA deployments
    if (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID && import.meta.env.VITE_FIREBASE_APP_ID) {
      return {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      };
    }
    // 2. Fallback to manually entered configurations in LocalStorage
    const local = localStorage.getItem('telesales_firebase_config');
    return local ? JSON.parse(local) : null;
  });

  // Sync statuses
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null); // { uid, email }
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  // Local storage synchronization
  useEffect(() => {
    localStorage.setItem('telesales_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('telesales_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('telesales_daily_target', dailyTarget.toString());
  }, [dailyTarget]);

  // Bulk seeder for August 2026 data
  useEffect(() => {
    const isSeeded = localStorage.getItem('seed_completed_august_2026_v3');
    if (!isSeeded) {
      setOrders(prevOrders => {
        const merged = [...prevOrders];
        let count = 0;
        seedOrders.forEach(seeded => {
          if (!merged.some(o => o.phone === seeded.phone && o.date === seeded.date)) {
            merged.push(seeded);
            count++;
          }
        });
        console.log(`[Seeder] Seeded ${count} new orders into data model.`);
        return merged;
      });
      localStorage.setItem('seed_completed_august_2026_v3', 'true');
    }
  }, []);

  useEffect(() => {
    if (firebaseConfig) {
      localStorage.setItem('telesales_firebase_config', JSON.stringify(firebaseConfig));
    } else {
      localStorage.removeItem('telesales_firebase_config');
    }
  }, [firebaseConfig]);

  // Initialize theme from local storage on startup
  useEffect(() => {
    const savedTheme = localStorage.getItem('telesales_theme') || 'violet';
    const themes = {
      violet: { primary: '262 83% 58%', secondary: '291 91% 65%' },
      emerald: { primary: '142 70% 45%', secondary: '160 84% 39%' },
      cyan: { primary: '190 90% 45%', secondary: '210 95% 55%' },
      sunset: { primary: '15 95% 55%', secondary: '345 90% 55%' }
    };
    const t = themes[savedTheme] || themes.violet;
    document.documentElement.style.setProperty('--primary-glow', t.primary);
    document.documentElement.style.setProperty('--secondary-glow', t.secondary);
  }, []);


  // 2. FIREBASE AUTH & FIRESTORE SYNC ENGINE
  useEffect(() => {
    if (!firebaseConfig) {
      setIsFirebaseConnected(false);
      setFirebaseUser(null);
      setIsSyncing(false);
      return;
    }

    let unsubscribe = null;
    let unsubscribeAuth = null;
    setIsSyncing(true);
    setSyncError('');

    try {
      const apps = getApps();
      const finalConfig = {
        ...firebaseConfig,
        authDomain: firebaseConfig.authDomain || `${firebaseConfig.projectId}.firebaseapp.com`,
        storageBucket: firebaseConfig.storageBucket || `${firebaseConfig.projectId}.appspot.com`
      };
      const app = apps.length === 0 ? initializeApp(finalConfig) : apps[0];
      const db = getFirestore(app);
      const auth = getAuth(app);

      // Listen to Auth State changes dynamically
      unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (user) {
          setIsFirebaseConnected(true);
          setFirebaseUser({
            uid: user.uid,
            email: user.email
          });
          setSyncError('');

          // Establish sync listener for this specific user's orders collection
          const userOrdersRef = collection(db, 'users', user.uid, 'orders');
          
          if (unsubscribe) unsubscribe(); // unsubscribe previous database listener if exists

          unsubscribe = onSnapshot(userOrdersRef, (snapshot) => {
            setOrders(prevOrders => {
              const localOrdersMap = new Map(prevOrders.map(o => [o.id, o]));
              let hasChanges = false;

              snapshot.forEach(docSnap => {
                const remoteOrder = { id: docSnap.id, ...docSnap.data() };
                const localOrder = localOrdersMap.get(remoteOrder.id);

                if (!localOrder) {
                  localOrdersMap.set(remoteOrder.id, remoteOrder);
                  hasChanges = true;
                } else if (remoteOrder.lastUpdated > localOrder.lastUpdated) {
                  localOrdersMap.set(remoteOrder.id, remoteOrder);
                  hasChanges = true;
                } else if (localOrder.lastUpdated > remoteOrder.lastUpdated) {
                  // Push local update to cloud
                  setDoc(doc(userOrdersRef, localOrder.id), localOrder);
                }
              });

              if (hasChanges) {
                return Array.from(localOrdersMap.values());
              }
              return prevOrders;
            });
            setIsSyncing(false);
          }, (dbErr) => {
            console.error("Firestore sync error:", dbErr);
            if (dbErr.code === 'permission-denied') {
              setSyncError("Sync error: Firestore permission denied. Verify database security rules.");
            } else {
              setSyncError("Database sync error: " + dbErr.message);
            }
            setIsSyncing(false);
          });

        } else {
          // User logged out
          setIsFirebaseConnected(false);
          setFirebaseUser(null);
          setIsSyncing(false);
          if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
          }
        }
      });

    } catch (err) {
      console.error("Firebase init error:", err);
      setSyncError("Init failed: " + err.message);
      setIsFirebaseConnected(false);
      setIsSyncing(false);
    }

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribe) unsubscribe();
    };
  }, [firebaseConfig]);


  // 3. SECURE AUTHENTICATION METHODS
  const loginWithEmail = async (email, password) => {
    setSyncError('');
    const apps = getApps();
    if (apps.length === 0) throw new Error("Firebase not initialized");
    const auth = getAuth(apps[0]);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = async (email, password) => {
    setSyncError('');
    const apps = getApps();
    if (apps.length === 0) throw new Error("Firebase not initialized");
    const auth = getAuth(apps[0]);
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
    const apps = getApps();
    if (apps.length === 0) throw new Error("Firebase not initialized. Go to credentials tab first.");
    const auth = getAuth(apps[0]);
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const resetPassword = async (email) => {
    setSyncError('');
    const apps = getApps();
    if (apps.length === 0) throw new Error("Firebase not initialized. Go to credentials tab first.");
    const auth = getAuth(apps[0]);
    await sendPasswordResetEmail(auth, email);
  };


  // 4. DATABASE OPERATIONS
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

    if (isFirebaseConnected && firebaseConfig && firebaseUser) {
      try {
        const apps = getApps();
        const db = getFirestore(apps[0]);
        await setDoc(doc(db, 'users', firebaseUser.uid, 'orders', newOrder.id), newOrder);
      } catch (e) {
        console.warn("Offline write cached:", e);
      }
    }
  };

  const updateOrder = async (id, updatedFields) => {
    const updatedTimestamp = Date.now();
    let finalOrder = null;

    setOrders(prev => prev.map(order => {
      if (order.id === id) {
        finalOrder = { 
          ...order, 
          ...updatedFields, 
          price: updatedFields.price !== undefined ? parseInt(updatedFields.price, 10) || 0 : order.price,
          lastUpdated: updatedTimestamp 
        };
        return finalOrder;
      }
      return order;
    }));

    if (isFirebaseConnected && firebaseConfig && firebaseUser && finalOrder) {
      try {
        const apps = getApps();
        const db = getFirestore(apps[0]);
        await setDoc(doc(db, 'users', firebaseUser.uid, 'orders', id), finalOrder);
      } catch (e) {
        console.warn("Offline update cached:", e);
      }
    }
  };

  const bulkUpdateOrders = async (ids, updatedFields) => {
    if (!ids || ids.length === 0) return;
    const updatedTimestamp = Date.now();

    setOrders(prev => prev.map(order => {
      if (ids.includes(order.id)) {
        return {
          ...order,
          ...updatedFields,
          price: updatedFields.price !== undefined ? parseInt(updatedFields.price, 10) || 0 : order.price,
          lastUpdated: updatedTimestamp
        };
      }
      return order;
    }));

    if (isFirebaseConnected && firebaseConfig && firebaseUser) {
      try {
        const apps = getApps();
        const db = getFirestore(apps[0]);
        const batch = writeBatch(db);
        
        orders.forEach(order => {
          if (ids.includes(order.id)) {
            const finalOrder = {
              ...order,
              ...updatedFields,
              price: updatedFields.price !== undefined ? parseInt(updatedFields.price, 10) || 0 : order.price,
              lastUpdated: updatedTimestamp
            };
            const docRef = doc(db, 'users', firebaseUser.uid, 'orders', order.id);
            batch.set(docRef, finalOrder);
          }
        });
        
        await batch.commit();
      } catch (e) {
        console.warn("Offline bulk sync cached:", e);
      }
    }
  };

  const deleteOrder = async (id) => {
    setOrders(prev => prev.filter(order => order.id !== id));

    if (isFirebaseConnected && firebaseConfig && firebaseUser) {
      try {
        const apps = getApps();
        const db = getFirestore(apps[0]);
        await deleteDoc(doc(db, 'users', firebaseUser.uid, 'orders', id));
      } catch (e) {
        console.warn("Offline delete cached:", e);
      }
    }
  };

  const saveProducts = (updatedProducts) => {
    setProducts(updatedProducts);
  };

  const saveDailyTarget = (target) => {
    setDailyTarget(target);
  };

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

  const importOrders = (newOrders) => {
    setOrders(newOrders);
  };

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
