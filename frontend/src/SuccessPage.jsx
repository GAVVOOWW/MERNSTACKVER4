import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// A simple spinner component for loading states
const Spinner = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ height: '100px' }}>
    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
      <span className="visually-hidden">Loading...</span>
    </div>
  </div>
);

const SuccessPage = () => {
  const navigate = useNavigate();
  // This ref ensures the effect logic runs only once, even in React's Strict Mode.
  const hasRun = useRef(false);

  // State to manage UI feedback
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Prevent the effect from running more than once on component mount.
    if (hasRun.current) return;
    hasRun.current = true;

    console.log("=== SUCCESS PAGE LOADED, PROCESSING ORDER ===");

    const processOrder = async () => {
      try {
        console.log("Checking localStorage for order data, user ID, and token...");
        const storedOrderData = localStorage.getItem('orderData');
        const userId = localStorage.getItem('userId');
        const token = localStorage.getItem('token');

        console.log("Stored order data exists:", !!storedOrderData);
        console.log("User ID:", userId);

        // If there's no stored order data, we can't proceed.
        // This also prevents reprocessing on a page refresh after the data has been cleared.
        if (!storedOrderData) {
          console.error("ERROR: No order data found in localStorage.");
          setError("Could not find order data to process. If you have already completed your order, please check your order history.");
          setIsLoading(false); // Stop loading to show the error.
          return;
        }

        const orderData = JSON.parse(storedOrderData);
        console.log("=== PARSED ORDER DATA ===", orderData);

        // 1. Send the order to the backend to create the order record.
        console.log("=== 1. SENDING ORDER TO BACKEND ===");
        await axios.post(`${BACKEND_URL}/api/orders`, orderData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log("Order saved successfully.");

        // 2. Decrease stock and increase sales for each item in the order.
        console.log("=== 2. UPDATING STOCK AND SALES ===");
        await axios.post(
          `${BACKEND_URL}/api/items/decrease-stock`,
          {
            items: orderData.items.map(entry => ({
              itemId: entry.item,
              quantity: entry.quantity
            }))
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log("Stock decreased and sales updated successfully.");

        // 3. Clean up the user's cart.
        console.log("=== 3. CLEANING UP CART ===");
        await cleanupCart(userId, token);

        // 4. Clean up localStorage to prevent reprocessing.
        console.log("=== 4. CLEARING LOCAL STORAGE DATA ===");
        localStorage.removeItem('orderData');
        localStorage.removeItem('checkedOutItemIds');

        // 5. Update UI to confirm success.
        console.log("=== ORDER PROCESSING COMPLETED SUCCESSFULLY ===");
        setSuccessMessage('Your order has been successfully placed and confirmed!');

      } catch (err) {
        console.error('=== ORDER PROCESSING ERROR ===');
        console.error('Failed to process order:', err);
        const errorMessage = err.response?.data?.message || 'An unexpected error occurred while processing your order. Please contact support.';
        setError(errorMessage);
      } finally {
        // Stop the loading indicator regardless of success or failure.
        setIsLoading(false);
      }
    };

    processOrder();
  }, []); // The empty dependency array ensures this effect runs only on the initial mount.

  // Helper function to handle cart cleanup.
  const cleanupCart = async (userId, token) => {
    const itemIdsString = localStorage.getItem('checkedOutItemIds');
    if (!itemIdsString) {
      console.log("No checked-out item IDs found to clean from cart.");
      return;
    }
    const itemIds = JSON.parse(itemIdsString);
    console.log("Items to remove from cart:", itemIds);

    if (itemIds.length > 0 && userId) {
      // Using Promise.all to run deletions in parallel for efficiency.
      await Promise.all(itemIds.map(async (itemId) => {
        try {
          await axios.delete(`${BACKEND_URL}/api/cart/${userId}/item/${itemId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          console.log(`Successfully removed item ${itemId} from cart.`);
        } catch (err) {
          if (err.response?.status === 404) {
            console.warn(`Item ${itemId} was already removed from cart (404).`);
          } else {
            // Log the error but don't block the overall success of the operation.
            console.error(`Failed to remove item ${itemId} from cart:`, err.response?.data || err.message);
          }
        }
      }));
    } else {
      console.log("No items to remove or no user ID was provided.");
    }
    console.log("=== CART CLEANUP COMPLETED ===");
  };

  // Renders UI content based on the current state (loading, error, or success).
  const renderContent = () => {
    if (isLoading) {
      return (
        <>
          <h2>Finalizing Your Order...</h2>
          <p>Please wait, we're confirming the details. Do not refresh the page.</p>
          <Spinner />
        </>
      );
    }

    if (error) {
      return (
        <>
          <h2 className="text-danger">Order Processing Failed</h2>
          <p className="text-danger fw-bold">{error}</p>
          <p>If you believe payment was taken, please save a screenshot and contact our support team immediately.</p>
          <button className="btn btn-primary mt-3" onClick={() => navigate('/')}>
            Back to Homepage
          </button>
        </>
      );
    }

    return (
      <>
        <h2 className="text-success">Thank you for your order!</h2>
        <p>{successMessage}</p>
        <div className="d-grid gap-2 d-sm-flex justify-content-sm-center mt-4">
          <button
            className="btn btn-primary btn-lg px-4 gap-3"
            onClick={() => navigate('/orders')}
          >
            View Your Orders
          </button>
          <button
            className="btn btn-outline-secondary btn-lg px-4"
            onClick={() => navigate('/')}
          >
            Continue Shopping
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="container mt-5 text-center">
      <div className="card p-4 p-md-5 shadow-sm">
        {renderContent()}
      </div>
    </div>
  );
};

export default SuccessPage;
