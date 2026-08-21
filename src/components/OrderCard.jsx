import React, { useState } from 'react';
import { useDb } from '../context/DbContext';
import { formatForCourier } from '../utils/parser';
import { 
  Phone, 
  Trash2, 
  Copy, 
  MessageSquare, 
  Calendar,
  CheckCircle,
  FileText,
  MapPin,
  AlertTriangle,
  Edit2,
  Save,
  X,
  User,
  ShoppingBag,
  DollarSign
} from 'lucide-react';

const OrderCard = ({ order }) => {
  const { updateOrder, deleteOrder, products } = useDb();
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Inline editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: order.name,
    phone: order.phone,
    address: order.address,
    productName: order.productName,
    price: order.price.toString(),
    notes: order.notes,
    date: order.date
  });

  const handleStatusChange = (e) => {
    updateOrder(order.id, { status: e.target.value });
  };

  const handleCopy = () => {
    const formatted = formatForCourier(order);
    navigator.clipboard.writeText(formatted)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => console.error("Could not copy text: ", err));
  };

  const handleDelete = () => {
    deleteOrder(order.id);
    setShowDeleteConfirm(false);
  };

  // Toggle edit state
  const handleStartEdit = () => {
    setEditForm({
      name: order.name,
      phone: order.phone,
      address: order.address,
      productName: order.productName,
      price: order.price.toString(),
      notes: order.notes,
      date: order.date
    });
    setIsEditing(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.phone.trim()) return;

    updateOrder(order.id, {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      address: editForm.address.trim(),
      productName: editForm.productName.trim(),
      price: parseInt(editForm.price, 10) || 0,
      notes: editForm.notes.trim(),
      date: editForm.date
    });
    setIsEditing(false);
  };

  const handleInputChange = (field, val) => {
    setEditForm(prev => ({ ...prev, [field]: val }));
  };

  const handleProductSelect = (productName) => {
    const selectedProd = products.find(p => p.name === productName);
    setEditForm(prev => ({
      ...prev,
      productName,
      price: selectedProd ? selectedProd.price.toString() : prev.price
    }));
  };

  const getWhatsAppLink = () => {
    let cleanPhone = order.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '88' + cleanPhone;
    } else if (!cleanPhone.startsWith('88') && cleanPhone.length === 10) {
      cleanPhone = '880' + cleanPhone;
    }
    
    const message = `আসসালামু আলাইকুম ${order.name || ''},\nLearnPlus থেকে আপনার অর্ডারটি কনফার্ম করা হয়েছে।\n\nপ্রোডাক্ট: ${order.productName || ''}\nটোটাল বিল: ${order.price || 0} TK\nডেলিভারি ঠিকানা: ${order.address || ''}\n\nধন্যবাদ!`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className={`glass-card order-card animate-fade-in ${order.status === 'cancelled' ? 'cancelled-dim' : ''}`} style={{ position: 'relative' }}>
      
      {/* 1. EDIT MODE DISPLAY */}
      {isEditing ? (
        <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', color: 'hsl(var(--primary-glow))', fontWeight: 'bold' }}>✏️ Editing Order</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="submit" className="icon-btn" style={{ color: '#10b981', background: 'rgba(16,185,129,0.08)' }} title="Save changes">
                <Save size={15} />
              </button>
              <button type="button" onClick={() => setIsEditing(false)} className="icon-btn" style={{ color: 'var(--status-cancelled)', background: 'rgba(239,68,68,0.08)' }} title="Cancel">
                <X size={15} />
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Customer Name */}
            <div className="field-group">
              <span className="field-label" style={{ fontSize: '10px' }}><User size={10} /> Name</span>
              <input
                type="text"
                className="input-field"
                style={{ padding: '8px 10px', fontSize: '13px' }}
                value={editForm.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />
            </div>

            {/* Phone */}
            <div className="field-group">
              <span className="field-label" style={{ fontSize: '10px' }}><Phone size={10} /> Phone</span>
              <input
                type="text"
                className="input-field"
                style={{ padding: '8px 10px', fontSize: '13px' }}
                value={editForm.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                required
              />
            </div>

            {/* Shipping Address */}
            <div className="field-group">
              <span className="field-label" style={{ fontSize: '10px' }}><MapPin size={10} /> Address</span>
              <input
                type="text"
                className="input-field"
                style={{ padding: '8px 10px', fontSize: '13px' }}
                value={editForm.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
              />
            </div>

            {/* Product */}
            <div className="field-group">
              <span className="field-label" style={{ fontSize: '10px' }}><ShoppingBag size={10} /> Product</span>
              <input
                type="text"
                className="input-field"
                style={{ padding: '8px 10px', fontSize: '13px' }}
                value={editForm.productName}
                onChange={(e) => handleInputChange('productName', e.target.value)}
                list="edit-product-suggestions"
              />
              <datalist id="edit-product-suggestions">
                {products.map(p => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>

            {/* Price */}
            <div className="field-group">
              <span className="field-label" style={{ fontSize: '10px' }}><DollarSign size={10} /> Price (TK)</span>
              <input
                type="number"
                className="input-field"
                style={{ padding: '8px 10px', fontSize: '13px' }}
                value={editForm.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
              />
            </div>

            {/* Date */}
            <div className="field-group">
              <span className="field-label" style={{ fontSize: '10px' }}><Calendar size={10} /> Order Date</span>
              <input
                type="date"
                className="input-field"
                style={{ padding: '8px 10px', fontSize: '13px' }}
                value={editForm.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="field-group">
              <span className="field-label" style={{ fontSize: '10px' }}><FileText size={10} /> Remarks / Notes</span>
              <input
                type="text"
                className="input-field"
                style={{ padding: '8px 10px', fontSize: '13px' }}
                value={editForm.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
              />
            </div>
          </div>
        </form>
      ) : (
        /* 2. VIEW MODE DISPLAY */
        <>
          {/* Header */}
          <div className="order-card-header">
            <div>
              <h4 className="order-card-name">{order.name}</h4>
              <span className="order-card-phone">
                <Calendar size={12} />
                {order.date} 
                <span style={{ margin: '0 4px', opacity: 0.3 }}>|</span>
                {order.phone}
              </span>
            </div>
            
            <select 
              className="select-status-dropdown" 
              value={order.status} 
              onChange={handleStatusChange}
              style={{
                borderColor: `var(--status-${order.status})`,
                color: `var(--status-${order.status})`,
                backgroundColor: `var(--status-${order.status}-bg)`
              }}
            >
              <option value="pending" style={{ color: 'var(--status-pending)' }}>Pending</option>
              <option value="confirmed" style={{ color: 'var(--status-confirmed)' }}>Confirmed</option>
              <option value="shipped" style={{ color: 'var(--status-shipped)' }}>Shipped</option>
              <option value="delivered" style={{ color: 'var(--status-delivered)' }}>Delivered</option>
              <option value="cancelled" style={{ color: 'var(--status-cancelled)' }}>Cancelled</option>
              <option value="returned" style={{ color: 'var(--status-returned)' }}>Returned</option>
            </select>
          </div>

          {/* Product and Price */}
          <div className="order-card-meta">
            <span className="order-card-product">{order.productName || 'No Product Name'}</span>
            <span className="order-card-price">{order.price?.toLocaleString() || 0} TK</span>
          </div>

          {/* Address */}
          {order.address && (
            <div className="order-card-address" style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <MapPin size={14} style={{ marginTop: '3px', flexShrink: 0, color: 'var(--text-muted)' }} />
              <span>{order.address}</span>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div className="order-card-notes" style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <FileText size={12} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--text-muted)' }} />
              <span>{order.notes}</span>
            </div>
          )}

          {/* Action Tray */}
          <div className="order-card-actions">
            <div className="action-buttons-group">
              {/* Direct call */}
              <a href={`tel:${order.phone}`} className="icon-btn call-btn" title="Call Customer">
                <Phone size={16} />
              </a>
              
              {/* WhatsApp Text */}
              <a href={getWhatsAppLink()} target="_blank" rel="noopener noreferrer" className="icon-btn wa-btn" title="WhatsApp Customer">
                <MessageSquare size={16} />
              </a>
              
              {/* Courier Copy */}
              <button 
                type="button" 
                onClick={handleCopy} 
                className="icon-btn copy-btn" 
                title="Copy for courier portal"
              >
                {copied ? <CheckCircle size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
              </button>
              
              {/* Edit button */}
              <button 
                type="button" 
                onClick={handleStartEdit} 
                className="icon-btn" 
                title="Edit Order"
                style={{ color: 'hsl(var(--primary-glow))', background: 'rgba(139,92,246,0.05)' }}
              >
                <Edit2 size={16} />
              </button>
            </div>

            {/* Delete button */}
            {!showDeleteConfirm ? (
              <button 
                type="button" 
                onClick={() => setShowDeleteConfirm(true)} 
                className="icon-btn" 
                style={{ color: 'var(--status-cancelled)', background: 'rgba(239, 68, 68, 0.05)' }}
                title="Delete Order"
              >
                <Trash2 size={16} />
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--status-cancelled)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <AlertTriangle size={11} /> Confirm?
                </span>
                <button 
                  type="button" 
                  onClick={handleDelete} 
                  className="btn-primary" 
                  style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--status-cancelled)' }}
                >
                  Yes
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowDeleteConfirm(false)} 
                  className="btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '11px' }}
                >
                  No
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {copied && (
        <div 
          className="animate-fade-in" 
          style={{
            position: 'absolute',
            bottom: '50px',
            right: '16px',
            background: '#10b981',
            color: 'white',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
          }}
        >
          Copied!
        </div>
      )}
    </div>
  );
};

export default OrderCard;
