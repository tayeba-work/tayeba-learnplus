import React, { useState, useMemo, useEffect } from 'react';
import { useDb } from '../context/DbContext';
import OrderCard from './OrderCard';
import { playSuccessSound } from '../utils/parser';
import { 
  Search, 
  Filter, 
  Calendar, 
  ShoppingBag,
  Download,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';

const OrderList = ({ searchQuery, setSearchQuery }) => {
  const { orders, bulkUpdateOrders } = useDb();
  
  const [dateFilter, setDateFilter] = useState('all'); // today, yesterday, last7, thisMonth, all, custom
  const [statusFilter, setStatusFilter] = useState('all'); // all, pending, confirmed, shipped, delivered, cancelled, returned
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  
  // Custom Date range
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Get date strings
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();

  // Resolve currently active order details in real-time (for modal sync)
  const activeOrder = useMemo(() => {
    if (!selectedOrder) return null;
    return orders.find(o => o.id === selectedOrder.id) || null;
  }, [orders, selectedOrder]);

  const toggleSelectOrder = (id) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (filteredList) => {
    const filteredIds = filteredList.map(o => o.id);
    const allSelected = filteredIds.every(id => selectedOrderIds.includes(id));
    if (allSelected) {
      setSelectedOrderIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedOrderIds(prev => {
        const newSelection = [...prev];
        filteredIds.forEach(id => {
          if (!newSelection.includes(id)) newSelection.push(id);
        });
        return newSelection;
      });
    }
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    if (selectedOrderIds.length === 0) return;
    try {
      await bulkUpdateOrders(selectedOrderIds, { status: newStatus });
      setSelectedOrderIds([]);
      playSuccessSound();
    } catch (e) {
      console.error("Bulk update failed:", e);
    }
  };

  // If the selected order is deleted, auto-close the popup
  useEffect(() => {
    if (selectedOrder && !orders.some(o => o.id === selectedOrder.id)) {
      setSelectedOrder(null);
    }
  }, [orders, selectedOrder]);

  // 1. CALCULATE ORDER COUNTS PER STATUS UNDER THE CURRENT DATE FILTER (Dynamic pills)
  const statusCounts = useMemo(() => {
    const dateFiltered = orders.filter(order => {
      if (dateFilter === 'today') return order.date === todayStr;
      if (dateFilter === 'yesterday') return order.date === yesterdayStr;
      if (dateFilter === 'last7') {
        const oDate = new Date(order.date);
        const limit = new Date();
        limit.setDate(limit.getDate() - 7);
        return oDate >= limit;
      }
      if (dateFilter === 'thisMonth') {
        const oDate = new Date(order.date);
        const now = new Date();
        return oDate.getMonth() === now.getMonth() && oDate.getFullYear() === now.getFullYear();
      }
      if (dateFilter === 'custom') {
        if (!customStartDate) return true;
        return order.date >= customStartDate && order.date <= (customEndDate || todayStr);
      }
      return true;
    });

    const totals = { all: dateFiltered.length, pending: 0, confirmed: 0, shipped: 0, delivered: 0, returned: 0, cancelled: 0 };
    dateFiltered.forEach(o => {
      if (totals[o.status] !== undefined) {
        totals[o.status]++;
      }
    });
    return totals;
  }, [orders, dateFilter, customStartDate, customEndDate, todayStr, yesterdayStr]);

  // 2. MAIN FILTER LOGIC - Stage 1: Date & Search Filter (Used for accurate status counts)
  const dateAndSearchFilteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Search Query filter (matches name, phone, address, product, notes)
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        order.name.toLowerCase().includes(q) ||
        order.phone.includes(q) ||
        (order.address && order.address.toLowerCase().includes(q)) ||
        (order.productName && order.productName.toLowerCase().includes(q)) ||
        (order.notes && order.notes.toLowerCase().includes(q));

      if (!matchSearch) return false;

      // Date Filter
      if (dateFilter === 'today') {
        return order.date === todayStr;
      } 
      else if (dateFilter === 'yesterday') {
        return order.date === yesterdayStr;
      } 
      else if (dateFilter === 'last7') {
        const orderDate = new Date(order.date);
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 7);
        return orderDate >= limitDate;
      } 
      else if (dateFilter === 'thisMonth') {
        const orderDate = new Date(order.date);
        const now = new Date();
        return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
      } 
      else if (dateFilter === 'custom') {
        if (!customStartDate) return true;
        const oDate = order.date;
        const start = customStartDate;
        const end = customEndDate || todayStr;
        return oDate >= start && oDate <= end;
      }

      return true; // dateFilter === 'all'
    });
  }, [orders, searchQuery, dateFilter, customStartDate, customEndDate, todayStr, yesterdayStr]);

  // Stage 2: Final filter applying Status (For view rendering)
  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return dateAndSearchFilteredOrders;
    return dateAndSearchFilteredOrders.filter(o => o.status === statusFilter);
  }, [dateAndSearchFilteredOrders, statusFilter]);

  // Group filtered orders by date for readability
  const groupedOrders = useMemo(() => {
    const groups = {};
    filteredOrders.forEach(order => {
      const date = order.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(order);
    });
    // Sort dates descending
    return Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).map(date => ({
      date,
      orders: groups[date]
    }));
  }, [filteredOrders]);

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return;
    
    const headers = ['Date', 'Name', 'Phone', 'Address', 'Product', 'Price (TK)', 'Status', 'Notes'];
    const rows = filteredOrders.map(o => [
      o.date,
      o.name.replace(/"/g, '""'),
      o.phone,
      (o.address || '').replace(/"/g, '""'),
      (o.productName || '').replace(/"/g, '""'),
      o.price || 0,
      o.status,
      (o.notes || '').replace(/"/g, '""')
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.map(val => `"${val}"`).join(','))].join('\n');
    
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app-content animate-fade-in">
      {/* Header with Export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          <ShoppingBag size={20} className="text-gradient" />
          Orders Dashboard
        </h2>
        
        {filteredOrders.length > 0 && (
          <button 
            type="button" 
            onClick={handleExportCSV} 
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {/* Filter Options (Single Line, Screen Fit Dropdowns) */}
      <div className="glass-card filter-bar-compact" style={{ display: 'flex', gap: '8px', padding: '8px 10px', marginBottom: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
            className="compact-filter-select"
            title="Date Filter"
          >
            <option value="all">📅 All Time</option>
            <option value="today">📅 Today</option>
            <option value="yesterday">📅 Yesterday</option>
            <option value="last7">📅 Last 7 Days</option>
            <option value="thisMonth">📅 This Month</option>
            <option value="custom">📅 Custom Range</option>
          </select>
        </div>
        
        <div style={{ flex: 1, minWidth: '120px' }}>
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="compact-filter-select"
            title="Status Filter"
            style={{
              borderColor: statusFilter !== 'all' ? `var(--status-${statusFilter})` : 'var(--border-light)',
              color: statusFilter !== 'all' ? `var(--status-${statusFilter})` : 'white'
            }}
          >
            <option value="all" style={{ color: 'white' }}>🚦 All Statuses ({statusCounts.all})</option>
            <option value="pending" style={{ color: 'var(--status-pending)' }}>🚦 Pending ({statusCounts.pending})</option>
            <option value="confirmed" style={{ color: 'var(--status-confirmed)' }}>🚦 Confirmed ({statusCounts.confirmed})</option>
            <option value="shipped" style={{ color: 'var(--status-shipped)' }}>🚦 Shipped ({statusCounts.shipped})</option>
            <option value="delivered" style={{ color: 'var(--status-delivered)' }}>🚦 Delivered ({statusCounts.delivered})</option>
            <option value="returned" style={{ color: 'var(--status-returned)' }}>🚦 Returned ({statusCounts.returned})</option>
            <option value="cancelled" style={{ color: 'var(--status-cancelled)' }}>🚦 Cancelled ({statusCounts.cancelled})</option>
          </select>
        </div>

        {/* Custom Date Inputs inline just below if 'custom' is active */}
        {dateFilter === 'custom' && (
          <div className="custom-date-grid animate-slide-up" style={{ width: '100%', display: 'flex', gap: '8px', marginTop: '6px' }}>
            <div className="field-group" style={{ flex: 1, margin: 0 }}>
              <input
                type="date"
                className="input-field"
                style={{ padding: '6px 8px', fontSize: '12px' }}
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                placeholder="Start"
              />
            </div>
            <div className="field-group" style={{ flex: 1, margin: 0 }}>
              <input
                type="date"
                className="input-field"
                style={{ padding: '6px 8px', fontSize: '12px' }}
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                placeholder="End"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. DYNAMIC KPI SECTION ON TOP OF LIST */}
      <div className="list-kpis-container">
        <div className="glass-card mini-kpi-card" style={{ borderLeft: '3px solid hsl(var(--primary-glow))' }}>
          <span className="mini-kpi-label">Total Orders</span>
          <span className="mini-kpi-val">{dateAndSearchFilteredOrders.length}</span>
        </div>
        
        <div className="glass-card mini-kpi-card" style={{ borderLeft: '3px solid var(--status-pending)' }}>
          <span className="mini-kpi-label" style={{ color: 'var(--status-pending)' }}>Pending</span>
          <span className="mini-kpi-val pending">{dateAndSearchFilteredOrders.filter(o => o.status === 'pending').length}</span>
        </div>
        
        <div className="glass-card mini-kpi-card" style={{ borderLeft: '3px solid var(--status-confirmed)' }}>
          <span className="mini-kpi-label" style={{ color: 'var(--status-confirmed)' }}>Successful</span>
          <span className="mini-kpi-val" style={{ color: 'var(--status-confirmed)' }}>
            {dateAndSearchFilteredOrders.filter(o => ['confirmed', 'shipped', 'delivered'].includes(o.status)).length}
          </span>
        </div>
        
        <div className="glass-card mini-kpi-card" style={{ borderLeft: '3px solid var(--status-cancelled)' }}>
          <span className="mini-kpi-label" style={{ color: 'var(--status-cancelled)' }}>Cancelled</span>
          <span className="mini-kpi-val" style={{ color: 'var(--status-cancelled)' }}>
            {dateAndSearchFilteredOrders.filter(o => ['cancelled', 'returned'].includes(o.status)).length}
          </span>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {filteredOrders.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '4px 4px 10px 4px', fontSize: '11.5px', color: 'var(--text-gray-dark)', fontWeight: 700 }}>
          <div 
            onClick={() => handleSelectAll(filteredOrders)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{
              width: '15px',
              height: '15px',
              borderRadius: '4px',
              border: `1.5px solid ${filteredOrders.every(o => selectedOrderIds.includes(o.id)) ? 'hsl(var(--primary-glow))' : 'rgba(255,255,255,0.2)'}`,
              background: filteredOrders.every(o => selectedOrderIds.includes(o.id)) ? 'hsl(var(--primary-glow))' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}>
              {filteredOrders.every(o => selectedOrderIds.includes(o.id)) && (
                <span style={{ fontSize: '9px', color: 'white', fontWeight: 'bold' }}>✓</span>
              )}
            </div>
            <span>Select All Filtered ({filteredOrders.length})</span>
          </div>
          {selectedOrderIds.length > 0 && (
            <button 
              type="button" 
              onClick={() => setSelectedOrderIds([])}
              style={{ background: 'transparent', border: 'none', color: 'var(--status-cancelled)', cursor: 'pointer', padding: 0, fontSize: '11px', fontWeight: 800 }}
            >
              Clear Selection ({selectedOrderIds.length})
            </button>
          )}
        </div>
      )}

      {/* Orders List rendered as single compact rows */}
      {groupedOrders.length === 0 ? (
        <div className="glass-card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <ShoppingBag size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <p>No orders found matching the filter criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {groupedOrders.map((group) => (
            <div key={group.date} className="date-group animate-slide-up">
              <h3 className="date-group-title">
                <Calendar size={14} />
                {group.date === todayStr ? 'TODAY' : (group.date === yesterdayStr ? 'YESTERDAY' : group.date)}
                <span className="date-group-count">({group.orders.length})</span>
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {group.orders.map((order) => (
                  <div 
                    key={order.id}
                    className="compact-order-row"
                    onClick={() => setSelectedOrder(order)}
                  >
                    {/* Inline Checkbox Selector */}
                    <div 
                      onClick={(e) => { e.stopPropagation(); toggleSelectOrder(order.id); }}
                      style={{ paddingRight: '8px', display: 'flex', alignItems: 'center', cursor: 'pointer', zIndex: 10 }}
                    >
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        border: `1.5px solid ${selectedOrderIds.includes(order.id) ? 'hsl(var(--primary-glow))' : 'rgba(255,255,255,0.2)'}`,
                        background: selectedOrderIds.includes(order.id) ? 'hsl(var(--primary-glow))' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}>
                        {selectedOrderIds.includes(order.id) && (
                          <span style={{ fontSize: '10px', color: 'white', fontWeight: 'bold' }}>✓</span>
                        )}
                      </div>
                    </div>

                    <div className="compact-left">
                      <span 
                        className="status-dot" 
                        style={{ 
                          color: `var(--status-${order.status})`,
                          backgroundColor: `var(--status-${order.status})` 
                        }} 
                      />
                      <div className="compact-info">
                        <span className="compact-name">{order.name}</span>
                        <span className="compact-subtext">{order.phone} • {order.productName || 'No Product'}</span>
                      </div>
                    </div>
                    <div className="compact-right">
                      <span className="compact-price">{order.price?.toLocaleString() || 0} TK</span>
                      <span className="compact-date">{order.date.substring(5)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. DETAIL POPUP / MODAL OVERLAY */}
      {selectedOrder && activeOrder && (
        <div className="modal-overlay animate-fade-in" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShoppingBag size={14} className="text-gradient" /> Order Details
              </span>
              <button 
                type="button" 
                className="icon-btn" 
                onClick={() => setSelectedOrder(null)}
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>
            <OrderCard order={activeOrder} />
          </div>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedOrderIds.length > 0 && (
        <div className="glass-panel animate-fade-in" style={{
          position: 'absolute',
          bottom: '84px',
          left: '16px',
          right: '16px',
          padding: '12px 14px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.95)',
          boxShadow: '0 -10px 25px rgba(0, 0, 0, 0.5), 0 5px 15px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 1050
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'white' }}>
              📝 Selected {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'Order' : 'Orders'}
            </span>
            <button 
              type="button" 
              onClick={() => setSelectedOrderIds([])}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
            >
              Cancel
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Change Status To:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
              {[
                { label: 'Pending', value: 'pending', color: 'var(--status-pending)' },
                { label: 'Confirm', value: 'confirmed', color: 'var(--status-confirmed)' },
                { label: 'Ship', value: 'shipped', color: 'var(--status-shipped)' },
                { label: 'Deliver', value: 'delivered', color: 'var(--status-delivered)' },
                { label: 'Return', value: 'returned', color: 'var(--status-returned)' },
                { label: 'Cancel', value: 'cancelled', color: 'var(--status-cancelled)' }
              ].map(statusItem => (
                <button
                  key={statusItem.value}
                  type="button"
                  onClick={() => handleBulkStatusUpdate(statusItem.value)}
                  style={{
                    padding: '6px 4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: statusItem.color,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'center'
                  }}
                  onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.08)'}
                  onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.03)'}
                >
                  {statusItem.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderList;
