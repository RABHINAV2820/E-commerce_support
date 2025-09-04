"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabaseClient";
import styles from "./orders.module.css";

type Order = {
  order_id: string;
  status: string;
  expected_delivery: string | null;
  delivered_on: string | null;
  items: any[];
  created_at: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const user = getCurrentUser();
    if (!user || user.role !== "user") {
      router.push("/login");
      return;
    }

    fetchOrders();
  }, [router]);

  async function fetchOrders() {
    try {
      // For demo purposes, fetch all orders since we don't have user-specific orders
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleRequestSupport(orderId: string) {
    console.log('OrdersPage: Requesting support for order:', orderId);
    
    // Open chat directly on current page with order context
    const chatContext = {
      orderId,
      message: `Hi, I see you're asking about Order #${orderId}. How can I help you?`
    };
    
    // Dispatch custom event to open chat widget with order context
    const openChatEvent = new CustomEvent('openChatWidget', {
      detail: { orderId, chatContext }
    });
    console.log('OrdersPage: Dispatching openChatWidget event with context:', chatContext);
    window.dispatchEvent(openChatEvent);
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading your orders...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>My Orders</h1>
        <p>Track your order status and request support</p>
      </div>
      
      <div className={styles.ordersList}>
        {orders.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No orders found.</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.order_id} className={styles.orderCard}>
              <div className={styles.orderHeader}>
                <div className={styles.orderInfo}>
                  <h3>Order #{order.order_id}</h3>
                  <span className={`${styles.status} ${styles[order.status]}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                </div>
                <div className={styles.orderDate}>
                  {new Date(order.created_at).toLocaleDateString()}
                </div>
              </div>
              
              <div className={styles.orderDetails}>
                <div className={styles.items}>
                  {order.items.map((item: any, index: number) => (
                    <div key={index} className={styles.item}>
                      <span className={styles.itemName}>{item.name}</span>
                      <span className={styles.itemPrice}>₹{item.price_inr}</span>
                    </div>
                  ))}
                </div>
                
                <div className={styles.deliveryInfo}>
                  {order.expected_delivery && (
                    <div className={styles.deliveryDate}>
                      <strong>Expected Delivery:</strong> {new Date(order.expected_delivery).toLocaleDateString()}
                    </div>
                  )}
                  {order.delivered_on && (
                    <div className={styles.deliveredDate}>
                      <strong>Delivered On:</strong> {new Date(order.delivered_on).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              
              <div className={styles.orderActions}>
                <button 
                  className={styles.supportBtn}
                  onClick={() => handleRequestSupport(order.order_id)}
                  aria-label={`Request support for order ${order.order_id}`}
                >
                  Request Support
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
