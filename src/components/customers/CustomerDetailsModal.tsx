import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Modal from '../ui/Modal';
import { Loader2, AlertTriangle, FileX, MessageSquare, DollarSign, ListOrdered, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import CustomerCommunicationLog from './enhancements/CustomerCommunicationLog'; // Import the new component

// View-லிருந்து வரும் ஆர்டர் தரவிற்கான வகை
interface Order {
  order_id: number;
  total_amount: number;
  status?: string;
  date: string;
}

// Payments டேபிளிலிருந்து வரும் தரவிற்கான வகை
interface Payment {
  id: string;
  order_id: number;
  amount_paid: number;
  payment_method?: string;
  created_at: string;
}

// Whatsapp_log டேபிளிலிருந்து வரும் தரவிற்கான வகை
interface WhatsappLog {
  id: number;
  phone: string;
  message: string;
  template_name?: string;
  sent_at: string;
}

interface CustomerDetailsModalProps {
  customerId: string;
  customerName: string;
  isOpen: boolean;
  onClose: () => void;
}

const CustomerDetailsModal: React.FC<CustomerDetailsModalProps> = ({ customerId, customerName, isOpen, onClose }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsappLog[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'payments' | 'whatsapp' | 'communication'>('orders');

  const fetchCustomerDetails = useCallback(async () => {
    if (!customerId || activeTab === 'communication') return; // Don't fetch for communication log tab
    setLoading(true);
    setError(null);

    try {
      if (activeTab === 'orders') {
        // First, fetch orders without status column
        const { data: ordersData, error: fetchError } = await supabase
          .from('order_summary_with_dues')
          .select('order_id, total_amount, date')
          .eq('customer_id', customerId)
          .order('date', { ascending: false });

        if (fetchError) throw fetchError;

        // Then fetch status for each order from order_status_log
        const ordersWithStatus = await Promise.all(
          (ordersData || []).map(async (order) => {
            const { data: statusData } = await supabase
              .from('order_status_log')
              .select('status')
              .eq('order_id', order.order_id)
              .order('created_at', { ascending: false })
              .limit(1);

            return {
              ...order,
              status: statusData?.[0]?.status || 'N/A'
            };
          })
        );

        setOrders(ordersWithStatus);
      } else if (activeTab === 'payments') {
        const { data, error: fetchError } = await supabase
          .from('payments')
          .select('id, order_id, amount_paid, payment_method, created_at')
          .eq('customer_id', customerId)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setPayments(data || []);
      } else if (activeTab === 'whatsapp') {
        const { data, error: fetchError } = await supabase
          .from('whatsapp_log')
          .select('id, phone, message, template_name, sent_at')
          .eq('customer_id', customerId)
          .order('sent_at', { ascending: false });

        if (fetchError) throw fetchError;
        setWhatsappLogs(data || []);
      }
    } catch (err: any) {
      console.error(`Error fetching ${activeTab} for customer:`, err);
      setError(err.message || `Could not load ${activeTab} data.`);
    } finally {
      setLoading(false);
    }
  }, [customerId, activeTab]);

  useEffect(() => {
    if (isOpen) {
      fetchCustomerDetails();
    }
  }, [isOpen, customerId, activeTab, fetchCustomerDetails]);

  const renderContent = () => {
    if (loading) {
      return <div className="flex justify-center items-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;
    }
    if (error) {
      return <div className="py-10 text-center text-red-600"><AlertTriangle className="mx-auto h-8 w-8 mb-2" /><p>{error}</p></div>;
    }

    switch (activeTab) {
      case 'orders':
        return orders.length === 0 ? (
          <div className="text-center py-10 text-gray-500"><FileX className="mx-auto h-10 w-10 mb-2" /><p>No orders found for this customer.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                <tr>
                  <th className="px-4 py-2">Order #</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {orders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-2 font-medium">#{order.order_id}</td>
                    <td className="px-4 py-2">₹{order.total_amount.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2"><span className={`px-2 py-1 text-xs rounded-full font-medium ${order.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{order.status || 'N/A'}</span></td>
                    <td className="px-4 py-2">{new Date(order.date).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-2 text-right"><Link to={`/invoices/${order.order_id}`}><Button variant="link" size="sm">View Invoice</Button></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'payments':
        return payments.length === 0 ? (
            <div className="text-center py-10 text-gray-500"><DollarSign className="mx-auto h-10 w-10 mb-2" /><p>No payment records found.</p></div>
        ) : (
            <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                <tr><th className="px-4 py-2">Payment ID</th><th className="px-4 py-2">Order #</th><th className="px-4 py-2">Amount Paid</th><th className="px-4 py-2">Method</th><th className="px-4 py-2">Date</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {payments.map((payment) => (<tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="px-4 py-2 max-w-xs truncate">{payment.id}</td><td className="px-4 py-2">#{payment.order_id}</td><td className="px-4 py-2">₹{payment.amount_paid.toLocaleString('en-IN')}</td><td className="px-4 py-2">{payment.payment_method || '-'}</td><td className="px-4 py-2">{new Date(payment.created_at).toLocaleDateString('en-GB')}</td></tr>))}
                </tbody>
            </table>
            </div>
        );
      case 'whatsapp':
        return whatsappLogs.length === 0 ? (
            <div className="text-center py-10 text-gray-500"><MessageSquare className="mx-auto h-10 w-10 mb-2" /><p>No WhatsApp logs found.</p></div>
        ) : (
            <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                <tr><th className="px-4 py-2">Phone</th><th className="px-4 py-2">Message</th><th className="px-4 py-2">Template</th><th className="px-4 py-2">Date</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {whatsappLogs.map((log) => (<tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50"><td className="px-4 py-2">{log.phone}</td><td className="px-4 py-2 max-w-xs truncate">{log.message}</td><td className="px-4 py-2">{log.template_name || '-'}</td><td className="px-4 py-2">{new Date(log.sent_at).toLocaleDateString('en-GB')}</td></tr>))}
                </tbody>
            </table>
            </div>
        );
      case 'communication':
        return <CustomerCommunicationLog customerId={Number(customerId)} />;
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Customer Details: ${customerName}`} size="3xl">
      <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          <button className={`flex items-center gap-2 px-1 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'orders' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('orders')}><ListOrdered size={16} /> Orders</button>
          <button className={`flex items-center gap-2 px-1 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'payments' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('payments')}><DollarSign size={16} /> Payments</button>
          <button className={`flex items-center gap-2 px-1 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'whatsapp' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('whatsapp')}><MessageSquare size={16} /> WhatsApp Logs</button>
          <button className={`flex items-center gap-2 px-1 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${activeTab === 'communication' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`} onClick={() => setActiveTab('communication')}><ClipboardList size={16} /> Communication Log</button>
        </nav>
      </div>
      <div>{renderContent()}</div>
    </Modal>
  );
};

export default CustomerDetailsModal;