import React, { useState, useEffect, useRef } from 'react';
import { useDb } from '../context/DbContext';
import { parseMessyText, playSuccessSound } from '../utils/parser';
import { 
  Sparkles, 
  User, 
  Phone, 
  MapPin, 
  ShoppingBag, 
  DollarSign, 
  FileText,
  CheckCircle,
  XCircle,
  Clipboard,
  Trash2,
  Check,
  AlertCircle
} from 'lucide-react';

const MagicalParser = ({ onSaveSuccess }) => {
  const { products, addOrder } = useDb();
  const [rawText, setRawText] = useState('');
  
  // Scanning animation states
  const [isScanning, setIsScanning] = useState(false);
  const scanTimeoutRef = useRef(null);

  // Parsed state that can be manually edited
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    productName: 'LearnPlus Premium Course',
    price: '1550',
    notes: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [showShareModal, setShowShareModal] = useState(false);
  const [savedOrder, setSavedOrder] = useState(null);

  const [notification, setNotification] = useState('');


  // Run parser on rawText changes and trigger scanning animation
  useEffect(() => {
    if (!rawText.trim()) {
      setFormData({
        name: '',
        phone: '',
        address: '',
        productName: 'LearnPlus Premium Course',
        price: '1550',
        notes: '',
        date: new Date().toISOString().split('T')[0]
      });
      setIsScanning(false);
      return;
    }

    // Trigger visual scanning effect
    setIsScanning(true);
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    
    // Stop scanning line after 1.2s to feel responsive
    scanTimeoutRef.current = setTimeout(() => {
      setIsScanning(false);
    }, 1200);

    const parsed = parseMessyText(rawText, products);
    setFormData(prev => ({
      ...prev,
      ...parsed,
      productName: parsed.productName || 'LearnPlus Premium Course',
      price: parsed.price || '1550'
    }));
  }, [rawText, products]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProductSelect = (productName) => {
    const selectedProd = products.find(p => p.name === productName);
    setFormData(prev => ({
      ...prev,
      productName,
      price: selectedProd ? selectedProd.price.toString() : prev.price
    }));
  };

  // Instant clipboard paste using Clipboard API
  const handleClipboardPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
        triggerNotification('📋 Text pasted from clipboard!');
      } else {
        triggerNotification('⚠️ Clipboard is empty.');
      }
    } catch (err) {
      console.warn("Failed to read clipboard:", err);
      // Fallback message for permissions
      triggerNotification('🔒 Permission denied. Please paste manually.');
    }
  };

  const handleClear = () => {
    setRawText('');
    triggerNotification('🗑️ Input cleared.');
  };

  const triggerNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      triggerNotification('⚠️ Customer name is required.');
      return;
    }
    if (!formData.phone.trim() || formData.phone.length < 10) {
      triggerNotification('⚠️ Please enter a valid phone number.');
      return;
    }

    addOrder(formData);
    playSuccessSound();
    
    // Store order in state for WhatsApp share
    setSavedOrder(formData);
    setShowShareModal(true);
    
    triggerNotification('✅ Order saved successfully!');
  };

  const formatWhatsAppText = (order) => {
    if (!order) return '';
    return `📋 *New Order Summary*
━━━━━━━━━━━━━━━━━━
👤 *Customer:* ${order.name}
📞 *Phone:* ${order.phone}
📍 *Address:* ${order.address || 'N/A'}
📦 *Product:* ${order.productName}
💰 *Price:* ৳ ${order.price} BDT
📝 *Notes:* ${order.notes || 'N/A'}
━━━━━━━━━━━━━━━━━━
⏱️ *Saved At:* ${new Date().toLocaleString('en-GB')}`;
  };

  const handleWhatsAppShare = () => {
    if (!savedOrder) return;
    const text = encodeURIComponent(formatWhatsAppText(savedOrder));
    const waUrl = `https://api.whatsapp.com/send?text=${text}`;
    window.open(waUrl, '_blank');
    handleCloseAndProceed();
  };

  const handleCloseAndProceed = () => {
    setRawText('');
    setFormData({
      name: '',
      phone: '',
      address: '',
      productName: 'LearnPlus Premium Course',
      price: '1550',
      notes: '',
      date: new Date().toISOString().split('T')[0]
    });
    setShowShareModal(false);
    setSavedOrder(null);
    if (onSaveSuccess) {
      onSaveSuccess();
    }
  };


  return (
    <div className="app-content animate-slide-up">
      <h2 className="section-title">
        <Sparkles size={20} className="text-gradient" />
        Magical Summary Parser
      </h2>

      {notification && (
        <div 
          className="glass-card animate-fade-in" 
          style={{ 
            padding: '12px', 
            background: notification.startsWith('✅') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.08)',
            borderColor: notification.startsWith('✅') ? '#10b981' : 'var(--border-light)',
            color: 'white',
            fontWeight: 500,
            fontSize: '13px',
            textAlign: 'center',
            borderLeft: notification.startsWith('✅') ? '4px solid #10b981' : '4px solid hsl(var(--primary-glow))'
          }}
        >
          {notification}
        </div>
      )}

      {/* World-class Paste Box Card */}
      <div className="glass-card magical-glow-card parser-input-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="field-label" style={{ color: 'hsl(var(--primary-glow))' }}>
            <Sparkles size={14} className="animate-pulse" />
            Universal Unstructured Pasting Panel
          </span>
          {isScanning && (
            <span style={{ fontSize: '10px', color: 'hsl(var(--primary-glow))', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }} className="animate-pulse">
              ⚡ Analyzing...
            </span>
          )}
        </div>

        {/* Textarea containing scan lines and overlays */}
        <div className="parser-textarea-container">
          <textarea
            className={`input-field parser-textarea ${isScanning ? 'glow-active' : ''}`}
            placeholder="Paste order details here. E.g.:
Shoriatpur jela, bedorganj upozila
01763272106 ruhul amin"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            style={{ paddingBottom: '48px', fontSize: '15px', fontWeight: 500 }}
          />

          {/* Scanner Overlay Line */}
          <div className={`scanner-overlay ${isScanning ? 'scanning' : ''}`}>
            <div className="scanner-line"></div>
          </div>

          {/* Quick Buttons Overlay inside Textarea */}
          <div className="textarea-actions-tray">
            <button 
              type="button" 
              onClick={handleClipboardPaste} 
              className="action-chip-btn"
              title="Paste from Clipboard"
            >
              <Clipboard size={12} /> Paste
            </button>
            {rawText && (
              <button 
                type="button" 
                onClick={handleClear} 
                className="action-chip-btn"
                style={{ color: 'var(--status-cancelled)', borderColor: 'rgba(239,68,68,0.2)' }}
                title="Clear input"
              >
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Live dopamine chips feedback (World-class UX) */}
        <div className="parser-extracted-feedback">
          <div className={`feedback-chip ${formData.name ? 'found' : 'missing'}`}>
            {formData.name ? <Check size={12} /> : <AlertCircle size={12} />}
            Name: {formData.name ? `${formData.name.substring(0, 10)}${formData.name.length > 10 ? '..' : ''}` : '?'}
          </div>
          <div className={`feedback-chip ${formData.phone ? 'found' : 'missing'}`}>
            {formData.phone ? <Check size={12} /> : <AlertCircle size={12} />}
            Phone: {formData.phone ? formData.phone : '?'}
          </div>
          <div className={`feedback-chip ${formData.address ? 'found' : 'missing'}`}>
            {formData.address ? <Check size={12} /> : <AlertCircle size={12} />}
            Address: {formData.address ? `${formData.address.substring(0, 10)}${formData.address.length > 10 ? '..' : ''}` : '?'}
          </div>
          <div className={`feedback-chip ${formData.price ? 'found' : 'missing'}`}>
            {formData.price ? <Check size={12} /> : <AlertCircle size={12} />}
            Price: {formData.price ? `${formData.price} TK` : '?'}
          </div>
        </div>
      </div>

      {/* Verified Data Sheet Form */}
      <form onSubmit={handleSubmit} className="glass-card parsed-fields-container">
        <div className="parsed-preview-header">
          <h3 className="stat-title" style={{ fontSize: '15px', color: 'white' }}>
            Verify & Save Order Details
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Adjust fields if necessary</span>
        </div>

        {/* Customer Name */}
        <div className="field-group">
          <label className="field-label">
            <User size={14} /> Customer Name
          </label>
          <input
            type="text"
            className="input-field"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="e.g. Ruhul Amin"
            required
          />
        </div>

        {/* Phone */}
        <div className="field-group">
          <label className="field-label">
            <Phone size={14} /> Phone Number
          </label>
          <input
            type="text"
            className="input-field"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="017xxxxxxxx"
            required
          />
        </div>

        {/* Address */}
        <div className="field-group">
          <label className="field-label">
            <MapPin size={14} /> Shipping Address
          </label>
          <input
            type="text"
            className="input-field"
            value={formData.address}
            onChange={(e) => handleInputChange('address', e.target.value)}
            placeholder="e.g. Bedorganj, Shoriatpur"
          />
        </div>

        {/* Product Selector */}
        <div className="field-group">
          <label className="field-label">
            <ShoppingBag size={14} /> Product Item
          </label>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              className="input-field"
              value={formData.productName}
              onChange={(e) => handleInputChange('productName', e.target.value)}
              placeholder="Select standard product or type one"
              list="product-suggestions"
            />
            <datalist id="product-suggestions">
              {products.map(p => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
          {products.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
              {products.map(p => (
                <button
                  type="button"
                  key={p.id}
                  className="filter-pill"
                  onClick={() => handleProductSelect(p.name)}
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '11px',
                    borderColor: formData.productName === p.name ? 'hsl(var(--primary-glow))' : 'var(--border-light)'
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price */}
        <div className="field-group">
          <label className="field-label">
            <DollarSign size={14} /> Product Price (TK)
          </label>
          <input
            type="number"
            className="input-field"
            value={formData.price}
            onChange={(e) => handleInputChange('price', e.target.value)}
            placeholder="Price in BDT"
          />
        </div>

        {/* Order Date */}
        <div className="field-group">
          <label className="field-label">
            Order Date
          </label>
          <input
            type="date"
            className="input-field"
            value={formData.date}
            onChange={(e) => handleInputChange('date', e.target.value)}
          />
        </div>

        {/* Extra Notes */}
        <div className="field-group">
          <label className="field-label">
            <FileText size={14} /> Remarks & Notes
          </label>
          <input
            type="text"
            className="input-field"
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="e.g. Call before delivery, pathao courier"
          />
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>
          <CheckCircle size={16} /> Save Order Entry
        </button>
      </form>

      {/* WhatsApp Share Confirmation Modal */}
      {showShareModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          boxSizing: 'border-box'
        }} className="animate-fade-in">
          
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '400px',
            borderRadius: '24px',
            border: '1px solid rgba(34, 197, 94, 0.25)', // Green border for WhatsApp theme
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.03), rgba(11, 15, 25, 0.98))',
            padding: '20px',
            boxSizing: 'border-box',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 30px rgba(34, 197, 94, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {/* SVG WhatsApp icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12.012 2C6.48 2 2.01 6.47 2.01 12c0 1.91.54 3.7 1.48 5.24L2 22l4.9-1.28c1.47.8 3.14 1.28 4.93 1.28 5.53 0 10-4.47 10-10S17.542 2 12.012 2zm0 1.67c4.6 0 8.33 3.73 8.33 8.33s-3.73 8.33-8.33 8.33c-1.61 0-3.11-.46-4.38-1.26l-.32-.2-2.92.77.78-2.85-.22-.35c-.88-1.4-1.39-3.05-1.39-4.77.01-4.6 3.74-8.33 8.33-8.33z" fill="#22c55e" />
                  <path d="M15.42 13.56c-.22-.11-1.3-.64-1.51-.72-.21-.08-.37-.12-.53.12-.16.24-.61.76-.75.92-.14.16-.27.18-.49.07-.22-.11-.93-.34-1.77-1.09-.65-.58-1.09-1.3-1.22-1.52-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.07-.15.03-.28-.02-.39-.05-.11-.53-1.28-.73-1.76-.19-.47-.39-.41-.53-.41-.14 0-.3 0-.46.02-.16.02-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.09 3.62.57.25 1.02.4 1.37.51.57.18 1.1.15 1.51.09.46-.07 1.3-.53 1.48-1.04.18-.51.18-.95.13-1.04-.05-.1-.19-.15-.41-.26z" fill="#22c55e" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'white', margin: 0 }}>
                  Share to WhatsApp Group
                </h3>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Send order details to your sales group chat
                </span>
              </div>
            </div>

            {/* Text Preview Area */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '12px',
              border: '1px solid var(--border-light)',
              padding: '12px 14px',
              maxHeight: '220px',
              overflowY: 'auto',
              boxSizing: 'border-box'
            }}>
              <pre style={{
                fontSize: '11px',
                color: '#e2e8f0',
                margin: 0,
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                lineHeight: '1.5'
              }}>
                {savedOrder ? formatWhatsAppText(savedOrder) : ''}
              </pre>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.2)',
                  transition: 'all 0.2s ease'
                }}
              >
                Send to WhatsApp Group
              </button>

              <button
                type="button"
                onClick={handleCloseAndProceed}
                className="btn-secondary"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 700
                }}
              >
                Done (Without Sharing)
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default MagicalParser;
