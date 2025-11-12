"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import axios from "axios"
import { useParams, useNavigate, Link } from "react-router-dom"
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  InputGroup,
  Form,
  Carousel,
  Navbar,
  Nav,
  Alert,
  Spinner,
  Toast,
  ToastContainer,
  Badge,
  Breadcrumb,
  Modal,
} from "react-bootstrap"
import {
  BsCart,
  BsCartPlus,
  BsHeart,
  BsShare,
  BsShop,
  BsChatDots,
  BsBoxArrowRight,
  BsHouse,
  BsListUl,
  BsClipboardCheck,
  BsShield,
  BsTruck,
  BsArrowLeft,
  BsPlus,
  BsDash,
  BsStarFill,
  BsRulers,
  BsInfoCircle,
  BsCheckCircle,
  BsExclamationTriangle,
  BsPerson,
} from "react-icons/bs"
import ChatPage from "./ChatPage.jsx"
// Removed react-image-magnify due to React 19 compatibility issues

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Custom Image Magnifier Component
const ImageMagnifier = ({ src, alt, className, style, zoomLevel = 2.5 }) => {
  const imgRef = useRef(null);
  const magnifierRef = useRef(null);
  const [isHovering, setIsHovering] = useState(false);
  const [magnifierPosition, setMagnifierPosition] = useState({ x: 0, y: 0 });
  const [backgroundPosition, setBackgroundPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e) => {
    if (!imgRef.current || !magnifierRef.current) return;

    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate magnifier position (centered on cursor)
    const magnifierSize = 150;
    const magnifierX = x - magnifierSize / 2;
    const magnifierY = y - magnifierSize / 2;

    // Calculate background position for zoomed image
    const bgX = -(x * zoomLevel - magnifierSize / 2);
    const bgY = -(y * zoomLevel - magnifierSize / 2);

    setMagnifierPosition({ x: magnifierX, y: magnifierY });
    setBackgroundPosition({ x: bgX, y: bgY });
  }, [zoomLevel]);

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={className}
        style={{ 
          ...style, 
          cursor: 'crosshair',
          display: 'block'
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      
      {/* Magnifier Glass */}
      <div
        ref={magnifierRef}
        style={{
          position: 'absolute',
          width: '150px',
          height: '150px',
          border: '3px solid #EE4D2D',
          borderRadius: '50%',
          backgroundImage: `url(${src})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${imgRef.current?.width * zoomLevel || 0}px ${imgRef.current?.height * zoomLevel || 0}px`,
          backgroundPosition: `${backgroundPosition.x}px ${backgroundPosition.y}px`,
          pointerEvents: 'none',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          opacity: isHovering ? 1 : 0,
          transition: 'opacity 0.2s ease',
          left: `${magnifierPosition.x}px`,
          top: `${magnifierPosition.y}px`,
        }}
      />
    </div>
  );
};

const SingleItemPage = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cartQuantity, setCartQuantity] = useState(0)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState("")
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [isWishlisted, setIsWishlisted] = useState(false)

  // ---------------- Customization States ----------------
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [modalStep, setModalStep] = useState("input") // 'input' or 'result'
  const [customDims, setCustomDims] = useState({ length: "", width: "", height: "" })
  const [laborDays, setLaborDays] = useState()
  const [selectedMaterial3x3, setSelectedMaterial3x3] = useState("")
  const [selectedMaterial2x12, setSelectedMaterial2x12] = useState("")
  const [customPriceDetails, setCustomPriceDetails] = useState(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // ---------------- Reviews States ----------------
  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)

  const userId = localStorage.getItem("userId")
  const token = localStorage.getItem("token")
  const userRole = localStorage.getItem("role")

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("userId")
    localStorage.removeItem("role")
    navigate("/")
  }

  // Fetch single item by ID
  const getItemById = async (itemId) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/items/${itemId}`)
      return response.data.Itemdata
    } catch (err) {
      throw new Error("Failed to fetch item details. It may have been removed.")
    }
  }

  // Fetch cart quantity for this item
  const fetchCartQuantity = async () => {
    if (!userId || !token) return
    try {
      const response = await axios.get(`${BACKEND_URL}/api/cart/${userId}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const cartEntry = response.data.items.find((entry) => entry.item && entry.item._id === id)
      setCartQuantity(cartEntry ? cartEntry.quantity : 0)
    } catch (err) {
      setCartQuantity(0) // Cart might not exist yet, that's okay
    }
  }

  // Fetch reviews for this item
  const fetchReviews = async () => {
    setReviewsLoading(true)
    try {
      const response = await axios.get(`${BACKEND_URL}/api/items/${id}/reviews`)
      setReviews(response.data.reviews || [])
    } catch (err) {
      // Non-blocking: keep page usable if reviews fail to load
    } finally {
      setReviewsLoading(false)
    }
  }

  useEffect(() => {
    const fetchItem = async () => {
      setLoading(true)
      try {
        const itemData = await getItemById(id)
        setItem(itemData)
        await fetchCartQuantity()
        // Initialize labor days from admin-defined value (estimated_days/completion_days)
        const defaultDays =
          itemData.customization_options?.estimated_days ??
          itemData.customization_options?.completion_days ??
          itemData.estimated_days ??
          itemData.completion_days ??
          0
        setLaborDays(defaultDays)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchItem()
    fetchReviews()
  }, [id, userId, token])

  // Set default selected material when item loads
  useEffect(() => {
    if (item && item.is_customizable && item.customization_options?.materials?.length > 0) {
      const first = item.customization_options.materials[0].name
      setSelectedMaterial3x3(first)
      setSelectedMaterial2x12(first)
    }
  }, [item])

  const handleQuantityChange = (operation) => {
    const maxAllowed = item.stock - cartQuantity
    if (operation === "increase") {
      setQuantity((prev) => Math.min(prev + 1, maxAllowed))
    } else if (operation === "decrease") {
      setQuantity((prev) => Math.max(1, prev - 1))
    }
  }

  const handleAddToCart = async () => {
    if (!userId || !token) {
      setError("You must be logged in to add items to your cart.")
      return
    }

    try {
      await axios.post(
        `${BACKEND_URL}/api/cart/${userId}/add`,
        { itemId: id, quantity: quantity },
        { headers: { Authorization: `Bearer ${token}` } },
      )

      setCartQuantity((prev) => prev + quantity)
      setToastMessage(`${quantity} x ${item.name} added to cart!`)
      setShowToast(true)
      setQuantity(1) // Reset quantity selector
      setError(null)
    } catch (err) {
      setError(err.response?.data?.message || "Error adding item to cart")
    }
  }

  const handleCheckout = () => {
    if (!userId || !token) {
      setError("You must be logged in to check out.")
      return
    }
    navigate("/checkout", {
      state: { selectedItems: [{ item, quantity }] },
    })
  }

  const handleWishlist = () => {
    setIsWishlisted(!isWishlisted)
    setToastMessage(isWishlisted ? "Removed from wishlist" : "Added to wishlist")
    setShowToast(true)
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: item.name,
        text: `Check out this ${item.name} for ₱${item.price.toFixed(2)}`,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      setToastMessage("Link copied to clipboard!")
      setShowToast(true)
    }
  }

  // ---------------- Customization Handlers ----------------
  const handleCalculatePrice = async () => {
    if (!customDims.length || !customDims.width || !customDims.height || !laborDays) {
      setError("Please fill in all dimensions and labor days.")
      return
    }
    setIsCalculating(true)
    setError(null)
    try {
      const lengthFt = parseFloat(customDims.length)
      const widthFt = parseFloat(customDims.width)
      const heightFt = parseFloat(customDims.height)

      if (
        lengthFt < 2 ||
        lengthFt > 10 ||
        widthFt < 2 ||
        widthFt > 6 ||
        heightFt < 2.5 ||
        heightFt > 5
      ) {
        setError(
          "Invalid dimensions. Length must be between 2 and 10 ft, width between 2 and 6 ft, and height between 2.5 and 5 ft."
        )
        return
      }

      const response = await axios.post(`${BACKEND_URL}/api/items/${id}/calculate-price`, {
        length: lengthFt,
        width: widthFt,
        height: heightFt,
        laborDays: parseInt(laborDays),
        materialName3x3: selectedMaterial3x3,
        materialName2x12: selectedMaterial2x12,
      })
      setCustomPriceDetails(response.data)
      setModalStep("result")
    } catch (err) {
      setError(err.response?.data?.message || "Failed to calculate price.")
    } finally {
      setIsCalculating(false)
    }
  }

  const handleAddCustomToCart = async () => {
    if (!userId || !token) {
      setError("You must be logged in to add items to your cart.");
      return;
    }
    if (!customPriceDetails) {
      setError("Please calculate a price before adding to cart.");
      return;
    }

    console.log(`[CUSTOM ADD TO CART] User: ${userId}, Item: ${id}`);
    console.log(`[CUSTOM ADD TO CART] Dimensions: H:${customDims.height}, W:${customDims.width}, L:${customDims.length}`);

    try {
      await axios.post(
        `${BACKEND_URL}/api/cart/${userId}/add`,
        {
          itemId: id,
          quantity: 1, // Custom items are added one at a time
          customH: customDims.height,
          customW: customDims.width,
          customL: customDims.length,
          legsFrameMaterial: selectedMaterial3x3,
          tabletopMaterial: selectedMaterial2x12,
          customPrice: customPriceDetails.finalSellingPrice,
          customizations: {
            finalPrice: customPriceDetails.finalSellingPrice,
            dimensions: customDims,
            material3x3: selectedMaterial3x3,
            material2x12: selectedMaterial2x12,
            days: laborDays,
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setToastMessage(`Custom ${item.name} added to cart!`);
      setShowToast(true);
      resetCustomModal(); // Close modal and reset state
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || "Error adding custom item to cart");
    }
  };

  const handleCustomCheckout = () => {
    if (!userId || !token) {
      setError("You must be logged in to check out.")
      return
    }
    const customItem = {
      ...item,
      name: `${item.name} (Custom: ${customDims.length}x${customDims.width}x${customDims.height})`,
      price: customPriceDetails.finalSellingPrice,
      customH: customDims.height,
      customW: customDims.width,
      customL: customDims.length,
      legsFrameMaterial: selectedMaterial3x3,
      tabletopMaterial: selectedMaterial2x12,
      custom_details: {
        dimensions: customDims,
        material3x3: selectedMaterial3x3,
        material2x12: selectedMaterial2x12,
        days: laborDays,
        price: customPriceDetails.finalSellingPrice,
      },
    }
    navigate("/checkout", {
      state: { selectedItems: [{ item: customItem, quantity: 1 }] },
    })
  }

  // ---------------- Review Handlers (view-only) ----------------

  const resetCustomModal = () => {
    setShowCustomModal(false)
    setModalStep("input")
    setCustomPriceDetails(null)
    setCustomDims({ length: "", width: "", height: "" })
    setError(null)
  }

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" size="lg" />
          <p className="mt-3 text-muted">Loading product details...</p>
        </div>
      </Container>
    )
  }

  if (error && !toastMessage) {
    return (
      <Container className="mt-5">
        <Alert variant="danger" className="shadow-sm">
          <Alert.Heading>
            <BsExclamationTriangle className="me-2" />
            Oops! Something went wrong
          </Alert.Heading>
          <p className="mb-3">{error}</p>
          <hr />
          <div className="d-flex justify-content-end">
            <Button variant="outline-danger" onClick={() => navigate("/")}>
              <BsArrowLeft className="me-2" />
              Back to Shop
            </Button>
          </div>
        </Alert>
      </Container>
    )
  }

  if (!item) {
    return (
      <Container className="mt-5">
        <Alert variant="warning" className="text-center shadow-sm">
          <BsInfoCircle size={48} className="text-warning mb-3" />
          <h4>Product Not Found</h4>
          <p>The item you're looking for might have been moved or deleted.</p>
          <div className="mt-3">
            <Button variant="outline-primary" onClick={() => navigate("/")}>
              <BsArrowLeft className="me-2" />
              Back to Shop
            </Button>
          </div>
        </Alert>
      </Container>
    )
  }

  const maxAddableQuantity = Math.max(0, item.stock - cartQuantity)
  const isOutOfStock = item.stock === 0
  const isMaxInCart = cartQuantity >= item.stock
  const stockStatus = item.stock > 10 ? "In Stock" : item.stock > 0 ? "Limited Stock" : "Out of Stock"
  const stockVariant = item.stock > 10 ? "success" : item.stock > 0 ? "warning" : "danger"

  return (
    <>
      <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1050 }}>
        <Toast onClose={() => setShowToast(false)} show={showToast} delay={3000} autohide>
          <Toast.Header closeButton={true}>
            <BsCheckCircle className="text-success me-2" />
            <strong className="me-auto">Success</strong>
          </Toast.Header>
          <Toast.Body>{toastMessage}</Toast.Body>
        </Toast>
      </ToastContainer>

      {/* Navigation Bar */}
      <Navbar bg="white" variant="light" expand="lg" sticky="top" className="py-3 border-bottom shadow-sm" style={{ zIndex: 1030 }}>
        <Container fluid>
          <Navbar.Brand as={Link} to="/" className="fw-bold fs-3" style={{ color: "#EE4D2D" }}>
            <BsShop className="me-2" />
            Wawa Furniture
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/" className="fw-medium">
                <BsHouse className="me-1" />
                Shop
              </Nav.Link>
              {token && (
                <Nav.Link as={Link} to="/cart" className="fw-medium">
                  <BsCart className="me-1" />
                  Cart
                </Nav.Link>
              )}
              {token && (
                <Nav.Link as={Link} to="/orders" className="fw-medium">
                  <BsClipboardCheck className="me-1" />
                  My Orders
                </Nav.Link>
              )}
              {token && (
                <Nav.Link as={Link} to="/profile" className="fw-medium">
                  <BsPerson className="me-1" />
                  Profile
                </Nav.Link>
              )}
            </Nav>
            <Nav className="ms-auto">
              {userRole === "admin" && (
                <Nav.Link as={Link} to="/admin" className="fw-medium">
                  <BsListUl className="me-1" />
                  Admin
                </Nav.Link>
              )}

              {!token ? (
                <Nav.Link as={Link} to="/login" className="fw-medium">
                  Login
                </Nav.Link>
              ) : (
                <Nav.Link onClick={handleLogout} className="fw-medium text-danger">
                  <BsBoxArrowRight className="me-1" />
                  Logout
                </Nav.Link>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="my-4">
        {/* Breadcrumb */}
        <Row className="mb-4">
          <Col>
            <Breadcrumb>
              <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>
                <BsHouse className="me-1" />
                Shop
              </Breadcrumb.Item>
              <Breadcrumb.Item active>{item.name}</Breadcrumb.Item>
            </Breadcrumb>
          </Col>
        </Row>

        <Row>
          {/* Product Images */}
          <Col lg={6} className="mb-4">
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-0">
                {item.imageUrl && Array.isArray(item.imageUrl) && item.imageUrl.length > 1 ? (
                  <div>
                    <Carousel
                      activeIndex={activeImageIndex}
                      onSelect={(selectedIndex) => setActiveImageIndex(selectedIndex)}
                      indicators={false}
                      controls={true}
                      className="mb-3"
                    >
                      {item.imageUrl.map((url, index) => (
                        <Carousel.Item key={index}>
                          <ImageMagnifier
                            src={url || "/placeholder.svg"}
                            alt={`${item.name} - ${index + 1}`}
                            className="d-block w-100"
                            style={{ height: "400px", objectFit: "contain" }}
                            zoomLevel={.5}
                          />
                        </Carousel.Item>
                      ))}
                    </Carousel>
                    {/* Thumbnail Navigation */}
                    <div className="d-flex gap-2 px-3 pb-3">
                      {item.imageUrl.map((url, index) => (
                        <img
                          key={index}
                          src={url || "/placeholder.svg"}
                          alt={`Thumbnail ${index + 1}`}
                          className={`img-thumbnail cursor-pointer ${activeImageIndex === index ? "border-primary" : ""
                            }`}
                          style={{ width: "80px", height: "80px", objectFit: "cover" }}
                          onClick={() => setActiveImageIndex(index)}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <ImageMagnifier
                    src={item.imageUrl && item.imageUrl.length > 0
                      ? item.imageUrl[0]
                      : "https://placehold.co/600x500?text=No+Image"}
                    alt={item.name}
                    className="img-fluid"
                    style={{ width: "100%", height: "400px", objectFit: "contain" }}
                    zoomLevel={2.5}
                  />
                )}
              </Card.Body>
            </Card>
            {/* Reviews - Below Photos */}
            <Card className="border-0 shadow-sm mt-4">
              <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2">
                  <h5 className="mb-0 fw-bold">Customer Reviews</h5>
                  {reviews && reviews.length > 0 && (
                    (() => {
                      const avg = reviews.reduce((sum, r) => sum + (Number(r.star) || 0), 0) / reviews.length
                      return (
                        <Badge bg="warning" text="dark">{avg.toFixed(1)} ★</Badge>
                      )
                    })()
                  )}
                  <Badge bg="secondary">{reviews?.length || 0}</Badge>
                </div>
              </Card.Header>
              <Card.Body>
                {reviewsLoading ? (
                  <div className="d-flex align-items-center gap-2 text-muted">
                    <Spinner animation="border" size="sm" /> Loading reviews...
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="text-muted">No reviews yet.</div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {reviews.map((rev, idx) => (
                      <div key={idx} className="p-3 border rounded">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="fw-bold">{rev.userName || "Anonymous"}</div>
                            <div className="text-warning">
                              {Array.from({ length: Number(rev.star) || 0 }).map((_, i) => (
                                <BsStarFill key={i} className="me-1" />
                              ))}
                            </div>
                          </div>
                          <small className="text-muted">
                            {rev.createdAt ? new Date(rev.createdAt).toLocaleString() : ""}
                          </small>
                        </div>
                        <div className="mt-2">{rev.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Product Details */}
          <Col lg={6}>
            <div className="sticky-top" style={{ top: "7rem" }}>
              {/* Product Title and Actions */}
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div className="flex-grow-1">
                  <h1 className="fw-bold mb-2">{item.name}</h1>
                  <div className="d-flex align-items-center gap-2 mb-3">
                    {item.is_bestseller && (
                      <Badge bg="warning" text="dark" className="d-flex align-items-center">
                        <BsStarFill className="me-1" />
                        Bestseller
                      </Badge>
                    )}
                    {item.isPackage && (
                      <Badge bg="info" className="d-flex align-items-center">
                        <BsShield className="me-1" />
                        Package Deal
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <Button variant="outline-secondary" size="sm" onClick={handleShare}>
                    <BsShare />
                  </Button>
                </div>
              </div>

              {/* Price */}
              <div className="mb-4">
                <h2 className="text-primary fw-bold mb-0">₱{item.price.toFixed(2)}</h2>
              </div>

              {/* Categories and Type */}
              <div className="mb-4">
                <div className="d-flex flex-wrap gap-2">
                  {item.category && (
                    <Badge bg="secondary" className="p-2">
                      {typeof item.category === "object" ? item.category.name : item.category}
                    </Badge>
                  )}
                  {item.furnituretype && (
                    <Badge bg="info" className="p-2">
                      {typeof item.furnituretype === "object" ? item.furnituretype.name : item.furnituretype}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Stock Status */}
              <Card className="mb-4 border-0 bg-light">
                <Card.Body className="py-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>Availability: </strong>
                      <Badge bg={stockVariant} className="ms-2">
                        {stockStatus}
                      </Badge>
                    </div>
                    <div className="text-end">
                      <div className="fw-bold">{item.stock} units available</div>
                      {cartQuantity > 0 && (
                        <small className="text-muted">
                          <BsCart className="me-1" />
                          {cartQuantity} in your cart
                        </small>
                      )}
                    </div>
                  </div>
                </Card.Body>
              </Card>

              {/* Description */}
              <Card className="mb-4 border-0">
                <Card.Header className="bg-white border-bottom">
                  <h5 className="mb-0 fw-bold">
                    <BsInfoCircle className="me-2 text-primary" />
                    Product Description
                  </h5>
                </Card.Header>
                <Card.Body>
                  <p className="text-muted mb-0">{item.description || "No description available."}</p>
                </Card.Body>
              </Card>

              {/* Dimensions */}
              {item.length && item.height && item.width && (
                <Card className="mb-4 border-0">
                  <Card.Header className="bg-white border-bottom">
                    <h5 className="mb-0 fw-bold">
                      <BsRulers className="me-2 text-success" />
                      Dimensions (cm)
                    </h5>
                  </Card.Header>
                  <Card.Body>
                    <Row className="text-center">
                      <Col>
                        <div className="fw-bold text-primary">{item.length}</div>
                        <small className="text-muted">Length</small>
                      </Col>
                      <Col>
                        <div className="fw-bold text-primary">{item.width}</div>
                        <small className="text-muted">Width</small>
                      </Col>
                      <Col>
                        <div className="fw-bold text-primary">{item.height}</div>
                        <small className="text-muted">Height</small>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              )}

              {/* Quantity Selector */}
              {!isOutOfStock && !isMaxInCart && (
                <Card className="mb-4 border-0">
                  <Card.Body>
                    <Form.Label className="fw-bold mb-3">Select Quantity</Form.Label>
                    <div className="d-flex align-items-center gap-3">
                      <InputGroup style={{ maxWidth: "150px" }}>
                        <Button
                          variant="outline-secondary"
                          onClick={() => handleQuantityChange("decrease")}
                          disabled={quantity <= 1}
                        >
                          <BsDash />
                        </Button>
                        <Form.Control type="text" value={quantity} readOnly className="text-center fw-bold" />
                        <Button
                          variant="outline-secondary"
                          onClick={() => handleQuantityChange("increase")}
                          disabled={quantity >= maxAddableQuantity}
                        >
                          <BsPlus />
                        </Button>
                      </InputGroup>
                      <div>
                        <small className="text-muted">Max available: {maxAddableQuantity}</small>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              )}

              {/* Action Buttons */}
              <Card className="border-0 shadow-sm">
                <Card.Body>
                  <div className="d-grid gap-3">
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleAddToCart}
                      disabled={isOutOfStock || isMaxInCart}
                      className="fw-bold py-3"
                    >
                      <BsCartPlus className="me-2" />
                      {isOutOfStock ? "Out of Stock" : isMaxInCart ? "Maximum in Cart" : "Add to Cart"}
                    </Button>
                    <Button
                      variant="success"
                      size="lg"
                      onClick={handleCheckout}
                      disabled={isOutOfStock}
                      className="fw-bold py-3"
                    >
                      <BsTruck className="me-2" />
                      Buy Now
                    </Button>

                    {item.is_customizable && (
                      <Button
                        variant="info"
                        size="lg"
                        onClick={() => setShowCustomModal(true)}
                        className="fw-bold py-3"
                      >
                        <BsRulers className="me-2" />
                        Customize Order
                      </Button>
                    )}
                  </div>

                  {/* Additional Info */}
                  <div className="mt-4 pt-3 border-top">
                    <Row className="text-center">
                      <Col>
                        <BsShield className="text-success mb-2" size={24} />
                        <div className="small">
                          <strong>Secure Payment</strong>
                        </div>
                      </Col>
                      <Col>
                        <BsTruck className="text-primary mb-2" size={24} />
                        <div className="small">
                          <strong>Fast Delivery</strong>
                        </div>
                      </Col>
                      <Col>
                        <BsCheckCircle className="text-info mb-2" size={24} />
                        <div className="small">
                          <strong>Quality Assured</strong>
                        </div>
                      </Col>
                    </Row>
                  </div>
                </Card.Body>
              </Card>

              {/* Error Display */}
              {error && (
                <Alert variant="danger" className="mt-3">
                  <BsExclamationTriangle className="me-2" />
                  {error}
                </Alert>
              )}
            </div>
          </Col>
        </Row>
      </Container>

      {/* ---------------- Customization Modal ---------------- */}
      {item && item.is_customizable && (
        <Modal show={showCustomModal} onHide={resetCustomModal} centered size="lg">
          <Modal.Header closeButton>
            <Modal.Title>
              {modalStep === "input" ? `Customize Your ${item.name}` : "Your Custom Quote"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {error && <Alert variant="danger">{error}</Alert>}

            {modalStep === "input" ? (
              <Form>
                <p>
                  Enter your desired dimensions in feet. The price will be calculated based on
                  materials and labor.
                </p>
                <Row className="mb-3">
                  <Col>
                    <Form.Group>
                      <Form.Label>Length (ft)</Form.Label>
                      <Form.Control
                        type="number"
                        min={2}
                        max={10}
                        placeholder="e.g., 5.5"
                        value={customDims.length}
                        onChange={(e) => setCustomDims({ ...customDims, length: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group>
                      <Form.Label>Width (ft)</Form.Label>
                      <Form.Control
                        type="number"
                        min={2}
                        max={6}
                        placeholder="e.g., 3"
                        value={customDims.width}
                        onChange={(e) => setCustomDims({ ...customDims, width: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                  <Col>
                    <Form.Group>
                      <Form.Label>Height (ft)</Form.Label>
                      <Form.Control
                        type="number"
                        min={2.5}
                        max={5}
                        placeholder="e.g., 4"
                        value={customDims.height}
                        onChange={(e) => setCustomDims({ ...customDims, height: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6} className="mb-3 mb-md-0">
                    <Form.Group>
                      <Form.Label>Legs & Frame Material</Form.Label>
                      <Form.Select
                        value={selectedMaterial3x3}
                        onChange={(e) => setSelectedMaterial3x3(e.target.value)}
                      >
                        {item.customization_options?.materials?.map((mat) => (
                          <option key={mat._id || mat.name} value={mat.name}>
                            {mat.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Tabletop Material</Form.Label>
                      <Form.Select
                        value={selectedMaterial2x12}
                        onChange={(e) => setSelectedMaterial2x12(e.target.value)}
                      >
                        {item.customization_options?.materials?.map((mat) => (
                          <option key={mat._id || mat.name} value={mat.name}>
                            {mat.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Estimated Labor Days</Form.Label>
                      <Form.Control type="number" value={laborDays} readOnly disabled />
                    </Form.Group>
                  </Col>
                </Row>
              </Form>
            ) : (
              customPriceDetails && (
                <Row>
                  <Col md={5} className="mb-3 mb-md-0">
                    <img src={item.imageUrl[0]} alt={item.name} className="img-fluid rounded" />
                  </Col>
                  <Col md={7}>
                    <h4>Your Custom Table</h4>
                    <p>
                      <strong>Dimensions:</strong> {customDims.length}ft x {customDims.width}ft x {customDims.height}
                      ft <br />
                      <strong>Leg/Frame Material (3×3):</strong> {selectedMaterial3x3}<br />
                      <strong>Tabletop Material (2×12):</strong> {selectedMaterial2x12}
                    </p>
                    <hr />
                    <div className="text-end">
                      <small className="text-muted">Estimated Price</small>
                      <h2 className="fw-bold text-primary">₱{customPriceDetails.finalSellingPrice.toFixed(2)}</h2>
                      <p className="text-muted">
                        Estimated completion in <strong>{laborDays} days</strong>
                      </p>
                    </div>
                  </Col>
                </Row>
              )
            )}
          </Modal.Body>
          <Modal.Footer>
            {modalStep === "input" ? (
              <Button variant="secondary" onClick={resetCustomModal}>
                Cancel
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setModalStep("input")}>
                Recalculate
              </Button>
            )}

            {modalStep === "input" ? (
              <Button variant="primary" onClick={handleCalculatePrice} disabled={isCalculating}>
                {isCalculating ? (
                  <>
                    <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                    Calculating...
                  </>
                ) : (
                  "Calculate Price"
                )}
              </Button>
            ) : (
              <>
                <Button variant="success" onClick={handleCustomCheckout}>
                  Checkout Now
                </Button>
                <Button variant="primary" onClick={handleAddCustomToCart}>
                  Add to Cart
                </Button>
              </>
            )}
          </Modal.Footer>
        </Modal>
      )}

      {/* Chat Widget - Only for users */}
      {userRole === "user" && <ChatPage />}

      
    </>
  )
}

export default SingleItemPage
