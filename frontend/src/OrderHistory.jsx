"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { useNavigate, Link } from "react-router-dom"
import {
    Container,
    Row,
    Col,
    Card,
    Button,
    Alert,
    Spinner,
    Badge,
    Table,
    Navbar,
    Nav,
    InputGroup,
    Form,
    Dropdown,
    Pagination,
    Modal,
} from "react-bootstrap"
import {
    BsClipboardCheck,
    BsSearch,
    BsFilter,
    BsEye,
    BsDownload,
    BsCalendar,
    BsCurrencyDollar,
    BsBoxSeam,
    BsCheckCircle,
    BsXCircle,
    BsClock,
    BsTruck,
    BsExclamationTriangle,
    BsShop,
    BsCart,
    BsPerson,
    BsBoxArrowRight,
    BsListUl,
    BsChatDots,
    BsArrowLeft,
    BsReceipt,
    BsGeoAlt,
    BsCalendarEvent,
    BsInfoCircle,
} from "react-icons/bs"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const OrderHistory = () => {
    const [orders, setOrders] = useState([])
    const [filteredOrders, setFilteredOrders] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [dateFilter, setDateFilter] = useState("all")
    const [currentPage, setCurrentPage] = useState(1)
    const [selectedOrder, setSelectedOrder] = useState(null)
    const [showOrderModal, setShowOrderModal] = useState(false)

    const navigate = useNavigate()
    const userRole = localStorage.getItem("role")
    const ordersPerPage = 10

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await axios.get(`${BACKEND_URL}/api/user/orders`, {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                })
                setOrders(response.data)
                setFilteredOrders(response.data)
            } catch (err) {
                setError(err.response?.data?.message || "Error fetching orders")
            } finally {
                setLoading(false)
            }
        }

        fetchOrders()
    }, [])

    // Filter orders based on search term, status, and date
    useEffect(() => {
        const filtered = orders.filter((order) => {
            const matchesSearch = order._id.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesStatus = statusFilter === "all" || order.status === statusFilter

            let matchesDate = true
            if (dateFilter !== "all") {
                const orderDate = new Date(order.createdAt)
                const now = new Date()
                const daysDiff = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24))

                switch (dateFilter) {
                    case "week":
                        matchesDate = daysDiff <= 7
                        break
                    case "month":
                        matchesDate = daysDiff <= 30
                        break
                    case "3months":
                        matchesDate = daysDiff <= 90
                        break
                    default:
                        matchesDate = true
                }
            }

            return matchesSearch && matchesStatus && matchesDate
        })

        // Sort by date (newest first)
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        setFilteredOrders(filtered)
        setCurrentPage(1)
    }, [searchTerm, statusFilter, dateFilter, orders])

    const getStatusVariant = (status) => {
        switch (status.toLowerCase()) {
            case "paid":
            case "completed":
                return "success"
            case "pending":
                return "warning"
            case "shipped":
                return "info"
            case "cancelled":
            case "failed":
                return "danger"
            default:
                return "secondary"
        }
    }

    const getStatusIcon = (status) => {
        switch (status.toLowerCase()) {
            case "paid":
            case "completed":
                return <BsCheckCircle />
            case "pending":
                return <BsClock />
            case "shipped":
                return <BsTruck />
            case "cancelled":
            case "failed":
                return <BsXCircle />
            default:
                return <BsInfoCircle />
        }
    }

    const handleViewOrder = async (orderId) => {
        try {
            const response = await axios.get(`${BACKEND_URL}/api/orders/${orderId}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            })
            setSelectedOrder(response.data)
            setShowOrderModal(true)
        } catch (err) {
            console.error("Error fetching order details:", err)
        }
    }

    // Pagination
    const indexOfLastOrder = currentPage * ordersPerPage
    const indexOfFirstOrder = indexOfLastOrder - ordersPerPage
    const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder)
    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage)

    // Calculate statistics
    const totalSpent = orders.reduce((sum, order) => sum + order.amount + (order.shippingFee || 0), 0)
    const completedOrders = orders.filter((order) => order.status === "Delivered").length
    const pendingOrders = orders.filter((order) => order.status === "On Process").length

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
                <div className="text-center">
                    <Spinner animation="border" variant="primary" style={{ width: "4rem", height: "4rem" }} />
                    <p className="mt-3 text-muted">Loading your order history...</p>
                </div>
            </Container>
        )
    }

    if (error) {
        return (
            <Container className="mt-5">
                <Alert variant="danger" className="shadow-sm">
                    <Alert.Heading>
                        <BsExclamationTriangle className="me-2" />
                        Error Loading Orders
                    </Alert.Heading>
                    <p>{error}</p>
                    <hr />
                    <div className="d-flex justify-content-end">
                        <Button variant="outline-danger" onClick={() => window.location.reload()}>
                            Try Again
                        </Button>
                    </div>
                </Alert>
            </Container>
        )
    }

    return (
        <>
            {/* Navigation Bar */}
            <Navbar bg="white" variant="light" expand="lg" sticky="top" className="py-3 border-bottom shadow-sm">
                <Container>
                    <Navbar.Brand as={Link} to="/" className="fw-bold fs-3" style={{ color: "#EE4D2D" }}>
                        <BsShop className="me-2" />
                        Wawa Furniture
                    </Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="me-auto">
                            <Nav.Link as={Link} to="/" className="fw-medium">
                                <BsShop className="me-1" />
                                Shop
                            </Nav.Link>
                            <Nav.Link as={Link} to="/cart" className="fw-medium">
                                <BsCart className="me-1" />
                                Cart
                            </Nav.Link>
                            <Nav.Link as={Link} to="/orders" active className="fw-medium">
                                <BsClipboardCheck className="me-1" />
                                My Orders
                            </Nav.Link>
                        </Nav>
                        <Nav className="ms-auto">
                            <Nav.Link as={Link} to="/profile" className="fw-medium">
                                <BsPerson className="me-1" />
                                Profile
                            </Nav.Link>
                            {userRole === "admin" && (
                                <Nav.Link as={Link} to="/admin" className="fw-medium">
                                    <BsListUl className="me-1" />
                                    Admin Panel
                                </Nav.Link>
                            )}

                            <Nav.Link
                                onClick={() => {
                                    localStorage.clear()
                                    navigate("/")
                                }}
                                className="fw-medium text-danger"
                            >
                                <BsBoxArrowRight className="me-1" />
                                Logout
                            </Nav.Link>
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>

            <Container className="my-5">
                {/* Page Header */}
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 className="fw-bold mb-1">
                            <BsClipboardCheck className="me-2 text-primary" />
                            Order History
                        </h2>
                        <p className="text-muted mb-0">Track and manage all your orders</p>
                    </div>
                    <Button variant="outline-secondary" as={Link} to="/">
                        <BsArrowLeft className="me-2" />
                        Back to Shop
                    </Button>
                </div>

                {orders.length === 0 ? (
                    /* Empty State */
                    <Card className="border-0 shadow-sm text-center" style={{ maxWidth: "600px", margin: "0 auto" }}>
                        <Card.Body className="p-5">
                            <BsReceipt size={80} className="text-muted mb-4" />
                            <h3 className="fw-bold mb-3">No Orders Yet</h3>
                            <p className="text-muted mb-4">
                                You haven't placed any orders yet. Start shopping to see your order history here!
                            </p>
                            <div className="d-flex justify-content-center gap-3">
                                <Button variant="primary" size="lg" as={Link} to="/">
                                    <BsShop className="me-2" />
                                    Start Shopping
                                </Button>
                                <Button variant="outline-secondary" size="lg" as={Link} to="/recommendation">
                                    <BsBoxSeam className="me-2" />
                                    Browse Categories
                                </Button>
                            </div>
                        </Card.Body>
                    </Card>
                ) : (
                    <>
                        {/* Statistics Cards */}
                        <Row className="mb-4">
                            <Col md={4} className="mb-3">
                                <Card className="border-0 shadow-sm h-100">
                                    <Card.Body className="text-center">
                                        <div className="d-flex align-items-center justify-content-center mb-2">
                                            <div className="bg-primary bg-opacity-10 p-3 rounded-circle">
                                                <BsReceipt size={24} className="text-primary" />
                                            </div>
                                        </div>
                                        <h3 className="fw-bold mb-1">{orders.length}</h3>
                                        <p className="text-muted mb-0">Total Orders</p>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={4} className="mb-3">
                                <Card className="border-0 shadow-sm h-100">
                                    <Card.Body className="text-center">
                                        <div className="d-flex align-items-center justify-content-center mb-2">
                                            <div className="bg-success bg-opacity-10 p-3 rounded-circle">
                                                <BsCheckCircle size={24} className="text-success" />
                                            </div>
                                        </div>
                                        <h3 className="fw-bold mb-1">{completedOrders}</h3>
                                        <p className="text-muted mb-0">Completed Orders</p>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={4} className="mb-3">
                                <Card className="border-0 shadow-sm h-100">
                                    <Card.Body className="text-center">
                                        <div className="d-flex align-items-center justify-content-center mb-2">
                                            <div className="bg-warning bg-opacity-10 p-3 rounded-circle">
                                                <BsCurrencyDollar size={24} className="text-warning" />
                                            </div>
                                        </div>
                                        <h3 className="fw-bold mb-1">₱{totalSpent.toFixed(2)}</h3>
                                        <p className="text-muted mb-0">Total Spent</p>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>

                        {/* Filters and Search */}
                        <Card className="border-0 shadow-sm mb-4">
                            <Card.Body>
                                <Row className="align-items-end">
                                    <Col md={4} className="mb-3">
                                        <Form.Label className="fw-medium">Search Orders</Form.Label>
                                        <InputGroup>
                                            <InputGroup.Text>
                                                <BsSearch />
                                            </InputGroup.Text>
                                            <Form.Control
                                                type="text"
                                                placeholder="Search by Order ID..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </InputGroup>
                                    </Col>
                                    <Col md={3} className="mb-3">
                                        <Form.Label className="fw-medium">Status</Form.Label>
                                        <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                            <option value="all">All Status</option>
                                            <option value="On Process">On Process</option>
                                            <option value="Delivered">Delivered</option>
                                            <option value="Requesting for Refund">Requesting for Refund</option>
                                            <option value="Refunded">Refunded</option>
                                            <option value="Cancelled">Cancelled</option>
                                        </Form.Select>
                                    </Col>
                                    <Col md={3} className="mb-3">
                                        <Form.Label className="fw-medium">Date Range</Form.Label>
                                        <Form.Select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                                            <option value="all">All Time</option>
                                            <option value="week">Last Week</option>
                                            <option value="month">Last Month</option>
                                            <option value="3months">Last 3 Months</option>
                                        </Form.Select>
                                    </Col>
                                    <Col md={2} className="mb-3">
                                        <Button
                                            variant="outline-secondary"
                                            className="w-100"
                                            onClick={() => {
                                                setSearchTerm("")
                                                setStatusFilter("all")
                                                setDateFilter("all")
                                            }}
                                        >
                                            <BsFilter className="me-1" />
                                            Clear
                                        </Button>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>

                        {/* Results Summary */}
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <p className="text-muted mb-0">
                                Showing {indexOfFirstOrder + 1} to {Math.min(indexOfLastOrder, filteredOrders.length)} of{" "}
                                {filteredOrders.length} orders
                            </p>
                            {pendingOrders > 0 && (
                                <Badge bg="warning" className="d-flex align-items-center">
                                    <BsClock className="me-1" />
                                    {pendingOrders} Pending Orders
                                </Badge>
                            )}
                        </div>

                        {/* Orders Table */}
                        <Card className="border-0 shadow-sm">
                            <Card.Body className="p-0">
                                <div className="table-responsive">
                                    <Table className="mb-0">
                                        <thead className="table-dark">
                                            <tr>
                                                <th>
                                                    <BsReceipt className="me-2" />
                                                    Order ID
                                                </th>
                                                <th>
                                                    <BsCalendarEvent className="me-2" />
                                                    Date & Time
                                                </th>
                                                <th>
                                                    <BsInfoCircle className="me-2" />
                                                    Status
                                                </th>
                                                <th>
                                                    <BsBoxSeam className="me-2" />
                                                    Items
                                                </th>
                                                <th>
                                                    <BsCurrencyDollar className="me-2" />
                                                    Total
                                                </th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentOrders.map((order) => (
                                                <tr key={order._id}>
                                                    <td>
                                                        <div className="fw-bold font-monospace">#{order._id.slice(-8)}</div>
                                                        <small className="text-muted">{order._id}</small>
                                                    </td>
                                                    <td>
                                                        <div className="fw-medium">{new Date(order.createdAt).toLocaleDateString()}</div>
                                                        <small className="text-muted">{new Date(order.createdAt).toLocaleTimeString()}</small>
                                                    </td>
                                                    <td>
                                                        <Badge bg={getStatusVariant(order.status)} className="d-flex align-items-center w-fit">
                                                            {getStatusIcon(order.status)}
                                                            <span className="ms-1 text-capitalize">{order.status}</span>
                                                        </Badge>
                                                    </td>
                                                    <td>
                                                        <div className="fw-medium">{order.items?.length || 0} items</div>
                                                        <small className="text-muted">
                                                            {order.items?.slice(0, 2).map((item, idx) => (
                                                                <div key={idx}>{item.item?.name || "Item"}</div>
                                                            ))}
                                                            {order.items?.length > 2 && <div>+{order.items.length - 2} more...</div>}
                                                        </small>
                                                    </td>
                                                    <td>
                                                        <div className="fw-bold text-primary fs-5">₱{order.totalWithShipping.toFixed(2)}</div>
                                                        {order.shippingFee > 0 && (
                                                            <small className="text-muted d-block">
                                                                Items: ₱{(order.amount || 0).toFixed(2)} + Shipping: ₱{(order.shippingFee || 0).toFixed(2)}
                                                            </small>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div className="d-flex gap-2">
                                                            <Button variant="outline-secondary" size="sm" onClick={() => navigate(`/orders/${order._id}`)}>
                                                                <BsEye className="me-2" />
                                                                View Details
                                                            </Button>

                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                            </Card.Body>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <Card.Footer className="bg-white">
                                    <div className="d-flex justify-content-center">
                                        <Pagination>
                                            <Pagination.Prev disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} />
                                            {[...Array(totalPages)].map((_, index) => (
                                                <Pagination.Item
                                                    key={index + 1}
                                                    active={index + 1 === currentPage}
                                                    onClick={() => setCurrentPage(index + 1)}
                                                >
                                                    {index + 1}
                                                </Pagination.Item>
                                            ))}
                                            <Pagination.Next
                                                disabled={currentPage === totalPages}
                                                onClick={() => setCurrentPage(currentPage + 1)}
                                            />
                                        </Pagination>
                                    </div>
                                </Card.Footer>
                            )}
                        </Card>
                    </>
                )}
            </Container>

            {/* Order Details Modal */}
            <Modal show={showOrderModal} onHide={() => setShowOrderModal(false)} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title className="fw-bold">
                        <BsReceipt className="me-2 text-primary" />
                        Order Details
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedOrder && (
                        <div>
                            <Row className="mb-4">
                                <Col md={6}>
                                    <Card className="border-0 bg-light">
                                        <Card.Body>
                                            <h6 className="fw-bold mb-3">Order Information</h6>
                                            <div className="mb-2">
                                                <strong>Order ID:</strong> #{selectedOrder._id?.slice(-8)}
                                            </div>
                                            <div className="mb-2">
                                                <strong>Date:</strong> {new Date(selectedOrder.createdAt).toLocaleString()}
                                            </div>
                                            <div className="mb-2">
                                                <strong>Status:</strong>{" "}
                                                <Badge bg={getStatusVariant(selectedOrder.status)} className="ms-1">
                                                    {selectedOrder.status}
                                                </Badge>
                                            </div>
                                            <div>
                                                <strong>Total:</strong>{" "}
                                                <span className="text-primary fw-bold">₱{(selectedOrder.amount + (selectedOrder.shippingFee || 0))?.toFixed(2)}</span>
                                                {selectedOrder.shippingFee > 0 && (
                                                    <div className="small text-muted">
                                                        Items: ₱{selectedOrder.amount?.toFixed(2)} + Shipping: ₱{selectedOrder.shippingFee?.toFixed(2)}
                                                    </div>
                                                )}
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col md={6}>
                                    <Card className="border-0 bg-light">
                                        <Card.Body>
                                            <h6 className="fw-bold mb-3">Delivery Information</h6>
                                            <div className="mb-2">
                                                <BsGeoAlt className="me-2 text-muted" />
                                                <strong>Address:</strong> {selectedOrder.shippingAddress || "Default Address"}
                                            </div>
                                            <div className="mb-2">
                                                <BsTruck className="me-2 text-muted" />
                                                <strong>Shipping:</strong> Standard Delivery
                                            </div>
                                            <div>
                                                <BsCalendar className="me-2 text-muted" />
                                                <strong>Expected:</strong> 3-5 business days
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>

                            <h6 className="fw-bold mb-3">Order Items</h6>
                            <div className="border rounded">
                                {selectedOrder.items?.map((item, index) => (
                                    <div key={index} className="d-flex align-items-center p-3 border-bottom">
                                        <img
                                            src={item.item?.imageUrl?.[0] || "https://via.placeholder.com/60"}
                                            alt={item.item?.name}
                                            style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "8px" }}
                                            className="me-3"
                                        />
                                        <div className="flex-grow-1">
                                            <div className="fw-medium">{item.item?.name || "Product Name"}</div>
                                            <small className="text-muted">Quantity: {item.quantity}</small>
                                        </div>
                                        <div className="text-end">
                                            <div className="fw-bold">₱{((item.item?.price || 0) * item.quantity).toFixed(2)}</div>
                                            <small className="text-muted">₱{(item.item?.price || 0).toFixed(2)} each</small>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowOrderModal(false)}>
                        Close
                    </Button>
                    <Button variant="primary" onClick={() => navigate(`/orders/${selectedOrder?._id}`)}>
                        <BsEye className="me-2" />
                        View Full Details
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    )
}

export default OrderHistory
