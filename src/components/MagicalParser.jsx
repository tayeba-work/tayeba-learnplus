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
    
    // Success flow
    triggerNotification('✅ Order added successfully!');
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

    if (onSaveSuccess) {
      setTimeout(() => {
        onSaveSuccess();
      }, 1000);
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
    </div>
  );
};

export default MagicalParser;
