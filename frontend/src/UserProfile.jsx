"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Alert,
  Spinner,
  Nav,
  Tab,
  Table,
  Card,
  Badge,
  InputGroup,
  Modal,
  Breadcrumb,
  Navbar,
  Pagination
} from "react-bootstrap"
import {
  BsGeoAlt,
  BsPersonCircle,
  BsPhone,
  BsEnvelope,
  BsHouseDoor,
  BsBoxSeam,
  BsPencil,
  BsCheck,
  BsX,
  BsChat,
  BsCalendar,
  BsCreditCard,
  BsTruck,
  BsShield,
  BsClockHistory,
  BsExclamationTriangle,
  BsCheckCircle,
  BsXCircle,
  BsEye,
  BsArrowLeft,
  BsGear,
  BsBell,
  BsHeart,
  BsStar,
  BsShop,
  BsHouse,
  BsCart,
  BsPerson,
  BsRobot,
  BsListUl,
  BsChatDots,
  BsBoxArrowRight,
  BsSearch
} from "react-icons/bs"
import MainNavbar from "./components/MainNavbar.jsx"
import { useNavigate, Link } from "react-router-dom"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const UserProfile = () => {
  const navigate = useNavigate()
  const token = localStorage.getItem("token")
  const userId = localStorage.getItem("userId")

  // Address state
  const [shippingInfo, setShippingInfo] = useState({
    fullName: "",
    addressLine1: "",
    addressLine2: "",
    province: "",
    city: "",
    brgy: "",
    postalCode: "",
    phone: "",
  })
  const [editingAddress, setEditingAddress] = useState(false)
  const [addressLoading, setAddressLoading] = useState(true)
  const [savingAddress, setSavingAddress] = useState(false)

  // Orders state
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showOrderModal, setShowOrderModal] = useState(false)

  // User info state
  const [userInfo, setUserInfo] = useState({
    name: "",
    email: "",
  })

  // PSGC dropdown states
  const [provinces, setProvinces] = useState([])
  const [cities, setCities] = useState([])
  const [barangays, setBarangays] = useState([])
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false)
  const [isLoadingCities, setIsLoadingCities] = useState(false)
  const [isLoadingBarangays, setIsLoadingBarangays] = useState(false)

  // Active tab state
  const [activeTab, setActiveTab] = useState("profile")

  // Pagination state for orders
  const [currentPage, setCurrentPage] = useState(1)
  const [ordersPerPage] = useState(5)

  // Additional state variables
  const [search, setSearch] = useState("")
  const userRole = localStorage.getItem("role")

  // Fetch address & orders on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (token && userId) {
          const [{ data: userRes }, { data: orderRes }] = await Promise.all([
            axios.get(`${BACKEND_URL}/api/singleusers/${userId}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            axios.get(`${BACKEND_URL}/api/user/orders`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ])

          const userData = userRes.UserData || {}
          const addr = userData.address || {}

          setUserInfo({
            name: userData.name || "",
            email: userData.email || "",
          })

          setShippingInfo({
            fullName: addr.fullName || userData.name || "",
            addressLine1: addr.addressLine1 || "",
            addressLine2: addr.addressLine2 || "",
            province: addr.provinceName || "",
            city: addr.cityName || "",
            brgy: addr.brgyName || "",
            postalCode: addr.postalCode || "",
            phone: userData.phone || "",
          })

          setOrders(orderRes)
        }
      } catch (err) {
        console.error(err)
        setError("Failed to load profile data.")
      } finally {
        setAddressLoading(false)
        setOrdersLoading(false)
      }
    }
    fetchData()

    // fetch provinces
    const fetchProvinces = async () => {
      setIsLoadingProvinces(true)
      try {
        const res = await axios.get(`${BACKEND_URL}/api/psgc/provinces?filter=metro-rizal`)
        const filtered = res.data.filter((p) => p.name === "Metro Manila" || p.name === "Rizal")
        setProvinces(filtered)
      } catch (err) {
        console.error("Failed to fetch provinces", err)
      } finally {
        setIsLoadingProvinces(false)
      }
    }
    fetchProvinces()
  }, [token, userId])

  // Fetch cities when province changes
  useEffect(() => {
    if (!shippingInfo.province) return
    let url
    if (shippingInfo.province === "NCR") {
      url = `${BACKEND_URL}/api/psgc/regions/130000000/cities`
    } else {
      url = `${BACKEND_URL}/api/psgc/provinces/${shippingInfo.province}/cities`
    }
    const fetchCities = async () => {
      setIsLoadingCities(true)
      setCities([])
      setBarangays([])
      setShippingInfo((prev) => ({ ...prev, city: "", brgy: "" }))
      try {
        const res = await axios.get(url)
        setCities(res.data)
      } catch (err) {
        console.error("Failed to fetch cities", err)
      } finally {
        setIsLoadingCities(false)
      }
    }
    fetchCities()
  }, [shippingInfo.province])

  // Fetch barangays when city changes
  useEffect(() => {
    if (!shippingInfo.city) return
    const fetchBarangays = async () => {
      setIsLoadingBarangays(true)
      setBarangays([])
      setShippingInfo((prev) => ({ ...prev, brgy: "" }))
      try {
        const res = await axios.get(`${BACKEND_URL}/api/psgc/cities/${shippingInfo.city}/barangays`)
        setBarangays(res.data)
      } catch (err) {
        console.error("Failed to fetch barangays", err)
      } finally {
        setIsLoadingBarangays(false)
      }
    }
    fetchBarangays()
  }, [shippingInfo.city])

  const handleAddressSave = async () => {
    setSavingAddress(true)
    try {
      await axios.put(`${BACKEND_URL}/api/user/address`, shippingInfo, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setEditingAddress(false)
    } catch (err) {
      alert(err.response?.data?.message || "Error saving address")
    } finally {
      setSavingAddress(false)
    }
  }

  // Helper function to get status badge variant
  const getStatusVariant = (status) => {
    switch (status) {
      case "paid":
        return "success"
      case "completed":
        return "primary"
      case "shipped":
        return "info"
      case "cancelled":
        return "danger"
      case "failed":
        return "danger"
      default:
        return "warning"
    }
  }

  // Helper function to get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case "paid":
        return <BsCreditCard className="me-1" />
      case "completed":
        return <BsCheckCircle className="me-1" />
      case "shipped":
        return <BsTruck className="me-1" />
      case "cancelled":
      case "failed":
        return <BsXCircle className="me-1" />
      default:
        return <BsClockHistory className="me-1" />
    }
  }

  const handleViewOrder = (order) => {
    setSelectedOrder(order)
    setShowOrderModal(true)
  }

  const getOrderStats = () => {
    const total = orders.length;
    const delivered = orders.filter(
      (o) => o.status === "Delivered" || o.status === "Picked Up"
    ).length;
    const onProcess = orders.filter(
      (o) => o.status === "On Process" || o.status === "Ready for Pickup"
    ).length;
    const totalSpent = orders
      .filter((o) =>
        ["Delivered", "Picked Up", "On Process", "Ready for Pickup"].includes(
          o.status
        )
      )
      .reduce((sum, o) => sum + o.amount, 0);

    return { total, delivered, onProcess, totalSpent };
  };

  if (error) {
    return (
      <Container className="mt-5">
        <Alert variant="danger" className="border-0 shadow-sm">
          <div className="d-flex align-items-center">
            <BsExclamationTriangle className="me-3 fs-4" />
            <div>
              <Alert.Heading className="mb-1">Error Loading Profile</Alert.Heading>
              <p className="mb-0">{error}</p>
            </div>
          </div>
        </Alert>
      </Container>
    )
  }

  // Pagination logic for orders
  const indexOfLastOrder = currentPage * ordersPerPage
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage
  const currentOrders = orders.slice(indexOfFirstOrder, indexOfLastOrder)
  const totalPages = Math.ceil(orders.length / ordersPerPage)

  const paginate = (pageNumber) => setCurrentPage(pageNumber)

  const stats = getOrderStats()

  return (
    <>
            {/* Navigation Bar */}
      <MainNavbar />

      <Container className="my-4">
        {/* Profile Header */}
        <Card className="border-0 shadow-sm mb-4">
          <Card.Body className="p-4">
            <Row className="align-items-center">
              <Col md={8}>
                <div className="d-flex align-items-center">
                  <div
                    className="d-flex align-items-center justify-content-center rounded-circle me-4"
                    style={{
                      width: "80px",
                      height: "80px",
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    }}
                  >
                    <BsPersonCircle size={40} className="text-white" />
                  </div>
                  <div>
                    <h2 className="fw-bold mb-1">{userInfo.name || "Welcome!"}</h2>
                    <p className="text-muted mb-2">
                      <BsEnvelope className="me-2" />
                      {userInfo.email}
                    </p>
                    <Badge bg="success" className="px-3 py-2">
                      <BsShield className="me-1" />
                      Verified Account
                    </Badge>
                  </div>
                </div>
              </Col>
              <Col md={4} className="text-md-end">
                <div className="d-flex flex-column gap-2">

                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Quick Stats */}
        <Row className="g-4 mb-4">
          <Col lg={3} md={6}>
            <Card className="border-0 shadow-sm h-100 text-center">
              <Card.Body className="p-4">
                <div className="text-primary mb-2">
                  <BsBoxSeam size={32} />
                </div>
                <h4 className="fw-bold mb-1">{stats.total}</h4>
                <p className="text-muted mb-0">Total Orders</p>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3} md={6}>
            <Card className="border-0 shadow-sm h-100 text-center">
              <Card.Body className="p-4">
                <div className="text-success mb-2">
                  <BsCheckCircle size={32} />
                </div>
                <h4 className="fw-bold mb-1">{stats.delivered}</h4>
                <p className="text-muted mb-0">Completed</p>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3} md={6}>
            <Card className="border-0 shadow-sm h-100 text-center">
              <Card.Body className="p-4">
                <div className="text-warning mb-2">
                  <BsClockHistory size={32} />
                </div>
                <h4 className="fw-bold mb-1">{stats.onProcess}</h4>
                <p className="text-muted mb-0">In Progress</p>
              </Card.Body>
            </Card>
          </Col>
          <Col lg={3} md={6}>
            <Card className="border-0 shadow-sm h-100 text-center">
              <Card.Body className="p-4">
                <div className="text-info mb-2">
                  <BsCreditCard size={32} />
                </div>
                <h4 className="fw-bold mb-1">₱{stats.totalSpent.toLocaleString()}</h4>
                <p className="text-muted mb-0">Total Spent</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Main Content */}
        <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-bottom">
              <Nav variant="pills" className="nav-fill">
                <Nav.Item>
                  <Nav.Link eventKey="profile" className="d-flex align-items-center justify-content-center">
                    <BsPersonCircle className="me-2" />
                    Profile Info
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="address" className="d-flex align-items-center justify-content-center">
                    <BsGeoAlt className="me-2" />
                    Address
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="orders" className="d-flex align-items-center justify-content-center">
                    <BsBoxSeam className="me-2" />
                    Orders ({orders.length})
                  </Nav.Link>
                </Nav.Item>

              </Nav>
            </Card.Header>
            <Card.Body className="p-4">
              <Tab.Content>
                {/* Profile Info Tab */}
                <Tab.Pane eventKey="profile">
                  <div className="mb-4">
                    <h5 className="fw-bold mb-3">
                      <BsPersonCircle className="me-2 text-primary" />
                      Personal Information
                    </h5>
                    <Row>
                      <Col lg={8}>
                        <Card className="border bg-light">
                          <Card.Body className="p-4">
                            <Row className="g-4">
                              <Col md={6}>
                                <div className="d-flex align-items-center">
                                  <div className="bg-primary bg-opacity-10 p-2 rounded me-3">
                                    <BsPersonCircle className="text-primary" />
                                  </div>
                                  <div>
                                    <small className="text-muted">Full Name</small>
                                    <div className="fw-medium">{userInfo.name || "Not provided"}</div>
                                  </div>
                                </div>
                              </Col>
                              <Col md={6}>
                                <div className="d-flex align-items-center">
                                  <div className="bg-success bg-opacity-10 p-2 rounded me-3">
                                    <BsEnvelope className="text-success" />
                                  </div>
                                  <div>
                                    <small className="text-muted">Email Address</small>
                                    <div className="fw-medium">{userInfo.email || "Not provided"}</div>
                                  </div>
                                </div>
                              </Col>
                              <Col md={6}>
                                <div className="d-flex align-items-center">
                                  <div className="bg-info bg-opacity-10 p-2 rounded me-3">
                                    <BsPhone className="text-info" />
                                  </div>
                                  <div>
                                    <small className="text-muted">Phone Number</small>
                                    <div className="fw-medium">{shippingInfo.phone || "Not provided"}</div>
                                  </div>
                                </div>
                              </Col>
                              <Col md={6}>
                                <div className="d-flex align-items-center">
                                  <div className="bg-warning bg-opacity-10 p-2 rounded me-3">
                                    <BsCalendar className="text-warning" />
                                  </div>
                                  <div>
                                    <small className="text-muted">Member Since</small>
                                    <div className="fw-medium">January 2024</div>
                                  </div>
                                </div>
                              </Col>
                            </Row>
                          </Card.Body>
                        </Card>
                      </Col>
                      <Col lg={4}>
                        <Card className="border-0 bg-primary text-white">
                          <Card.Body className="p-4 text-center">
                            <BsStar size={32} className="mb-3" />
                            <h6 className="fw-bold mb-2">You are a Valued Customer!</h6>
                            <p className="mb-3 opacity-75">Badge of appreciation</p>
                            <Badge bg="light" text="dark" className="px-3 py-2">
                              <BsHeart className="me-1" />
                              Valued Customer
                            </Badge>
                          </Card.Body>
                        </Card>
                      </Col>
                    </Row>
                  </div>
                </Tab.Pane>

                {/* Address Tab */}
                <Tab.Pane eventKey="address">
                  {addressLoading ? (
                    <div className="text-center py-5">
                      <Spinner animation="border" variant="primary" size="lg" />
                      <h5 className="mt-3 text-muted">Loading Address Information</h5>
                      <p className="text-muted">Please wait while we fetch your shipping details...</p>
                    </div>
                  ) : (
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-4">
                        <h5 className="fw-bold mb-0">
                          <BsGeoAlt className="me-2 text-primary" />
                          Shipping Address
                        </h5>
                        {!editingAddress && (
                          <Button
                            variant="primary"
                            onClick={() => setEditingAddress(true)}
                            className="d-flex align-items-center"
                          >
                            <BsPencil className="me-2" />
                            {shippingInfo.fullName ? "Edit Address" : "Add Address"}
                          </Button>
                        )}
                      </div>

                      {editingAddress ? (
                        <Card className="border-0 bg-light">
                          <Card.Body className="p-4">
                            <Form>
                              <Row className="g-3 mb-3">
                                <Col md={6}>
                                  <Form.Group>
                                    <Form.Label className="fw-semibold">
                                      <BsPersonCircle className="me-1 text-primary" />
                                      Full Name *
                                    </Form.Label>
                                    <Form.Control
                                      value={shippingInfo.fullName}
                                      onChange={(e) => setShippingInfo({ ...shippingInfo, fullName: e.target.value })}
                                      placeholder="Enter your full name"
                                      required
                                    />
                                  </Form.Group>
                                </Col>
                                <Col md={6}>
                                  <Form.Group>
                                    <Form.Label className="fw-semibold">
                                      <BsPhone className="me-1 text-primary" />
                                      Phone Number *
                                    </Form.Label>
                                    <InputGroup>
                                      <InputGroup.Text>+63</InputGroup.Text>
                                      <Form.Control
                                        value={shippingInfo.phone}
                                        onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                                        placeholder="9XX XXX XXXX"
                                        required
                                      />
                                    </InputGroup>
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Row className="g-3 mb-3">
                                <Col>
                                  <Form.Group>
                                    <Form.Label className="fw-semibold">
                                      <BsHouseDoor className="me-1 text-primary" />
                                      Address Line 1 *
                                    </Form.Label>
                                    <Form.Control
                                      value={shippingInfo.addressLine1}
                                      onChange={(e) => setShippingInfo({ ...shippingInfo, addressLine1: e.target.value })}
                                      placeholder="House/Unit No., Building, Street"
                                      required
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Row className="g-3 mb-3">
                                <Col>
                                  <Form.Group>
                                    <Form.Label className="fw-semibold">Address Line 2 (Optional)</Form.Label>
                                    <Form.Control
                                      value={shippingInfo.addressLine2}
                                      onChange={(e) => setShippingInfo({ ...shippingInfo, addressLine2: e.target.value })}
                                      placeholder="Subdivision, Area, Landmark"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Row className="g-3 mb-3">
                                <Col md={4}>
                                  <Form.Group>
                                    <Form.Label className="fw-semibold">Province *</Form.Label>
                                    <Form.Select
                                      value={shippingInfo.province}
                                      onChange={(e) => setShippingInfo({ ...shippingInfo, province: e.target.value })}
                                      disabled={isLoadingProvinces}
                                      required
                                    >
                                      <option value="">{isLoadingProvinces ? "Loading..." : "Select Province"}</option>
                                      {provinces.map((p) => (
                                        <option key={p.code} value={p.code}>
                                          {p.name}
                                        </option>
                                      ))}
                                    </Form.Select>
                                  </Form.Group>
                                </Col>
                                <Col md={4}>
                                  <Form.Group>
                                    <Form.Label className="fw-semibold">City *</Form.Label>
                                    <Form.Select
                                      value={shippingInfo.city}
                                      onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                                      disabled={!shippingInfo.province || isLoadingCities}
                                      required
                                    >
                                      <option value="">{isLoadingCities ? "Loading..." : "Select City"}</option>
                                      {cities.map((c) => (
                                        <option key={c.code} value={c.code}>
                                          {c.name}
                                        </option>
                                      ))}
                                    </Form.Select>
                                  </Form.Group>
                                </Col>
                                <Col md={4}>
                                  <Form.Group>
                                    <Form.Label className="fw-semibold">Barangay *</Form.Label>
                                    <Form.Select
                                      value={shippingInfo.brgy}
                                      onChange={(e) => setShippingInfo({ ...shippingInfo, brgy: e.target.value })}
                                      disabled={!shippingInfo.city || isLoadingBarangays}
                                      required
                                    >
                                      <option value="">{isLoadingBarangays ? "Loading..." : "Select Barangay"}</option>
                                      {barangays.map((b) => (
                                        <option key={b.code} value={b.code}>
                                          {b.name}
                                        </option>
                                      ))}
                                    </Form.Select>
                                  </Form.Group>
                                </Col>
                              </Row>

                              <Row className="g-3 mb-4">
                                <Col md={4}>
                                  <Form.Group>
                                    <Form.Label className="fw-semibold">Postal Code</Form.Label>
                                    <Form.Control
                                      value={shippingInfo.postalCode}
                                      onChange={(e) => setShippingInfo({ ...shippingInfo, postalCode: e.target.value })}
                                      placeholder="e.g. 1200"
                                    />
                                  </Form.Group>
                                </Col>
                              </Row>

                              <div className="d-flex gap-2">
                                <Button
                                  variant="primary"
                                  onClick={handleAddressSave}
                                  disabled={savingAddress}
                                  className="d-flex align-items-center"
                                >
                                  {savingAddress ? (
                                    <>
                                      <Spinner size="sm" className="me-2" />
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <BsCheck className="me-2" />
                                      Save Address
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline-secondary"
                                  onClick={() => setEditingAddress(false)}
                                  disabled={savingAddress}
                                  className="d-flex align-items-center"
                                >
                                  <BsX className="me-2" />
                                  Cancel
                                </Button>
                              </div>
                            </Form>
                          </Card.Body>
                        </Card>
                      ) : (
                        <Card className="border-0 shadow-sm">
                          <Card.Body className="p-4">
                            {shippingInfo.fullName ? (
                              <Row>
                                <Col lg={8}>
                                  <div className="d-flex align-items-start mb-4">
                                    <div className="bg-primary bg-opacity-10 p-3 rounded me-3">
                                      <BsPersonCircle className="text-primary" size={24} />
                                    </div>
                                    <div>
                                      <h6 className="fw-bold mb-1">{shippingInfo.fullName}</h6>
                                      <p className="text-muted mb-0">
                                        <BsPhone className="me-1" />
                                        +63 {shippingInfo.phone || "No phone provided"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="d-flex align-items-start">
                                    <div className="bg-success bg-opacity-10 p-3 rounded me-3">
                                      <BsGeoAlt className="text-success" size={24} />
                                    </div>
                                    <div>
                                      <h6 className="fw-semibold mb-2">Delivery Address</h6>
                                      <p className="mb-1">{shippingInfo.addressLine1}</p>
                                      {shippingInfo.addressLine2 && <p className="mb-1">{shippingInfo.addressLine2}</p>}
                                      <p className="mb-1">
                                        {[shippingInfo.brgy, shippingInfo.city, shippingInfo.province]
                                          .filter(Boolean)
                                          .join(", ")}
                                      </p>
                                      {shippingInfo.postalCode && (
                                        <p className="mb-0">
                                          <small className="text-muted">Postal Code: {shippingInfo.postalCode}</small>
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </Col>

                              </Row>
                            ) : (
                              <div className="text-center py-5">
                                <div className="bg-light rounded-circle d-inline-flex p-4 mb-3">
                                  <BsGeoAlt size={48} className="text-muted" />
                                </div>
                                <h5 className="mb-2">No Address Added</h5>
                                <p className="text-muted mb-4">
                                  Add your shipping address to ensure smooth delivery of your orders.
                                </p>
                                <Button variant="primary" onClick={() => setEditingAddress(true)}>
                                  <BsGeoAlt className="me-2" />
                                  Add Shipping Address
                                </Button>
                              </div>
                            )}
                          </Card.Body>
                        </Card>
                      )}
                    </div>
                  )}
                </Tab.Pane>

                {/* Orders Tab */}
                <Tab.Pane eventKey="orders">
                  <div className="d-flex justify-content-between align-items-center mb-4">
                    <h5 className="fw-bold mb-0">
                      <BsBoxSeam className="me-2 text-primary" />
                      Order History
                    </h5>
                    <Badge bg="primary" className="px-3 py-2">
                      {orders.length} Total Orders
                    </Badge>
                  </div>

                  {ordersLoading ? (
                    <div className="text-center py-5">
                      <Spinner animation="border" variant="primary" size="lg" />
                      <h5 className="mt-3 text-muted">Loading Your Orders</h5>
                      <p className="text-muted">Please wait while we fetch your order history...</p>
                    </div>
                  ) : orders.length === 0 ? (
                    <Card className="border-0 bg-light">
                      <Card.Body className="text-center py-5">
                        <div className="bg-white rounded-circle d-inline-flex p-4 mb-3">
                          <BsBoxSeam size={48} className="text-muted" />
                        </div>
                        <h5 className="mb-2">No Orders Yet</h5>
                        <p className="text-muted mb-4">
                          You haven't placed any orders yet. Start shopping to see your orders here!
                        </p>
                        <Button variant="primary" onClick={() => navigate("/")}>
                          <BsBoxSeam className="me-2" />
                          Start Shopping
                        </Button>
                      </Card.Body>
                    </Card>
                  ) : (
                    <Card className="border-0 shadow-sm">
                      <Card.Body className="p-0">
                        <div className="table-responsive">
                          <Table className="mb-0">
                            <thead className="table-light">
                              <tr>
                                <th className="border-0 fw-semibold px-4 py-3">Order Details</th>
                                <th className="border-0 fw-semibold px-4 py-3">Date</th>
                                <th className="border-0 fw-semibold px-4 py-3">Status</th>
                                <th className="border-0 fw-semibold px-4 py-3">Total</th>
                                <th className="border-0 fw-semibold px-4 py-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {currentOrders.map((order) => (
                                <tr key={order._id} className="border-bottom">
                                  <td className="px-4 py-3">
                                    <div>
                                      <div className="fw-bold mb-1">#{order._id.slice(-8)}</div>
                                      <small className="text-muted">
                                        {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}
                                      </small>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="d-flex align-items-center">
                                      <BsCalendar className="text-muted me-2" />
                                      <div>
                                        <div className="fw-medium">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'No Date'}</div>
                                        <small className="text-muted">
                                          {order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : ''}
                                        </small>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge
                                      bg={getStatusVariant(order.status)}
                                      className="d-flex align-items-center w-auto d-inline-flex px-3 py-2"
                                    >
                                      {getStatusIcon(order.status)}
                                      <span className="text-capitalize">{order.status}</span>
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="fw-bold fs-6">₱{order.amount ? order.amount.toLocaleString() : '0.00'}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Button
                                      size="sm"
                                      variant="outline-primary"
                                      onClick={() => navigate(`/orders/${order._id}`)}
                                      className="d-flex align-items-center"
                                    >
                                      <BsEye className="me-1" />
                                      View Details
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      </Card.Body>
                      {totalPages > 1 && (
                        <Card.Footer className="bg-white d-flex justify-content-center">
                          <Pagination>
                            <Pagination.First onClick={() => paginate(1)} disabled={currentPage === 1} />
                            <Pagination.Prev onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} />
                            {[...Array(totalPages).keys()].map((number) => (
                              <Pagination.Item
                                key={number + 1}
                                active={number + 1 === currentPage}
                                onClick={() => paginate(number + 1)}
                              >
                                {number + 1}
                              </Pagination.Item>
                            ))}
                            <Pagination.Next
                              onClick={() => paginate(currentPage + 1)}
                              disabled={currentPage === totalPages}
                            />
                            <Pagination.Last
                              onClick={() => paginate(totalPages)}
                              disabled={currentPage === totalPages}
                            />
                          </Pagination>
                        </Card.Footer>
                      )}
                    </Card>
                  )}
                </Tab.Pane>


              </Tab.Content>
            </Card.Body>
          </Card>
        </Tab.Container>

        {/* Order Details Modal */}
        <Modal show={showOrderModal} onHide={() => setShowOrderModal(false)} size="lg" centered>
          <Modal.Header closeButton className="border-0">
            <Modal.Title className="fw-bold">Order Details - #{selectedOrder?._id.slice(-8)}</Modal.Title>
          </Modal.Header>
          <Modal.Body className="px-4">
            {selectedOrder && (
              <div>
                <Row className="mb-4">
                  <Col md={6}>
                    <div className="d-flex align-items-center mb-3">
                      <BsCalendar className="text-muted me-2" />
                      <div>
                        <small className="text-muted">Order Date</small>
                        <div className="fw-medium">{new Date(selectedOrder.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </Col>
                  <Col md={6}>
                    <div className="d-flex align-items-center mb-3">
                      <div className="me-2">{getStatusIcon(selectedOrder.status)}</div>
                      <div>
                        <small className="text-muted">Status</small>
                        <div>
                          <Badge bg={getStatusVariant(selectedOrder.status)} className="text-capitalize">
                            {selectedOrder.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Col>
                </Row>

                <div className="mb-4">
                  <h6 className="fw-bold mb-3">Order Items</h6>
                  {selectedOrder.items?.map((item, index) => (
                    <div key={index} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                      <div>
                        <div className="fw-medium">{item.item?.name || "Item removed"}</div>
                        <small className="text-muted">Quantity: {item.quantity}</small>
                      </div>
                      <div className="fw-bold">₱{(item.price * item.quantity).toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-light p-3 rounded">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold">Total Amount:</span>
                    <span className="fw-bold fs-5">₱{selectedOrder.amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="border-0">
            <Button variant="outline-secondary" onClick={() => setShowOrderModal(false)}>
              <BsArrowLeft className="me-1" />
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  )
}

export default UserProfile
