import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { BsShop } from 'react-icons/bs';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState(''); // 'success', 'error', 'validation'
    const [modalMessage, setModalMessage] = useState('');
    const [modalTitle, setModalTitle] = useState('');
    const [errors, setErrors] = useState({});
    
    const navigate = useNavigate();

    // Validation function
    const validateForm = () => {
        const newErrors = {};
        
        if (!email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Please enter a valid email address';
        }
        
        if (!password.trim()) {
            newErrors.password = 'Password is required';
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters long';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Show modal function
    const showModalWithMessage = (type, title, message) => {
        setModalType(type);
        setModalTitle(title);
        setModalMessage(message);
        setShowModal(true);
    };

    // Close modal function
    const closeModal = () => {
        setShowModal(false);
        setModalType('');
        setModalMessage('');
        setModalTitle('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Clear previous errors
        setErrors({});
        
        // Validate form
        if (!validateForm()) {
            showModalWithMessage(
                'validation',
                'Validation Error',
                'Please fix the errors below and try again.'
            );
            return;
        }

        setLoading(true);

        try {
            console.log('Attempting login with:', { email, backend: BACKEND_URL });
            
            const response = await axios.post(`${BACKEND_URL}/api/login`, { 
                email: email.trim(), 
                password: password.trim() 
            });

            console.log('Login response:', response.data);

            if (response.data.success) {
                // Store user data
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('userId', response.data.userId);
                localStorage.setItem('role', response.data.role);
                
                // Show success modal
                showModalWithMessage(
                    'success',
                    'Login Successful!',
                    `Welcome back! You will be redirected to the homepage.`
                );
                
                // Redirect after a short delay
                setTimeout(() => {
                    closeModal();
                    navigate('/');
                }, 2000);
            } else {
                showModalWithMessage(
                    'error',
                    'Login Failed',
                    response.data.message || 'Login failed. Please try again.'
                );
            }
        } catch (error) {
            console.error('Login error:', error);
            
            let errorMessage = 'An unexpected error occurred. Please try again.';
            
            if (error.response) {
                // Server responded with error status
                errorMessage = error.response.data.message || 
                             `Server error: ${error.response.status}`;
            } else if (error.request) {
                // Request was made but no response received
                errorMessage = 'Unable to connect to server. Please check your internet connection.';
            }
            
            showModalWithMessage(
                'error',
                'Login Failed',
                errorMessage
            );
        } finally {
            setLoading(false);
        }
    };

    // Modal component
    const Modal = () => {
        if (!showModal) return null;

        const getModalClass = () => {
            switch (modalType) {
                case 'success': return 'text-success';
                case 'error': return 'text-danger';
                case 'validation': return 'text-warning';
                default: return '';
            }
        };

        const getIcon = () => {
            switch (modalType) {
                case 'success': return '✅';
                case 'error': return '❌';
                case 'validation': return '⚠️';
                default: return 'ℹ️';
            }
        };

        return (
            <div className="modal" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className={`modal-title ${getModalClass()}`}>
                                {getIcon()} {modalTitle}
                            </h5>
                            <button 
                                type="button" 
                                className="btn-close" 
                                onClick={closeModal}
                                disabled={loading}
                            ></button>
                        </div>
                        <div className="modal-body">
                            <p>{modalMessage}</p>
                            {modalType === 'validation' && Object.keys(errors).length > 0 && (
                                <ul className="list-unstyled mt-2">
                                    {Object.values(errors).map((error, index) => (
                                        <li key={index} className="text-danger small">
                                            • {error}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={closeModal}
                                disabled={loading}
                            >
                                {modalType === 'success' ? 'Close' : 'Try Again'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="d-flex justify-content-center align-items-center vh-100" style={{ backgroundColor: '#f8f9fa' }}>
                <div className="card shadow-sm p-4 rounded-3" style={{ maxWidth: '450px', width: '100%', border: 'none' }}>
                    <div className="card-body">
                        <div className="text-center mb-4">
                            <div className="mb-3">
                                <BsShop size={48} style={{ color: '#EE4D2D' }} />
                            </div>
                            <h2 className="fw-bold mb-3" style={{ color: '#EE4D2D' }}>Welcome Back</h2>
                            <div
                                className="mx-auto mb-4"
                                style={{
                                    height: "4px",
                                    width: "80px",
                                    backgroundColor: "#EE4D2D",
                                    borderRadius: "2px",
                                }}
                            ></div>
                        </div>
                        <form onSubmit={handleSubmit} noValidate>
                            <div className="form-floating mb-3">
                                <input 
                                    type="email"
                                    id="email"
                                    placeholder="Enter your email"
                                    autoComplete="email"
                                    name="email"
                                    className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                    required
                                />
                                <label htmlFor="email">Email address</label>
                                {errors.email && (
                                    <div className="invalid-feedback">
                                        {errors.email}
                                    </div>
                                )}
                            </div>

                            <div className="form-floating mb-3">
                                <input 
                                    type="password"
                                    id="password"
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    name="password"
                                    className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    required
                                />
                                <label htmlFor="password">Password</label>
                                {errors.password && (
                                    <div className="invalid-feedback">
                                        {errors.password}
                                    </div>
                                )}
                            </div>

                            <button 
                                type="submit" 
                                className="btn w-100 mt-3 btn-lg fw-bold"
                                style={{ 
                                    backgroundColor: loading ? '#EE4D2D' : '#EE4D2D', 
                                    borderColor: '#EE4D2D',
                                    color: 'white',
                                    transition: 'all 0.3s ease'
                                }}
                                onMouseOver={(e) => !loading && (e.target.style.backgroundColor = '#FF8A50')}
                                onMouseOut={(e) => !loading && (e.target.style.backgroundColor = '#EE4D2D')}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Logging in...
                                    </>
                                ) : (
                                    'Login'
                                )}
                            </button>
                        </form>

                        <div className="text-center mt-4">
                            <p className="mb-0">Don't have an account yet? <Link to="/register" className="fw-bold text-decoration-none" style={{ color: '#EE4D2D' }}>Register</Link></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Component */}
            <Modal />
        </>
    );
};

export default Login;