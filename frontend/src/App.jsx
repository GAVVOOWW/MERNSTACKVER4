import React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Signup from './Signup.jsx';
import Login from './Login.jsx';
import Home from './Home.jsx';
import Itemspage from './Itemspage.jsx';
import SingleItemPage from './SingleItemPage.jsx';
import AdminPage from './AdminPage.jsx';
import CheckoutPage from './CheckoutPage.jsx';
import SuccessPage from './SuccessPage.jsx';
import CancelPage from './CancelPage.jsx';
import OrderHistory from './OrderHistory.jsx';
import OrderDetail from './OrderDetail.jsx';
import ChatPage from './ChatPage.jsx';
import RecommendationPage from './RecommendationPage.jsx';
import UserProfile from './UserProfile.jsx';
import ProtectedRoute from './ProtectedRoute.jsx';
import AnalyticsView from './AnalyticsView.jsx';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Signup />} />
        <Route path="/" element={<Itemspage />} />
        <Route path="/item/:id" element={<SingleItemPage />} />
        <Route path="/cart" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="/success" element={<ProtectedRoute><SuccessPage /></ProtectedRoute>} />
        <Route path="/cancel" element={<ProtectedRoute><CancelPage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><OrderHistory /></ProtectedRoute>} />
        <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AnalyticsView /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
        <Route path="/recommendation" element={<RecommendationPage />} />
        <Route path="*" element={<div className="container mt-5"><h2>404 - Page Not Found</h2></div>} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
