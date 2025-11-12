import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar, Container, Nav, InputGroup, Form } from 'react-bootstrap';
import {
    BsShop,
    BsHouse,
    BsCart,
    BsPerson,
    BsRobot,
    BsListUl,
    BsChatDots,
    BsBoxArrowRight,
    BsSearch,
} from 'react-icons/bs';

const MainNavbar = ({ enableSearch = false, searchValue = '', onSearchChange }) => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('role');

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('role');
        navigate('/');
    };

    return (
        <Navbar bg="white" variant="light" expand="lg" sticky="top" className="py-3 border-bottom shadow-sm">
            <Container fluid>
                <Navbar.Brand as={Link} to="/" className="fw-bold fs-3" style={{ color: '#EE4D2D' }}>
                    <BsShop className="me-2" />
                    Wawa Furniture
                </Navbar.Brand>
                <Navbar.Toggle aria-controls="main-navbar-nav" />
                <Navbar.Collapse id="main-navbar-nav">
                    <Nav className="me-auto">
                        <Nav.Link as={Link} to="/" className="fw-medium">
                            <BsHouse className="me-1" /> Shop
                        </Nav.Link>
                        {token && (
                            <Nav.Link as={Link} to="/cart" className="fw-medium">
                                <BsCart className="me-1" /> Cart
                            </Nav.Link>
                        )}
                        {token && (
                            <Nav.Link as={Link} to="/profile" className="fw-medium">
                                <BsPerson className="me-1" /> Profile
                            </Nav.Link>
                        )}
                        <Nav.Link as={Link} to="/recommendation" className="fw-medium text-primary">
                            <BsRobot className="me-1" /> AI Picks For You!
                        </Nav.Link>
                        {userRole === 'admin' && (
                            <Nav.Link as={Link} to="/admin" className="fw-medium">
                                <BsListUl className="me-1" /> Admin Panel
                            </Nav.Link>
                        )}
                      
                    </Nav>

                    {enableSearch && (
                        <div className="flex-grow-1 mx-4" style={{ maxWidth: '500px' }}>
                            <InputGroup>
                                <InputGroup.Text>
                                    <BsSearch />
                                </InputGroup.Text>
                                <Form.Control
                                    type="search"
                                    placeholder="Search for furniture, decor, and more..."
                                    value={searchValue}
                                    onChange={onSearchChange}
                                />
                            </InputGroup>
                        </div>
                    )}

                    <Nav className="ms-auto">
                        {!token ? (
                            <Nav.Link as={Link} to="/login" className="fw-medium">
                                Login
                            </Nav.Link>
                        ) : (
                            <Nav.Link onClick={handleLogout} className="fw-medium">
                                <BsBoxArrowRight className="me-1" /> Logout
                            </Nav.Link>
                        )}
                    </Nav>
                </Navbar.Collapse>
            </Container>
        </Navbar>
    );
};

export default MainNavbar; 