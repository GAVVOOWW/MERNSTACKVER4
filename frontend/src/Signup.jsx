import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ReCAPTCHA from 'react-google-recaptcha';
import { BsShop } from 'react-icons/bs';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6Lcso4ErAAAAAPt7pVTU3dzevrxQFaKu6_Obv4bi'; // Default test key

const Signup = () => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: ''
    });
    
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState(''); // 'success', 'error', 'validation'
    const [modalMessage, setModalMessage] = useState('');
    const [modalTitle, setModalTitle] = useState('');
    const [errors, setErrors] = useState({});
    const [recaptchaValue, setRecaptchaValue] = useState(null);
    
    const recaptchaRef = useRef(null);
    const navigate = useNavigate();

    // Handle reCAPTCHA change
    const handleRecaptchaChange = (value) => {
        setRecaptchaValue(value);
        // Clear reCAPTCHA error if it exists
        if (errors.recaptcha) {
            setErrors(prev => ({
                ...prev,
                recaptcha: ''
            }));
        }
    };

    // Handle reCAPTCHA expiration
    const handleRecaptchaExpired = () => {
        setRecaptchaValue(null);
    };

    // Reset reCAPTCHA
    const resetRecaptcha = () => {
        if (recaptchaRef.current) {
            recaptchaRef.current.reset();
        }
        setRecaptchaValue(null);
    };

    // Handle input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Clear specific error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    // Validation function
    const validateForm = () => {
        const newErrors = {};
        
        // Name validation
        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required';
        } else if (formData.firstName.trim().length < 2) {
            newErrors.firstName = 'First name must be at least 2 characters';
        }
        
        if (!formData.lastName.trim()) {
            newErrors.lastName = 'Last name is required';
        } else if (formData.lastName.trim().length < 2) {
            newErrors.lastName = 'Last name must be at least 2 characters';
        }
        
        // Email validation
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }
        
        // Phone validation
        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required';
        } else if (!/^[\d\+\-\(\)\s]{10,15}$/.test(formData.phone.replace(/\s/g, ''))) {
            newErrors.phone = 'Please enter a valid phone number (10-15 digits)';
        }
        
        // Password validation
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters long';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
            newErrors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
        }
        
        // Confirm password validation
        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }
        
        // reCAPTCHA validation
        if (!recaptchaValue) {
            newErrors.recaptcha = 'Please complete the reCAPTCHA to verify you are not a robot.';
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
            const fullName = `${formData.firstName} ${formData.lastName}`.trim();
            
            console.log('Attempting registration with:', {
                name: fullName,
                email: formData.email,
                phone: formData.phone,
                backend: BACKEND_URL
            });

            // Check if backend URL is defined
            if (!BACKEND_URL) {
                throw new Error('Backend URL not configured. Please check your environment variables.');
            }

            const response = await axios.post(`${BACKEND_URL}/api/registeruser`, {
                name: fullName,
                email: formData.email.trim().toLowerCase(),
                password: formData.password,
                phone: formData.phone.trim(),
                role: 'user', // Default role
                recaptcha: recaptchaValue // Include reCAPTCHA token
            });

            console.log('Registration response:', response.data);

            if (response.data.success) {
                showModalWithMessage(
                    'success',
                    'Registration Successful!',
                    'Your account has been created successfully. You will be redirected to the login page.'
                );
                
                // Clear form
                setFormData({
                    firstName: '',
                    lastName: '',
                    email: '',
                    password: '',
                    confirmPassword: '',
                    phone: ''
                });
                resetRecaptcha(); // Reset reCAPTCHA after successful submission
                
                // Redirect after a short delay
                setTimeout(() => {
                    closeModal();
                    navigate('/');
                }, 2500);
            } else {
                showModalWithMessage(
                    'error',
                    'Registration Failed',
                    response.data.message || 'Registration failed. Please try again.'
                );
                resetRecaptcha(); // Reset reCAPTCHA on failure
            }
        } catch (error) {
            console.error('Registration error:', error);
            
            let errorMessage = 'An unexpected error occurred. Please try again.';
            let errorTitle = 'Registration Failed';
            
            if (error.message === 'Backend URL not configured. Please check your environment variables.') {
                errorMessage = error.message;
                errorTitle = 'Configuration Error';
            } else if (error.response) {
                // Server responded with error status
                if (error.response.status === 409) {
                    errorMessage = 'An account with this email already exists. Please use a different email or try logging in.';
                } else if (error.response.status === 400) {
                    // Handle validation errors from backend
                    const backendErrors = error.response.data.errors;
                    if (backendErrors && Array.isArray(backendErrors)) {
                        errorMessage = backendErrors.join('. ');
                    } else {
                        errorMessage = error.response.data.message || 'Validation failed';
                    }
                } else {
                    errorMessage = error.response.data.message || 
                                 `Server error: ${error.response.status}`;
                }
            } else if (error.request) {
                // Request was made but no response received
                if (error.code === 'ERR_NETWORK') {
                    errorMessage = 'Unable to connect to server. Please check:\n\n' +
                                 '• Is the backend server running?\n' +
                                 '• Is the server running on the correct port?\n' +
                                 '• Check your internet connection\n' +
                                 `• Backend URL: ${BACKEND_URL}`;
                    errorTitle = 'Connection Error';
                } else {
                    errorMessage = 'Unable to connect to server. Please check your internet connection.';
                }
            }
            
            showModalWithMessage(
                'error',
                errorTitle,
                errorMessage
            );
            resetRecaptcha(); // Reset reCAPTCHA on error
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
                            <p style={{ whiteSpace: 'pre-line' }}>{modalMessage}</p>
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
                <div className="card shadow-sm p-4 rounded-3" style={{ maxWidth: '550px', width: '100%', border: 'none' }}>
                    <div className="card-body">
                        <div className="text-center mb-4">
                            <div className="mb-3">
                                <BsShop size={48} style={{ color: '#EE4D2D' }} />
                            </div>
                            <h2 className="fw-bold mb-3" style={{ color: '#EE4D2D' }}>Create Your Account</h2>
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
                            <div className="row mb-3">
                                <div className="col">
                                    <div className="form-floating">
                                        <input
                                            type="text"
                                            id="firstName"
                                            name="firstName"
                                            placeholder="First Name"
                                            className={`form-control ${errors.firstName ? 'is-invalid' : ''}`}
                                            value={formData.firstName}
                                            onChange={handleInputChange}
                                            disabled={loading}
                                            required
                                        />
                                        <label htmlFor="firstName">First Name</label>
                                        {errors.firstName && (
                                            <div className="invalid-feedback">
                                                {errors.firstName}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="col">
                                    <div className="form-floating">
                                        <input
                                            type="text"
                                            id="lastName"
                                            name="lastName"
                                            placeholder="Last Name"
                                            className={`form-control ${errors.lastName ? 'is-invalid' : ''}`}
                                            value={formData.lastName}
                                            onChange={handleInputChange}
                                            disabled={loading}
                                            required
                                        />
                                        <label htmlFor="lastName">Last Name</label>
                                        {errors.lastName && (
                                            <div className="invalid-feedback">
                                                {errors.lastName}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="form-floating mb-3">
                                <input 
                                    type="email"
                                    id="email"
                                    name="email"
                                    placeholder="Enter your email"
                                    autoComplete="email"
                                    className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                                    value={formData.email}
                                    onChange={handleInputChange}
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
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    placeholder="Enter your phone number"
                                    autoComplete="tel"
                                    className={`form-control ${errors.phone ? 'is-invalid' : ''}`}
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    disabled={loading}
                                    required
                                />
                                <label htmlFor="phone">Phone Number</label>
                                {errors.phone && (
                                    <div className="invalid-feedback">
                                        {errors.phone}
                                    </div>
                                )}
                            </div>

                            <div className="form-floating mb-3">
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    placeholder="Enter your password"
                                    autoComplete="new-password"
                                    className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                                    value={formData.password}
                                    onChange={handleInputChange}
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

                            <div className="form-floating mb-3">
                                <input
                                    type="password"
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    placeholder="Confirm your password"
                                    autoComplete="new-password"
                                    className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    disabled={loading}
                                    required
                                />
                                <label htmlFor="confirmPassword">Confirm Password</label>
                                {errors.confirmPassword && (
                                    <div className="invalid-feedback">
                                        {errors.confirmPassword}
                                    </div>
                                )}
                            </div>
                             <div className="form-text mb-3">
                                Password must contain at least one uppercase letter, lowercase letter, and number.
                            </div>

                            <div className="mb-3 d-flex flex-column align-items-center">
                                <ReCAPTCHA
                                    sitekey={RECAPTCHA_SITE_KEY}
                                    onChange={handleRecaptchaChange}
                                    onExpired={handleRecaptchaExpired}
                                    ref={recaptchaRef}
                                />
                                {errors.recaptcha && (
                                    <div className="invalid-feedback d-block text-center mt-2">
                                        {errors.recaptcha}
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
                                        Creating Account...
                                    </>
                                ) : (
                                    'Register'
                                )}
                            </button>
                        </form>

                        <div className="text-center mt-4">
                            <p className="mb-0">Already have an account? <Link to="/login" className="fw-bold text-decoration-none" style={{ color: '#EE4D2D' }}>Log in</Link></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Component */}
            <Modal />
        </>
    );
};

export default Signup;