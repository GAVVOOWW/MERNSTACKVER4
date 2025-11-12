"use client"

import { useEffect, useState, useMemo, useCallback, useRef } from "react"
import axios from "axios"
import "bootstrap/dist/css/bootstrap.min.css"
import { useNavigate, Link } from "react-router-dom"
import {
  Container,
  Row,
  Col,
  Button,
  Alert,
  Spinner,
  Navbar,
  Nav,
  Modal,
  Card,
  Form,
  ListGroup,
  Badge,
  InputGroup,
  Toast,
  ToastContainer,
} from "react-bootstrap"
import MainNavbar from "./components/MainNavbar.jsx"
import {
  BsTrash,
  BsCart,
  BsShop,
  BsPlus,
  BsDash,
  BsCheck2All,
  BsCheckCircle,
  BsExclamationTriangle,
  BsGift,
  BsTruck,
  BsShield,
  BsCreditCard,
  BsArrowRight,
  BsBoxArrowRight,
  BsListUl,
  BsClipboardCheck,
  BsCartX,
  BsCartPlus,
  BsStarFill,
  BsPercent,
  BsLightbulb,
} from "react-icons/bs"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const Home = () => {
  const [cartItems, setCartItems] = useState([])
  const [userName, setUserName] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState({})
  const [showModal, setShowModal] = useState(false)
  const [recommendedItems, setRecommendedItems] = useState([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const isFetchingRef = useRef(false)
  const [toastMessage, setToastMessage] = useState("")
  const [toastVariant, setToastVariant] = useState("success")
  const [processingCheckout, setProcessingCheckout] = useState(false)

  const navigate = useNavigate()
  const userId = localStorage.getItem("userId")
  const token = localStorage.getItem("token")
  const userRole = localStorage.getItem("role")

  const getCartEntryKey = useCallback((entry) => {
    if (!entry) return ""
    if (entry._id) return String(entry._id)

    const parts = [
      entry.item?._id ?? "",
      entry.customizations?.finalPrice ?? entry.customPrice ?? "",
      entry.customH ?? "",
      entry.customW ?? "",
      entry.customL ?? "",
      entry.legsFrameMaterial ?? "",
      entry.tabletopMaterial ?? "",
    ]

    return parts.join("|")
  }, [])

  const showNotification = (message, variant = "success") => {
    setToastMessage(message)
    setToastVariant(variant)
    setShowToast(true)
  }

  const fetchCartItems = async () => {
    if (!userId || !token) {
      setError("User not authenticated. Please log in.")
      setLoading(false)
      return
    }
    try {
      const response = await axios.get(`${BACKEND_URL}/api/cart/${userId}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const validItems = response.data.items.filter((entry) => entry.item)
      setCartItems(validItems)

      const initialSelected = {}
      validItems.forEach((entry) => {
        initialSelected[getCartEntryKey(entry)] = true
      })
      setSelected(initialSelected)
    } catch (err) {
      setError(err.response ? err.response.data.message : "Error fetching cart items")
    } finally {
      setLoading(false)
    }
  }

  const fetchUserName = async () => {
    if (!userId || !token) return
    try {
      const response = await axios.get(`${BACKEND_URL}/api/singleusers/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setUserName(response.data.UserData.name)
    } catch (err) {
      console.error("Error fetching user name")
    }
  }

  useEffect(() => {
    fetchCartItems()
    fetchUserName()
  }, [])

  const updateItemQuantity = async (itemId, action) => {
    const url = `${BACKEND_URL}/api/cart/${userId}/item/${itemId}/${action}`
    try {
      await axios.put(url, {}, { headers: { Authorization: `Bearer ${token}` } })
      fetchCartItems()
      showNotification(`Quantity ${action === "increase" ? "increased" : "decreased"}`)
    } catch (err) {
      showNotification(`Error updating quantity`, "danger")
    }
  }

  const deleteItem = async (itemId) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/cart/${userId}/item/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchCartItems()
      showNotification("Item removed from cart")
    } catch (err) {
      showNotification("Error removing item from cart", "danger")
    }
  }

  const handleSelectAll = (e) => {
    const isChecked = e.target.checked
    const newSelected = {}
    cartItems.forEach((entry) => {
      newSelected[getCartEntryKey(entry)] = isChecked
    })
    setSelected(newSelected)
  }

  const selectedItems = useMemo(() => 
    cartItems.filter((entry) => selected[getCartEntryKey(entry)]), 
    [cartItems, selected, getCartEntryKey]
  )
  
  const selectedTotal = useMemo(() => 
    selectedItems.reduce((sum, entry) => {
      // Use the final custom price if it exists, otherwise use the item's default price.
      const price = entry.customizations?.finalPrice || entry.item.price;
      return sum + price * entry.quantity;
    }, 0), 
    [selectedItems]
  )
  
  const overStockedItems = useMemo(() => 
    selectedItems.filter((entry) => entry.quantity > entry.item.stock), 
    [selectedItems]
  )
  
  const isAllSelected = useMemo(() => 
    cartItems.length > 0 && selectedItems.length === cartItems.length, 
    [cartItems.length, selectedItems.length]
  )
  
  const savings = useMemo(() => 
    selectedItems.reduce((sum, entry) => sum + (entry.item.originalPrice || 0) - entry.item.price, 0), 
    [selectedItems]
  )

  const handleCheckout = () => {
    if (selectedItems.length === 0 || overStockedItems.length > 0) return

    setProcessingCheckout(true)
    setTimeout(() => {
      navigate("/checkout", {
        state: {
          selectedItems: selectedItems.map((entry) => {
            const clonedItem = { ...entry.item };
            if (entry.customizations?.finalPrice) {
              clonedItem.price = entry.customizations.finalPrice;
            }
            if (entry.customH) clonedItem.customH = entry.customH;
            if (entry.customW) clonedItem.customW = entry.customW;
            if (entry.customL) clonedItem.customL = entry.customL;
            if (entry.legsFrameMaterial) clonedItem.legsFrameMaterial = entry.legsFrameMaterial;
            if (entry.tabletopMaterial) clonedItem.tabletopMaterial = entry.tabletopMaterial;
            return {
              item: clonedItem,
              quantity: entry.quantity,
              customizations: entry.customizations || null,
            };
          }),
        },
      })
      setProcessingCheckout(false)
    }, 1000)
  }

  const selectedItemsRef = useRef(selectedItems)
  selectedItemsRef.current = selectedItems

  const fetchRecommendations = useCallback(async () => {
    const currentSelectedItems = selectedItemsRef.current
    if (!showModal || currentSelectedItems.length === 0 || isFetchingRef.current) return
    
    console.log("Fetching recommendations for:", currentSelectedItems.length, "items")
    console.log("Selected items:", currentSelectedItems.map(entry => entry.item.name))
    isFetchingRef.current = true
    setRecommendationsLoading(true)
    
    try {
      const requestData = { selectedIds: currentSelectedItems.map(entry => entry.item._id) }
      console.log("Sending request data:", requestData)
      
      const response = await axios.post(
        `${BACKEND_URL}/api/items/recommend`, 
        requestData,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      console.log("Recommendations response:", response.data)
      
      if (response.data) {
        console.log("Full response data:", response.data)
        
        // Combine regular recommendations with AI-specific ones
        let allRecommendations = [];
        
        // Add AI-specific recommendations first (they're more targeted)
        if (response.data.aiSpecificRecommendations && response.data.aiSpecificRecommendations.length > 0) {
          console.log("Adding AI-specific recommendations:", response.data.aiSpecificRecommendations.length, "items")
          allRecommendations.push(...response.data.aiSpecificRecommendations)
        }
        
        // Add regular recommendations (avoiding duplicates)
        if (response.data.ItemData && response.data.ItemData.length > 0) {
          console.log("Adding regular recommendations:", response.data.ItemData.length, "items")
          const existingIds = new Set(allRecommendations.map(item => item._id))
          const newItems = response.data.ItemData.filter(item => !existingIds.has(item._id))
          allRecommendations.push(...newItems)
        }
        
        console.log("Final combined recommendations:", allRecommendations.length, "items")
        setRecommendedItems(allRecommendations)
      } else {
        console.warn("No recommendations data in response")
        setRecommendedItems([])
      }
    } catch (err) {
      console.error("Error fetching recommendations:", err.response?.data || err.message)
      setRecommendedItems([])
    } finally {
      setRecommendationsLoading(false)
      isFetchingRef.current = false
    }
  }, [showModal, token])

  useEffect(() => {
    if (showModal) {
      fetchRecommendations()
    } else {
      // Reset when modal closes
      isFetchingRef.current = false
      setRecommendationsLoading(false)
    }
  }, [fetchRecommendations, showModal])

  const quickAddToCart = async (itemId) => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/cart/${userId}/add`,
        { itemId, quantity: 1 },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setShowModal(false)
      fetchCartItems()
      showNotification("Item added to cart!")
    } catch (err) {
      showNotification("Failed to add item", "danger")
    }
  }

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: "4rem", height: "4rem" }} />
          <p className="mt-3 text-muted">Loading your shopping cart...</p>
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
            Authentication Error
          </Alert.Heading>
          <p>{error}</p>
          <hr />
          <div className="d-flex justify-content-end">
            <Button variant="outline-danger" onClick={() => navigate("/login")}>
              Go to Login
            </Button>
          </div>
        </Alert>
      </Container>
    )
  }

  return (
    <>
      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1050 }}>
        <Toast onClose={() => setShowToast(false)} show={showToast} delay={3000} autohide>
          <Toast.Header closeButton={true}>
            <BsCheckCircle className={`me-2 text-${toastVariant}`} />
            <strong className="me-auto">{toastVariant === "success" ? "Success" : "Error"}</strong>
          </Toast.Header>
          <Toast.Body>{toastMessage}</Toast.Body>
        </Toast>
      </ToastContainer>

      {/* Navigation Bar */}
      <MainNavbar />

      <Container className="my-5">
        {cartItems.length === 0 ? (
          /* Empty Cart State */
          <div className="text-center">
            <Card className="border-0 shadow-sm" style={{ maxWidth: "600px", margin: "0 auto" }}>
              <Card.Body className="p-5">
                <BsCartX size={80} className="text-muted mb-4" />
                <h2 className="fw-bold mb-3">Your Cart is Empty</h2>
                <p className="text-muted mb-4">
                  Looks like you haven't added anything to your cart yet. Start exploring our amazing furniture
                  collection!
                </p>
                <div className="d-flex justify-content-center gap-3">
                  <Button variant="primary" size="lg" as={Link} to="/">
                    <BsShop className="me-2" />
                    Start Shopping
                  </Button>
                  <Button variant="outline-secondary" size="lg" as={Link} to="/recommendation">
                    <BsGift className="me-2" />
                    Get Recommendations
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </div>
        ) : (
          <>
            {/* Cart Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="fw-bold mb-1">
                  <BsCart className="me-2 text-primary" />
                  Shopping Cart
                </h2>
                {userName && <p className="text-muted mb-0">Welcome back, {userName}!</p>}
              </div>
              <div className="d-flex align-items-center gap-3">
                <Form.Check
                  type="checkbox"
                  id="select-all"
                  label={
                    <span className="fw-medium">
                      <BsCheck2All className="me-1" />
                      Select All ({cartItems.length})
                    </span>
                  }
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                  className="user-select-none"
                />
              </div>
            </div>

            <Row>
              {/* Cart Items */}
              <Col lg={8} className="mb-4">
                <div className="d-flex flex-column gap-3">
                  {cartItems.map((entry) => {
                    const entryKey = getCartEntryKey(entry)
                    const hasStockIssue = selected[entryKey] && entry.quantity > entry.item.stock
                    const isSelected = selected[entryKey]

                    return (
                      <Card
                        key={entryKey}
                        className={`border-0 shadow-sm ${isSelected ? "border-primary" : ""}`}
                        style={{ borderLeft: isSelected ? "4px solid #0d6efd" : "none" }}
                      >
                        <Card.Body className="p-4">
                          <Row className="align-items-center">
                            {/* Checkbox */}
                            <Col xs="auto">
                              <Form.Check
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) =>
                                  setSelected((prev) => ({ ...prev, [entryKey]: e.target.checked }))
                                }
                                style={{ transform: "scale(1.2)" }}
                              />
                            </Col>

                            {/* Product Image */}
                            <Col xs="auto">
                              <div
                                className="position-relative"
                                style={{ width: "100px", height: "100px", overflow: "hidden", borderRadius: "8px" }}
                              >
                                <img
                                  src={entry.item.imageUrl?.[0] || "https://via.placeholder.com/150"}
                                  alt={entry.item.name}
                                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                />
                                {entry.item.is_bestseller && (
                                  <Badge
                                    bg="warning"
                                    text="dark"
                                    className="position-absolute top-0 start-0 m-1"
                                    style={{ fontSize: "0.7rem" }}
                                  >
                                    <BsStarFill className="me-1" />
                                    Best
                                  </Badge>
                                )}
                              </div>
                            </Col>

                            {/* Product Details */}
                            <Col>
                              <div>
                                <h5 className="mb-1 fw-bold">{entry.item.name}</h5>
                                {(() => {
                                  const unitPrice = entry.customizations?.finalPrice ?? entry.customPrice ?? entry.item.price;
                                  return (
                                    <div className="d-flex align-items-center gap-2 mb-2">
                                      <span className="text-muted small">Unit Price:</span>
                                      <span className="fw-bold text-primary">₱{unitPrice.toFixed(2)}</span>
                                    </div>
                                  );
                                })()}
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                  <Badge bg="light" text="dark" className="small">
                                    Stock: {entry.item.stock}
                                  </Badge>
                                  {entry.customizations && (
                                    <Badge bg="warning" text="dark" className="small">
                                      Custom
                                    </Badge>
                                  )}
                                  {entry.item.category && (
                                    <Badge bg="secondary" className="small">
                                      {typeof entry.item.category === "object"
                                        ? entry.item.category.name
                                        : entry.item.category}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </Col>

                            {/* Quantity Controls */}
                            <Col md={3}>
                              <div className="d-flex flex-column align-items-center">
                                <InputGroup style={{ maxWidth: "140px" }}>
                                  <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={() => updateItemQuantity(entry.item._id, "decrease")}
                                    disabled={entry.quantity <= 1}
                                  >
                                    <BsDash />
                                  </Button>
                                  <Form.Control
                                    type="text"
                                    value={entry.quantity}
                                    readOnly
                                    className="text-center fw-bold"
                                    size="sm"
                                  />
                                  <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={() => updateItemQuantity(entry.item._id, "increase")}
                                    disabled={entry.quantity >= entry.item.stock}
                                  >
                                    <BsPlus />
                                  </Button>
                                </InputGroup>
                                <small className="text-muted mt-1">Max: {entry.item.stock}</small>
                              </div>
                            </Col>

                            {/* Subtotal */}
                            <Col md={2} className="text-end">
                              <div className="fw-bold fs-5 text-primary">
                                {(() => {
                                  const unitPrice = entry.customizations?.finalPrice ?? entry.customPrice ?? entry.item.price;
                                  return `₱${(unitPrice * entry.quantity).toFixed(2)}`;
                                })()}
                              </div>
                              {entry.item.originalPrice && entry.item.originalPrice > entry.item.price && (
                                <div className="small text-success">
                                  <BsPercent className="me-1" />
                                  Save ₱{((entry.item.originalPrice - entry.item.price) * entry.quantity).toFixed(2)}
                                </div>
                              )}
                            </Col>

                            {/* Delete Button */}
                            <Col xs="auto">
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => deleteItem(entry.item._id)}
                                className="rounded-circle"
                                style={{ width: "40px", height: "40px" }}
                              >
                                <BsTrash />
                              </Button>
                            </Col>
                          </Row>

                          {/* Stock Issue Alert */}
                          {hasStockIssue && (
                            <Alert variant="danger" className="mt-3 mb-0 py-2">
                              <BsExclamationTriangle className="me-2" />
                              <strong>Stock Issue:</strong> Only {entry.item.stock} units available. Please adjust
                              quantity.
                            </Alert>
                          )}
                        </Card.Body>
                      </Card>
                    )
                  })}
                </div>
              </Col>

              {/* Order Summary */}
              <Col lg={4}>
                <div className="sticky-top" style={{ top: "7rem" }}>
                  <Card className="border-0 shadow-sm">
                    <Card.Header className="bg-white border-bottom">
                      <h5 className="mb-0 fw-bold">
                        <BsClipboardCheck className="me-2 text-primary" />
                        Order Summary
                      </h5>
                    </Card.Header>
                    <Card.Body className="p-4">
                      <ListGroup variant="flush">
                        <ListGroup.Item className="d-flex justify-content-between align-items-center px-0 py-3">
                          <span>Subtotal ({selectedItems.length} items)</span>
                          <span className="fw-bold">₱{selectedTotal.toFixed(2)}</span>
                        </ListGroup.Item>
                        {savings > 0 && (
                          <ListGroup.Item className="d-flex justify-content-between align-items-center px-0 py-2">
                            <span className="text-success">
                              <BsPercent className="me-1" />
                              You Save
                            </span>
                            <span className="text-success fw-bold">-₱{savings.toFixed(2)}</span>
                          </ListGroup.Item>
                        )}

                        <ListGroup.Item className="d-flex justify-content-between align-items-center px-0 py-3 border-top">
                          <span className="fw-bold fs-5">Total</span>
                          <span className="fw-bold fs-4 text-primary">₱{selectedTotal.toFixed(2)}</span>
                        </ListGroup.Item>
                      </ListGroup>

                      <div className="d-grid mt-4">
                        <Button
                          variant="primary"
                          size="lg"
                          disabled={selectedItems.length === 0 || overStockedItems.length > 0 || processingCheckout}
                          onClick={() => setShowModal(true)}
                          className="fw-bold py-3"
                        >
                          {processingCheckout ? (
                            <>
                              <Spinner animation="border" size="sm" className="me-2" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <BsArrowRight className="me-2" />
                              Proceed to Checkout
                            </>
                          )}
                        </Button>
                      </div>

                      {overStockedItems.length > 0 && (
                        <Alert variant="warning" className="mt-3 mb-0 py-2">
                          <BsExclamationTriangle className="me-2" />
                          <small>Please fix stock issues before checkout.</small>
                        </Alert>
                      )}

                      {/* Trust Indicators */}
                      <div className="mt-4 pt-3 border-top">
                        <Row className="text-center">
                          <Col>
                            <BsShield className="text-success mb-1" size={20} />
                            <div className="small text-muted">Secure</div>
                          </Col>
                          <Col>
                            <BsTruck className="text-primary mb-1" size={20} />
                            <div className="small text-muted">Reliable Shipment</div>
                          </Col>
                          <Col>
                            <BsCreditCard className="text-info mb-1" size={20} />
                            <div className="small text-muted">Easy Payment!</div>
                          </Col>
                        </Row>
                      </div>
                    </Card.Body>
                  </Card>
                </div>
              </Col>
            </Row>
          </>
        )}
      </Container>

      {/* Checkout Confirmation Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title className="fw-bold">
            <BsCheckCircle className="me-2 text-success" />
            Confirm Your Order
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <div className="mb-4">
            <h6 className="fw-bold mb-3">Order Details ({selectedItems.length} items):</h6>
            <ListGroup variant="flush">
              {selectedItems.map((entry) => {
                const entryKey = getCartEntryKey(entry)
                const unitPrice = entry.customizations?.finalPrice ?? entry.customPrice ?? entry.item.price
                return (
                  <ListGroup.Item key={entryKey} className="d-flex justify-content-between align-items-center px-0">
                    <div className="d-flex align-items-center">
                      <img
                        src={entry.item.imageUrl?.[0] || "https://via.placeholder.com/50"}
                        alt={entry.item.name}
                        style={{ width: "50px", height: "50px", objectFit: "contain", borderRadius: "4px" }}
                        className="me-3"
                      />
                      <div>
                        <div className="fw-medium">{entry.item.name}</div>
                        <small className="text-muted">Qty: {entry.quantity}</small>
                      </div>
                    </div>
                    <span className="fw-bold">₱{(entry.quantity * unitPrice).toFixed(2)}</span>
                  </ListGroup.Item>
                )
              })}
              <ListGroup.Item className="d-flex justify-content-between align-items-center px-0 border-top">
                <span className="fw-bold fs-5">Total Amount</span>
                <span className="fw-bold fs-4 text-primary">₱{selectedTotal.toFixed(2)}</span>
              </ListGroup.Item>
            </ListGroup>
          </div>

          {/* Recommendations */}
          <div className="border-top pt-4">
            <div className="d-flex align-items-center mb-4">
              <div className="bg-warning bg-opacity-10 p-2 rounded-circle me-3">
                <BsGift className="text-warning" size={20} />
              </div>
              <div>
                <h6 className="fw-bold mb-1">AI-Powered Recommendations</h6>
                <small className="text-muted">Perfect complements for your items</small>
              </div>
            </div>
            
            {console.log("Rendering recommendations section. Items count:", recommendedItems.length, "Loading:", recommendationsLoading)}
            {recommendedItems.length > 0 ? (
              <Row xs={1} md={2} lg={3} className="g-3">
                {recommendedItems.slice(0, 3).map((rec, index) => (
                  <Col key={rec._id || index}>
                    <Card className="h-100 border-0 shadow-sm hover-shadow" style={{ transition: "all 0.3s ease" }}>
                      <div className="position-relative">
                        <div style={{ height: "140px", overflow: "hidden" }}>
                          <Card.Img
                            variant="top"
                            src={rec.imageUrl?.[0] || "https://via.placeholder.com/100"}
                            style={{ height: "100%", objectFit: "contain" }}
                          />
                        </div>
                        <div className="position-absolute top-0 end-0 m-2">
                          <Badge 
                            bg={rec.isFuzzyMatch ? "info" : "warning"} 
                            text="dark" 
                            className="fw-medium"
                          >
                            <BsStarFill className="me-1" size={10} />
                            {rec.isFuzzyMatch ? "AI Match" : "AI Pick"}
                          </Badge>
                        </div>
                      </div>
                      <Card.Body className="p-3 d-flex flex-column">
                        <div className="mb-2">
                          <h6 className="fw-bold mb-1" style={{ fontSize: "14px", lineHeight: "1.3" }}>
                            {rec.name}
                          </h6>
                          <div className="text-primary fw-bold fs-6">₱{rec.price?.toFixed(2) || "0.00"}</div>
                        </div>
                        
                        <div className="mb-3 flex-grow-1">
                          <div className="bg-light bg-opacity-50 p-2 rounded" style={{ fontSize: "12px", lineHeight: "1.4" }}>
                            <div className="text-primary fw-medium mb-1">
                              <BsLightbulb className="me-1" size={12} />
                              Why this works:
                            </div>
                            <div className="text-muted">
                              {rec.aiReasoning || rec.aiExplanation || `This ${rec.name} is perfect for your setup and will complement your selected items beautifully!`}
                            </div>
                          </div>
                        </div>
                        
                        <div className="d-grid mt-auto">
                          <Button 
                            variant="primary" 
                            size="sm" 
                            onClick={() => quickAddToCart(rec._id)}
                            className="fw-medium"
                            style={{ fontSize: "13px" }}
                          >
                            <BsCartPlus className="me-1" />
                            Add to Cart
                          </Button>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : (
              <div className="text-center py-5">
                <div className="bg-light bg-opacity-50 rounded-circle d-inline-flex p-3 mb-3">
                  {recommendationsLoading ? (
                    <Spinner animation="border" variant="warning" size="sm" />
                  ) : (
                    <BsGift size={32} className="text-warning" />
                  )}
                </div>
                <h6 className="fw-bold mb-2">
                  {recommendationsLoading ? "Analyzing Your Cart..." : "Loading Recommendations"}
                </h6>
                <p className="text-muted mb-0" style={{ fontSize: "14px" }}>
                  {recommendationsLoading 
                    ? "Our AI is finding the perfect complements for your items..."
                    : "Our AI is analyzing your cart to find perfect complements..."
                  }
                </p>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer className="border-top">
          <Button variant="outline-secondary" onClick={() => setShowModal(false)}>
            Continue Shopping
          </Button>
          <Button variant="primary" onClick={handleCheckout} className="fw-bold">
            <BsCheckCircle className="me-2" />
            Confirm & Checkout
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}

export default Home
