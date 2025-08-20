import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const CancelPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const orderId = new URLSearchParams(location.search).get('orderId');

  useEffect(() => {
    const cancelOrder = async () => {
      if (!orderId) return;

      try {
        await axios.put(
          `${BACKEND_URL}/api/orders/${orderId}/cancel`,
          {},
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          }
        );
      } catch (error) {
        console.error("Error cancelling order:", error);
      }
    };

    cancelOrder();
  }, [orderId]);

  return (
    <div className="container text-center mt-5">
      <h2>Payment Cancelled</h2>
      <button
        className="btn btn-primary mt-3"
        onClick={() => navigate('/cart')}
      >
        Back to Cart
      </button>
    </div>
  );
};

export default CancelPage;