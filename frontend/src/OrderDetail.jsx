"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { useParams, useNavigate, Link } from "react-router-dom"
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
  Breadcrumb,
  ListGroup,
  ProgressBar,
  Form,
  Modal,
} from "react-bootstrap"
import {
  BsArrowLeft,
  BsReceipt,
  BsInfoCircle,
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
  BsClipboardCheck,
  BsDownload,
  BsPrinter,
  BsGeoAlt,
  BsPhone,
  BsEnvelope,
  BsShield,
  BsStarFill,
  BsHeart,
  BsShare,
  BsCartPlus,
  BsGear,
  BsCamera,
  BsStar,
  BsPencil,
  BsTrash,
  BsPlus,
} from "react-icons/bs"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const OrderDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [orderProgress, setOrderProgress] = useState(0)
  const [refundLoading, setRefundLoading] = useState(false)
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false)
  const [reviews, setReviews] = useState({})
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [reviewForm, setReviewForm] = useState({ description: '', star: 5 })
  const [reviewLoading, setReviewLoading] = useState(false)

  const userRole = localStorage.getItem("role")

  // Helper function to check if order has customized items
  const hasCustomizedItems = (order) => {
    console.log("🔍 [hasCustomizedItems] Checking if order has customized items")
    console.log("📝 Order items:", order?.items)

    const hasCustomized = order?.items?.some(item => {
      const isCustomized = item.item?.is_customizable || false
      console.log(`📋 Item ${item.item?.name}: is_customizable = ${isCustomized}`)
      return isCustomized
    }) || false

    console.log("✅ Has customized items:", hasCustomized)
    return hasCustomized
  }

  // Helper function to calculate payment amounts for mixed cart
  const calculatePaymentAmounts = (order) => {
    console.log("💰 [calculatePaymentAmounts] Calculating payment amounts for order")
    console.log("📋 Order items:", order?.items)

    if (!order?.items) {
      console.log("❌ No items found in order")
      return { customizedTotal: 0, normalTotal: 0, downPaymentAmount: 0, remainingBalance: 0 }
    }

    let customizedTotal = 0
    let normalTotal = 0

    order.items.forEach(item => {
      const itemTotal = (item.price || 0) * item.quantity
      const isCustomized = item.item?.is_customizable || false

      console.log(`📦 Item: ${item.item?.name}`)
      console.log(`💵 Price: ₱${item.price}, Quantity: ${item.quantity}, Total: ₱${itemTotal}`)
      console.log(`🔧 Is Customized: ${isCustomized}`)

      if (isCustomized) {
        customizedTotal += itemTotal
        console.log(`➕ Added to customized total: ₱${itemTotal}`)
      } else {
        normalTotal += itemTotal
        console.log(`➕ Added to normal total: ₱${itemTotal}`)
      }
    })

    // Down payment = (customized total * 30%) + normal items total
    const downPaymentAmount = (customizedTotal * 0.3) + normalTotal
    // Remaining balance = customized total * 70%
    const remainingBalance = customizedTotal * 0.7

    console.log("📊 Payment Calculation Results:")
    console.log(`🔧 Customized Items Total: ₱${customizedTotal.toFixed(2)}`)
    console.log(`📦 Normal Items Total: ₱${normalTotal.toFixed(2)}`)
    console.log(`💳 Down Payment Amount: ₱${downPaymentAmount.toFixed(2)}`)
    console.log(`💰 Remaining Balance: ₱${remainingBalance.toFixed(2)}`)

    return { customizedTotal, normalTotal, downPaymentAmount, remainingBalance }
  }

  // Helper function to calculate payment status
  const getPaymentStatus = (order) => {
    console.log("📊 [getPaymentStatus] Calculating payment status")
    console.log("💰 Order amount:", order?.amount)
    console.log("💳 Paid amount:", order?.paidAmount)

    if (!order.amount) {
      console.log("❌ No order amount found")
      return "Unknown"
    }

    const totalAmount = order.amount
    const paidAmount = order.paidAmount || 0

    // Check if order has customized items
    const hasCustomized = hasCustomizedItems(order)
    console.log("🔧 Order has customized items:", hasCustomized)

    if (hasCustomized) {
      // For customized items, use our special calculation
      const { downPaymentAmount } = calculatePaymentAmounts(order)
      const fullPaymentThreshold = totalAmount * 0.99 // Allow for small rounding differences

      console.log("🧮 Customized order payment check:")
      console.log(`💳 Paid: ₱${paidAmount.toFixed(2)}`)
      console.log(`💰 Down Payment Threshold: ₱${downPaymentAmount.toFixed(2)}`)
      console.log(`✅ Full Payment Threshold: ₱${fullPaymentThreshold.toFixed(2)}`)

      if (paidAmount >= fullPaymentThreshold) {
        console.log("✅ Status: Fully Paid")
        return "Fully Paid"
      } else if (paidAmount >= (downPaymentAmount * 0.99)) { // Allow small rounding differences
        console.log("💳 Status: Downpaid")
        return "Downpaid"
      } else if (paidAmount > 0) {
        console.log("⚠️ Status: Partial Payment")
        return "Partial Payment"
      } else {
        console.log("❌ Status: Unpaid")
        return "Unpaid"
      }
    } else {
      // For normal orders, use simple calculation
      const fullPaymentThreshold = totalAmount * 0.99

      console.log("📦 Normal order payment check:")
      console.log(`💳 Paid: ₱${paidAmount.toFixed(2)}`)
      console.log(`✅ Full Payment Threshold: ₱${fullPaymentThreshold.toFixed(2)}`)

      if (paidAmount >= fullPaymentThreshold) {
        console.log("✅ Status: Fully Paid")
        return "Fully Paid"
      } else if (paidAmount > 0) {
        console.log("⚠️ Status: Partial Payment")
        return "Partial Payment"
      } else {
        console.log("❌ Status: Unpaid")
        return "Unpaid"
      }
    }
  }

  // Helper function to get remaining balance
  const getRemainingBalance = (order) => {
    console.log("💰 [getRemainingBalance] Calculating remaining balance")

    if (!order.amount) {
      console.log("❌ No order amount found")
      return 0
    }

    const paidAmount = order.totalWithShipping || 0
    const hasCustomized = hasCustomizedItems(order)

    console.log("💳 Paid amount:", paidAmount)
    console.log("🔧 Has customized items:", hasCustomized)

    if (hasCustomized) {
      // For customized orders, remaining balance is only 70% of customized items
      const { remainingBalance } = calculatePaymentAmounts(order)
      const actualRemaining = Math.max(0, remainingBalance - Math.max(0, paidAmount - (order.amount - remainingBalance)))

      console.log("🧮 Customized order remaining balance:")
      console.log(`💰 Calculated remaining: ₱${remainingBalance.toFixed(2)}`)
      console.log(`💳 Actual remaining: ₱${actualRemaining.toFixed(2)}`)

      return actualRemaining
    } else {
      // For normal orders, simple calculation
      const remaining = Math.max(0, order.amount - paidAmount)
      console.log("📦 Normal order remaining balance: ₱", remaining.toFixed(2))
      return remaining
    }
  }

  // Helper function to get expected delivery/pickup date and text
  const getExpectedDeliveryInfo = (order) => {
    const hasCustomItems = order.items?.some(item => item.item?.is_customizable)
    
    // Determine label text
    let label
    if (order.deliveryOption === 'pickup') {
      label = hasCustomItems ? "Expected Pickup At:" : "Pickup Available:"
    } else {
      label = hasCustomItems ? "Expected Delivery At:" : "Expected Delivery:"
    }
    
    // Determine date/time text
    let dateText
    if (hasCustomItems) {
      // For custom items, calculate based on estimated days
      const maxEstimatedDays = Math.max(
        ...order.items
          .filter(item => item.item?.is_customizable)
          .map(item => item.item?.customization_options?.estimated_days || 7)
      )
      const orderDate = new Date(order.createdAt)
      const expectedDate = new Date(orderDate.getTime() + (maxEstimatedDays * 24 * 60 * 60 * 1000))
      dateText = expectedDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    } else {
      // For regular items
      if (order.deliveryOption === 'pickup') {
        dateText = "1-2 business days"
      } else {
        dateText = "3-5 business days"
      }
    }
    
    return { label, dateText, hasCustomItems }
  }

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/orders/${id}/status`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        })
        setOrder(response.data)

        console.log("=== ORDER DETAILS LOADED ===")
        console.log("Order data:", response.data)
        console.log("Order status:", response.data.status)
        console.log("Order items:", response.data.items)
        console.log("User role:", userRole)

        // Calculate order progress based on status
        const status = response.data.status
        switch (status) {
          case "Pending":
            setOrderProgress(10)
            break
          case "On Process":
            setOrderProgress(40)
            break
          case "Ready for Pickup":
            setOrderProgress(60)
            break
          case "Delivered":
          case "Picked Up":
            setOrderProgress(100)
            break
          case "Requesting for Refund":
            setOrderProgress(25)
            break
          case "Refunded":
            setOrderProgress(100)
            break
          case "Cancelled":
            setOrderProgress(0)
            break
          default:
            setOrderProgress(10)
        }

      } catch (err) {
        setError(err.response?.data?.message || "Error fetching order details")
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [id])

  // Log refund eligibility when order changes
  useEffect(() => {
    if (order) {
      console.log("=== REFUND ELIGIBILITY CHECK (Order Updated) ===")
      const canRefund = canRequestRefund()
      console.log("Can request refund:", canRefund)
      console.log("Refund button tooltip:", getRefundButtonTooltip())
    }
  }, [order])

  // Fetch reviews for all items in the order
  useEffect(() => {
    const fetchReviews = async () => {
      if (!order?.items) return

      const reviewsData = {}
      for (const orderItem of order.items) {
        if (orderItem.item?._id) {
          try {
            const response = await axios.get(`${BACKEND_URL}/api/items/${orderItem.item._id}/reviews`)
            if (response.data.success) {
              reviewsData[orderItem.item._id] = response.data.reviews
            }
          } catch (error) {
            console.error(`Error fetching reviews for item ${orderItem.item._id}:`, error)
            reviewsData[orderItem.item._id] = []
          }
        }
      }
      setReviews(reviewsData)
    }

    fetchReviews()
  }, [order])

  // Review-related functions
  const handleAddReview = (item) => {
    setSelectedItem(item)
    setReviewForm({ description: '', star: 5 })
    setShowReviewModal(true)
  }

  const handleSubmitReview = async () => {
    if (!selectedItem || !reviewForm.description.trim()) {
      alert('Please provide a review description')
      return
    }

    setReviewLoading(true)
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/items/${selectedItem._id}/reviews`,
        reviewForm,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      )

      if (response.data.success) {
        // Update local reviews state
        const updatedReviews = { ...reviews }
        if (!updatedReviews[selectedItem._id]) {
          updatedReviews[selectedItem._id] = []
        }
        updatedReviews[selectedItem._id].push(response.data.review)
        setReviews(updatedReviews)

        setShowReviewModal(false)
        setSelectedItem(null)
        setReviewForm({ description: '', star: 5 })
        alert('Review submitted successfully!')
      }
    } catch (error) {
      console.error('Error submitting review:', error)
      const errorMessage = error.response?.data?.message || 'Failed to submit review'
      alert(errorMessage)
    } finally {
      setReviewLoading(false)
    }
  }

  const handleDeleteReview = async (itemId, reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review?')) {
      return
    }

    try {
      const response = await axios.delete(
        `${BACKEND_URL}/api/items/${itemId}/reviews/${reviewId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      )

      if (response.data.success) {
        // Update local reviews state
        const updatedReviews = { ...reviews }
        updatedReviews[itemId] = updatedReviews[itemId].filter(
          review => review._id !== reviewId
        )
        setReviews(updatedReviews)
        alert('Review deleted successfully!')
      }
    } catch (error) {
      console.error('Error deleting review:', error)
      const errorMessage = error.response?.data?.message || 'Failed to delete review'
      alert(errorMessage)
    }
  }

  const getCurrentUserId = () => {
    try {
      const token = localStorage.getItem("token")
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return payload.id
      }
    } catch (error) {
      console.error('Error parsing JWT token:', error)
    }
    return null
  }

  const canReviewItem = (item) => {
    // User can review if they have purchased the item and haven't reviewed it yet
    const itemReviews = reviews[item._id] || []
    const currentUserId = getCurrentUserId()
    const userReview = itemReviews.find(review => 
      review.userId === currentUserId
    )
    return !userReview
  }

  const getUserReview = (item) => {
    const itemReviews = reviews[item._id] || []
    const currentUserId = getCurrentUserId()
    return itemReviews.find(review => 
      review.userId === currentUserId
    )
  }

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <BsStarFill
        key={index}
        className={index < rating ? "text-warning" : "text-muted"}
        size={16}
      />
    ))
  }



  const getStatusVariant = (status) => {
    console.log("🎨 [getStatusVariant] Getting badge variant for status:", status);
    switch (status) {
      case "Pending":
        return "secondary"
      case "On Process":
        return "primary"
      case "Ready for Pickup":
        return "warning"
      case "Delivered":
      case "Picked Up":
        return "success"
      case "Requesting for Refund":
        return "info"
      case "Refunded":
        return "danger"
      case "Cancelled":
        return "dark"
      default:
        return "secondary"
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case "Delivered":
      case "Picked Up":
      case "Refunded":
        return <BsCheckCircle />
      case "On Process":
      case "Ready for Pickup":
        return <BsClock />
      case "Requesting for Refund":
        return <BsExclamationTriangle />
      case "Cancelled":
        return <BsXCircle />
      case "Pending":
        return <BsInfoCircle />
      default:
        return <BsInfoCircle />
    }
  }

  const getProgressVariant = (status) => {
    switch (status) {
      case "Delivered":
      case "Picked Up":
      case "Refunded":
        return "success"
      case "On Process":
      case "Ready for Pickup":
        return "primary"
      case "Requesting for Refund":
        return "info"
      case "Cancelled":
        return "danger"
      default:
        return "warning"
    }
  }

  const handleReorder = () => {
    // Navigate to cart with these items
    navigate("/cart", { state: { reorderItems: order.items } })
  }

  const handleDownloadReceipt = () => {
    // Implement download receipt functionality
    console.log("Downloading receipt for order:", order._id)
  }

  const handlePrintReceipt = () => {
    window.print()
  }

  const handlePayFullAmount = async () => {
    console.log("💳 [handlePayFullAmount] Initiating full payment for customized order")
    console.log("📋 Order ID:", order._id)
    console.log("💰 Remaining balance:", order.balance)

    if (!hasCustomizedItems(order)) {
      console.log("❌ Order does not have customized items")
      alert("This feature is only available for customized orders.")
      return
    }

    const remainingAmount = order.balance
    if (remainingAmount <= 0) {
      console.log("❌ No remaining balance to pay")
      alert("This order is already fully paid.")
      return
    }

    const confirmed = window.confirm(
      `Complete payment for the remaining balance of ₱${remainingAmount.toLocaleString()}?`
    )

    if (!confirmed) {
      console.log("🚫 User cancelled payment")
      return
    }

    console.log("✅ User confirmed payment. Proceeding to PayMongo...")
    setStatusUpdateLoading(true)

    try {
      // Call backend API to create PayMongo session for remaining amount
      console.log("🔗 Creating PayMongo session for remaining payment...")
      const response = await axios.post(
        `${BACKEND_URL}/api/orders/${order._id}/complete-payment`,
        {
          amount: remainingAmount,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      )

      console.log("💳 PayMongo session created:", response.data)

      if (response.data.checkoutUrl) {
        console.log("🌐 Redirecting to PayMongo checkout...")
        window.location.href = response.data.checkoutUrl
      } else {
        throw new Error("No checkout URL received from PayMongo")
      }

    } catch (error) {
      console.error("❌ Error creating payment session:", error)
      const errorMessage = error.response?.data?.message || "Failed to create payment session. Please try again."
      alert(errorMessage)
    } finally {
      setStatusUpdateLoading(false)
    }
  }

  const handleRefundRequest = async () => {
    console.log("=== REFUND REQUEST STARTED ===")
    console.log("Order ID:", order._id)
    console.log("Order status:", order.status)
    console.log("Order items:", order.items)

   
   

    // Check if any items are customized
    const hasCustomizedItems = order.items.some(item => {
      const isCustomized = item.item?.is_customizable || false
      console.log(`Item ${item.item?.name}: is_customizable = ${isCustomized}`)
      return isCustomized
    })

    console.log("Has customized items:", hasCustomizedItems)

    if (hasCustomizedItems) {
      console.log("ERROR: Order contains customized items. Refund not allowed.")
      alert("Refund requests cannot be made for orders containing customized items.")
      return
    }

    // Confirm refund request
    const confirmed = window.confirm(
      "Are you sure you want to request a refund for this order? This action cannot be undone."
    )

    if (!confirmed) {
      console.log("User cancelled refund request")
      return
    }

    console.log("User confirmed refund request. Proceeding...")

    setRefundLoading(true)

    try {
      console.log("=== SENDING REFUND REQUEST TO BACKEND ===")
      const refundUrl = `${BACKEND_URL}/api/orders/${order._id}/request-refund`
      const response = await axios.put(
        refundUrl,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      )

      console.log("=== REFUND REQUEST RESPONSE ===")
      console.log("Response status:", response.status)
      console.log("Response data:", response.data)

      alert("Refund request submitted successfully! We will review your request and contact you soon.")

      // Refresh order data to show updated status
      console.log("Refreshing order data...")
      const updatedResponse = await axios.get(`${BACKEND_URL}/api/orders/${id}/status`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      console.log("Updated order data:", updatedResponse.data)
      setOrder(updatedResponse.data)

    } catch (error) {
      console.log("=== REFUND REQUEST ERROR ===")
      console.error("Error requesting refund:", error)
      console.error("Error response:", error.response?.data)
      console.error("Error status:", error.response?.status)

      const errorMessage = error.response?.data?.message || "Failed to submit refund request. Please try again."
      alert(errorMessage)
    } finally {
      setRefundLoading(false)
      console.log("=== REFUND REQUEST COMPLETED ===")
    }
  }

  const canRequestRefund = () => {
    console.log("=== CHECKING REFUND ELIGIBILITY ===")
    console.log("Order status:", order?.status)
    console.log("User role:", userRole)
    console.log("Order exists:", !!order)
    console.log("Order items:", order?.items)

    // Only customers can request refunds (not admins)
    if (userRole === "admin") {
      console.log("User is admin - cannot request refund")
      return false
    }

    // Only "On Process" orders can be refunded

    // Check if any items are customized
    const hasCustomizedItems = order?.items?.some(item => {
      const isCustomized = item.item?.is_customizable || false
      console.log(`Item ${item.item?.name}: is_customizable = ${isCustomized}`)
      return isCustomized
    })

    console.log("Has customized items:", hasCustomizedItems)

    if (hasCustomizedItems) {
      console.log("Order has customized items - cannot request refund")
      return false
    }

    console.log("✅ Order is eligible for refund request")
    return true
  }

  const getRefundButtonTooltip = () => {
    if (userRole === "admin") {
      return "Admins cannot request refunds"
    }

    if (order?.status !== "On Process") {
      return "Refund requests can only be made for orders that are currently being processed"
    }

    const hasCustomizedItems = order?.items?.some(item => item.item?.is_customizable || false)
    if (hasCustomizedItems) {
      return "Refund requests cannot be made for orders containing customized items"
    }

    return "Request a refund for this order"
  }

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: "4rem", height: "4rem" }} />
          <p className="mt-3 text-muted">Loading order details...</p>
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
            Error Loading Order
          </Alert.Heading>
          <p>{error}</p>
          <hr />
          <div className="d-flex justify-content-end gap-2">
            <Button variant="outline-secondary" onClick={() => navigate(-1)}>
              <BsArrowLeft className="me-2" />
              Go Back
            </Button>
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
      <Navbar bg="white" variant="light" expand="lg" sticky="top" className="py-3 border-bottom shadow-sm" style={{ zIndex: 1030 }}>
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
              <Nav.Link as={Link} to="/orders" className="fw-medium">
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
        {/* Breadcrumb */}
        <Breadcrumb className="mb-4">
          <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/" }}>
            <BsShop className="me-1" />
            Shop
          </Breadcrumb.Item>
          <Breadcrumb.Item linkAs={Link} linkProps={{ to: "/orders" }}>
            <BsClipboardCheck className="me-1" />
            My Orders
          </Breadcrumb.Item>
          <Breadcrumb.Item active>Order #{order._id?.slice(-8)}</Breadcrumb.Item>
        </Breadcrumb>

        {/* Page Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold mb-1">
              <BsReceipt className="me-2 text-primary" />
              Order Details
            </h2>
            <p className="text-muted mb-0">Track your order and view details</p>
          </div>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={() => navigate(-1)}>
              <BsArrowLeft className="me-2" />
              Back to Orders
            </Button>
            <Button variant="outline-primary" onClick={handleDownloadReceipt}>
              <BsDownload className="me-2" />
              Download
            </Button>
            <Button variant="outline-secondary" onClick={handlePrintReceipt}>
              <BsPrinter className="me-2" />
              Print
            </Button>
          </div>
        </div>

        <Row>
          {/* Order Information */}
          <Col lg={8} className="mb-4">
            {/* Order Status Card */}
            <Card className="border-0 shadow-sm mb-4">
              <Card.Header className="bg-white border-bottom">
                <h5 className="mb-0 fw-bold">
                  <BsInfoCircle className="me-2 text-primary" />
                  Order Status & Payment
                </h5>
              </Card.Header>
              <Card.Body>
                <Row className="align-items-center mb-3">
                  <Col md={8}>
                    <div className="d-flex align-items-center mb-2">
                      <Badge bg={getStatusVariant(order.status)} className="d-flex align-items-center me-3">
                        {getStatusIcon(order.status)}
                        <span className="ms-1 text-capitalize">{order.status}</span>
                      </Badge>
                      <Badge bg="outline-secondary" className="me-3">
                        {order.paymentStatus || getPaymentStatus(order)}
                      </Badge>
                      <Badge bg={order.deliveryOption === 'shipping' ? 'primary' : 'success'}>
                        {order.deliveryOption === 'shipping' ? 'Delivery' : 'Pickup'}
                      </Badge>
                    </div>
                    <p className="text-muted mb-2">
                      {order.status === "Pending" && "Your order is pending payment confirmation."}
                      {order.status === "On Process" && (order.deliveryOption === 'shipping' ? "Your order is being prepared for shipment." : "Your order is being prepared.")}
                      {order.status === "Ready for Pickup" && "Your order is ready for pickup at our store."}
                      {order.status === "Delivered" && "Your order has been delivered successfully!"}
                      {order.status === "Picked Up" && "Your order has been picked up successfully!"}
                      {order.status === "Requesting for Refund" && "Your refund request is being processed."}
                      {order.status === "Refunded" && "Your refund has been processed."}
                      {order.status === "Cancelled" && "This order has been cancelled."}
                      {!order.status && "Order status unknown."}
                    </p>

                    <ProgressBar
                      now={orderProgress}
                      variant={getProgressVariant(order.status)}
                      className="mb-2"
                      style={{ height: "8px" }}
                    />
                    <div className="d-flex justify-content-between small text-muted">
                      <span>Order Placed</span>
                      {order.deliveryOption === 'shipping' ? (
                        <>
                          <span>Processing</span>
                          <span>Delivered</span>
                        </>
                      ) : (
                        <>
                          <span>Processing</span>
                          <span>Ready</span>
                          <span>Picked Up</span>
                        </>
                      )}
                    </div>
                  </Col>
                  <Col md={4} className="text-end">
                    {/* Payment Information */}
                    <div className="bg-light p-3 rounded">
                      <h6 className="fw-bold mb-2">Payment Details</h6>
                      <div className="small">
                        <div className="d-flex justify-content-between">
                          <span>Total Amount:</span>
                          <span className="fw-bold">₱{order.totalWithShipping?.toLocaleString()}</span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span>Amount Paid:</span>
                          <span className="text-success">₱{(order.downPayment || 0).toLocaleString()}</span>
                        </div>
                        {order.balance > 0 && (
                          <div className="d-flex justify-content-between">
                            <span>Remaining Balance:</span>
                            <span className="text-warning fw-bold">₱{order.balance?.toLocaleString()}</span>
                          </div>
                        )}
                        <hr className="my-2" />
                        <div className="d-flex justify-content-between fw-bold">
                          <span>Payment Status:</span>
                          <span className={order.paymentStatus === 'Fully Paid' ? 'text-success' :
                            order.paymentStatus === 'Pending Downpayment' ? 'text-info' : 'text-warning'}>
                            {order.paymentStatus || getPaymentStatus(order)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pay Full Amount Button for Customized Orders */}
                    {order.balance > 0 && (
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handlePayFullAmount()}
                        className="mt-2 w-100"
                        disabled={statusUpdateLoading}
                      >
                        {statusUpdateLoading ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" className="me-1" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <BsCurrencyDollar className="me-1" />
                            Pay Remaining ₱{order.balance.toLocaleString()}
                          </>
                        )}
                      </Button>
                    )}

                    {(order.status === "Delivered" || order.status === "Picked Up") && (
                      <Button variant="outline-primary" size="sm" onClick={handleReorder} className="mt-2">
                        <BsCartPlus className="me-1" />
                        Reorder Items
                      </Button>
                    )}
                    {canRequestRefund() && order.paymentStatus !== 'Refund Requested' && (
                      <Button
                        variant="outline-warning"
                        size="sm"
                        onClick={handleRefundRequest}
                        disabled={refundLoading}
                        title={getRefundButtonTooltip()}
                        className="mt-2 ms-2"
                      >
                        {refundLoading ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" className="me-1" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <BsExclamationTriangle className="me-1" />
                            Request Refund
                          </>
                        )}
                      </Button>
                    )}
                    {!canRequestRefund() || order.paymentStatus === 'Refund Requested' && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        
                        title={getRefundButtonTooltip()}
                        className="mt-2 ms-2"
                      >
                        <BsExclamationTriangle className="me-1" />
                        Request Refund
                      </Button>
                    )}

                    {/* Debug Info - Remove in production */}

                  </Col>
                </Row>

                {/* Delivery Proof Section */}
                {((order.status === "Delivered" || order.status === "Picked Up") && order.deliveryProof) && (
                  <div className="mt-4 p-3 bg-light rounded">
                    <div className="d-flex align-items-center mb-3">
                      <BsCheckCircle className="text-success me-2" size={20} />
                      <h6 className="mb-0 fw-bold text-success">
                        {order.status === "Delivered" ? "Delivery Proof" : "Pickup Proof"} Uploaded
                      </h6>
                    </div>
                    <div className="text-center">
                      <img
                        src={order.deliveryProof}
                        alt={`${order.status} Proof`}
                        className="img-fluid rounded shadow-sm"
                        style={{ maxHeight: "300px", maxWidth: "100%" }}
                      />
                      <div className="mt-2">
                        <small className="text-muted">
                          Proof uploaded on: {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : 'N/A'}
                        </small>
                      </div>
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Order Information Card */}
            <Card className="border-0 shadow-sm mb-4">
              <Card.Header className="bg-white border-bottom">
                <h5 className="mb-0 fw-bold">
                  <BsReceipt className="me-2 text-primary" />
                  Order Information
                </h5>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <ListGroup variant="flush">
                      <ListGroup.Item className="px-0 py-2 border-0">
                        <div className="d-flex justify-content-between">
                          <span className="text-muted">Order ID:</span>
                          <span className="fw-bold font-monospace">#{order._id?.slice(-8)}</span>
                        </div>
                      </ListGroup.Item>
                      <ListGroup.Item className="px-0 py-2 border-0">
                        <div className="d-flex justify-content-between">
                          <span className="text-muted">Order Date:</span>
                          <span className="fw-medium">{new Date(order.createdAt).toLocaleDateString()}</span>
                        </div>
                      </ListGroup.Item>
                      <ListGroup.Item className="px-0 py-2 border-0">
                        <div className="d-flex justify-content-between">
                          <span className="text-muted">Order Time:</span>
                          <span className="fw-medium">{new Date(order.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </ListGroup.Item>
                    </ListGroup>
                  </Col>
                  <Col md={6}>
                    <ListGroup variant="flush">
                      <ListGroup.Item className="px-0 py-2 border-0">
                        <div className="d-flex justify-content-between">
                          <span className="text-muted">Payment Method:</span>
                          <span className="fw-medium">Credit Card</span>
                        </div>
                      </ListGroup.Item>
                      <ListGroup.Item className="px-0 py-2 border-0">
                        <div className="d-flex justify-content-between">
                          <span className="text-muted">
                            {order.deliveryOption === 'pickup' ? 'Fulfillment Method:' : 'Shipping Method:'}
                          </span>
                          <span className="fw-medium">
                            {order.deliveryOption === 'pickup' ? 'Store Pickup' : 'Standard Delivery'}
                          </span>
                        </div>
                      </ListGroup.Item>
                      {(() => {
                        const deliveryInfo = getExpectedDeliveryInfo(order)
                        return (
                          <ListGroup.Item className="px-0 py-2 border-0">
                            <div className="d-flex justify-content-between">
                              <span className="text-muted">
                                {deliveryInfo.label}
                              </span>
                              <span className="fw-medium">
                                {deliveryInfo.dateText}
                                {deliveryInfo.hasCustomItems}
                              </span>
                            </div>
                          </ListGroup.Item>
                        )
                      })()}
                    </ListGroup>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

            {/* Order Items */}
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white border-bottom">
                <h5 className="mb-0 fw-bold">
                  <BsBoxSeam className="me-2 text-primary" />
                  Order Items ({order.items?.length || 0})
                </h5>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="table-responsive">
                  <Table className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Product</th>
                        <th>Dimensions (H×W×L)</th>
                        <th>Price</th>
                        <th>Quantity</th>
                        <th>Subtotal</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items?.map((item, index) => (
                        <tr key={index}>
                          <td>
                            <div className="d-flex align-items-center">
                              <img
                                src={item.item?.imageUrl?.[0] || "https://via.placeholder.com/60"}
                                alt={item.item?.name}
                                style={{
                                  width: "60px",
                                  height: "60px",
                                  objectFit: "cover",
                                  borderRadius: "8px",
                                }}
                                className="me-3"
                              />
                              <div>
                                <div className="fw-medium">{item.item?.name || "Item not available"}</div>
                                <small className="text-muted">
                                  {item.item?.category?.name && `Category: ${item.item.category.name}`}
                                </small>
                                {item.item?.is_bestseller && (
                                  <div>
                                    <Badge bg="warning" text="dark" className="mt-1">
                                      <BsStarFill className="me-1" />
                                      Bestseller
                                    </Badge>
                                  </div>
                                )}
                                {item.item?.is_customizable && (
                                  <div className="d-flex align-items-center gap-2">
                                    <Badge bg="info" text="dark" className="mt-1">
                                      <BsGear className="me-1" />
                                      Customized
                                    </Badge>
                                    <Badge bg="warning" text="dark" className="mt-1" title="Delivery proof required">
                                      <BsCamera className="me-1" />
                                      Proof Required
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="font-monospace">
                            {item.customH && item.customW && item.customL
                              ? `${item.customH} × ${item.customW} × ${item.customL}`
                              : "-"}
                          </td>
                          <td>
                            {(() => {
                              const unitPrice = item.price ?? 0;
                              return (
                                <div className="d-flex align-items-center gap-2">
                                  <span className="fw-bold text-primary">₱{unitPrice.toFixed(2)}</span>
                                  {item.item?.is_customizable && (
                                    <Badge bg="warning" text="dark" className="small ms-1">
                                      Custom
                                    </Badge>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td>
                            <Badge bg="light" text="dark" className="fs-6">
                              {item.quantity}
                            </Badge>
                          </td>
                          <td>
                            <span className="fw-bold">
                              ₱{(((item.price ?? 0) * item.quantity).toFixed(2))}
                            </span>
                          </td>
                          <td>
                            <div className="d-flex gap-1">
                              {item.item && (
                                <>
                                  <Button variant="outline-primary" size="sm" as={Link} to={`/item/${item.item._id}`}>
                                    <BsBoxSeam />
                                  </Button>
                                  {(
                                    <>
                                      {canReviewItem(item.item) ? (
                                        <Button 
                                          variant="outline-warning" 
                                          size="sm"
                                          onClick={() => handleAddReview(item.item)}
                                          title="Write a review"
                                        >
                                          <BsStar />
                                        </Button>
                                      ) : (
                                        <Button 
                                          variant="outline-success" 
                                          size="sm"
                                          disabled
                                          title="You have already reviewed this item"
                                        >
                                          <BsCheckCircle />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                  <Button variant="outline-secondary" size="sm">
                                    <BsHeart />
                                  </Button>
                                  <Button variant="outline-secondary" size="sm">
                                    <BsShare />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card.Body>
            </Card>

            {/* Reviews Section */}
            {(
              <Card className="border-0 shadow-sm mt-4">
                <Card.Header className="bg-white border-bottom">
                  <h5 className="mb-0 fw-bold">
                    <BsStarFill className="me-2 text-warning" />
                    Product Reviews
                  </h5>
                </Card.Header>
                <Card.Body>
                  {order.items?.map((orderItem, index) => {
                    const item = orderItem.item
                    const itemReviews = reviews[item?._id] || []
                    const userReview = getUserReview(item)
                    
                    return (
                      <div key={index} className="mb-4">
                        <div className="d-flex align-items-center justify-content-between mb-3">
                          <div className="d-flex align-items-center">
                            <img
                              src={item?.imageUrl?.[0] || "https://via.placeholder.com/50"}
                              alt={item?.name}
                              style={{
                                width: "50px",
                                height: "50px",
                                objectFit: "cover",
                                borderRadius: "8px",
                              }}
                              className="me-3"
                            />
                            <div>
                              <h6 className="mb-1">{item?.name}</h6>
                              <div className="d-flex align-items-center gap-2">
                                <span className="text-muted small">
                                  {itemReviews.length} review{itemReviews.length !== 1 ? 's' : ''}
                                </span>
                                {itemReviews.length > 0 && (
                                  <div className="d-flex align-items-center">
                                    {renderStars(
                                      Math.round(
                                        itemReviews.reduce((sum, review) => sum + review.star, 0) / itemReviews.length
                                      )
                                    )}
                                    <span className="ms-1 small text-muted">
                                      ({Math.round(
                                        itemReviews.reduce((sum, review) => sum + review.star, 0) / itemReviews.length * 10
                                      ) / 10})
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          {canReviewItem(item) && (
                            <Button 
                              variant="outline-warning" 
                              size="sm"
                              onClick={() => handleAddReview(item)}
                            >
                              <BsPlus className="me-1" />
                              Write Review
                            </Button>
                          )}
                        </div>

                        {/* User's Review */}
                        {userReview && (
                          <div className="bg-light p-3 rounded mb-3">
                            <div className="d-flex justify-content-between align-items-start">
                              <div>
                                <div className="d-flex align-items-center mb-2">
                                  <BsStarFill className="text-warning me-1" />
                                  <span className="fw-medium">Your Review</span>
                                  <div className="ms-2">
                                    {renderStars(userReview.star)}
                                  </div>
                                </div>
                                <p className="mb-2">{userReview.description}</p>
                                <small className="text-muted">
                                  Reviewed on {new Date(userReview.createdAt).toLocaleDateString()}
                                </small>
                              </div>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDeleteReview(item._id, userReview._id)}
                                title="Delete review"
                              >
                                <BsTrash />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Other Reviews */}
                        {itemReviews.filter(review => review.userId !== getCurrentUserId()).map((review, reviewIndex) => (
                          <div key={reviewIndex} className="border-bottom pb-3 mb-3">
                            <div className="d-flex justify-content-between align-items-start">
                              <div>
                                <div className="d-flex align-items-center mb-2">
                                  <span className="fw-medium">{review.userName}</span>
                                  <div className="ms-2">
                                    {renderStars(review.star)}
                                  </div>
                                </div>
                                <p className="mb-2">{review.description}</p>
                                <small className="text-muted">
                                  Reviewed on {new Date(review.createdAt).toLocaleDateString()}
                                </small>
                              </div>
                            </div>
                          </div>
                        ))}

                        {itemReviews.length === 0 && (
                          <div className="text-center py-4 text-muted">
                            <BsStar className="mb-2" size={24} />
                            <p className="mb-2">No Reviews Yet</p>
                            <p className="small">Be the first to review this product!</p>
                            {canReviewItem(item) && (
                              <Button 
                                variant="outline-warning" 
                                size="sm"
                                onClick={() => handleAddReview(item)}
                              >
                                <BsPlus className="me-1" />
                                Write First Review
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </Card.Body>
              </Card>
            )}
          </Col>

          {/* Order Summary Sidebar */}
          <Col lg={4}>
            <div className="sticky-top" style={{ top: "7rem" }}>
              {/* Order Summary */}
              <Card className="border-0 shadow-sm mb-4">
                <Card.Header className="bg-white border-bottom">
                  <h5 className="mb-0 fw-bold">
                    <BsCurrencyDollar className="me-2 text-success" />
                    Order Summary
                  </h5>
                </Card.Header>
                <Card.Body>
                  <ListGroup variant="flush">
                    <ListGroup.Item className="d-flex justify-content-between align-items-center px-0 py-3">
                      <span>Subtotal ({order.items?.length || 0} items)</span>
                      <span className="fw-bold">₱{order.amount?.toFixed(2)}</span>
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex justify-content-between align-items-center px-0 py-3">
                      <span>
                        <BsTruck className="me-1 text-success" />
                        Shipping
                      </span>
                      <span className={order.shippingFee > 0 ? "fw-bold" : "text-success fw-bold"}>
                        {order.shippingFee > 0 ? `₱${order.shippingFee.toFixed(2)}` : "FREE"}
                      </span>
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex justify-content-between align-items-center px-0 py-3">
                      <span>Tax</span>
                      <span className="fw-bold">₱0.00</span>
                    </ListGroup.Item>
                    <ListGroup.Item className="d-flex justify-content-between align-items-center px-0 py-3 border-top">
                      <span className="fw-bold fs-5">Total</span>
                      <span className="fw-bold fs-4 text-primary">₱{(order.amount + (order.shippingFee || 0))?.toFixed(2)}</span>
                    </ListGroup.Item>
                  </ListGroup>
                </Card.Body>
              </Card>

              {/* Delivery Information */}
              <Card className="border-0 shadow-sm mb-4">
                <Card.Header className="bg-white border-bottom">
                  <h5 className="mb-0 fw-bold">
                    <BsGeoAlt className="me-2 text-info" />
                    Delivery Information
                  </h5>
                </Card.Header>
                <Card.Body>
                  <div className="mb-3">
                    <div className="fw-medium mb-1">Shipping Address</div>
                    <div className="text-muted">
                      {order.address ?
                        (typeof order.address === 'string' ?
                          order.address :
                          [
                            order.address.fullName,
                            order.address.addressLine1,
                            order.address.addressLine2,
                            order.address.cityName || order.address.city,
                            order.address.provinceName || order.address.state,
                            order.address.postalCode
                          ].filter(Boolean).join(", ")
                        ) :
                        "123 Main Street, Tanay, Rizal, Philippines"
                      }
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="fw-medium mb-1">Contact Information</div>
                    <div className="text-muted">
                      <BsPhone className="me-2" />
                      {order.phone || "+63 912 345 6789"}
                    </div>
                    <div className="text-muted">
                      <BsEnvelope className="me-2" />
                      {order.user?.email || "customer@email.com"}
                    </div>
                  </div>
                  <div>
                    <div className="fw-medium mb-1">Delivery Instructions</div>
                    <div className="text-muted small">Please call upon arrival. Leave at front door if no answer.</div>
                  </div>
                </Card.Body>
              </Card>

              {/* Help & Support */}
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-white border-bottom">
                  <h5 className="mb-0 fw-bold">
                    <BsShield className="me-2 text-warning" />
                    Need Help?
                  </h5>
                </Card.Header>
                <Card.Body>
                  <div className="d-grid gap-2">

                    <Button variant="outline-secondary">
                      <BsPhone className="me-2" />
                      Call Customer Service
                    </Button>
                    <Button variant="outline-info">
                      <BsEnvelope className="me-2" />
                      Email Support
                    </Button>
                  </div>
                  <div className="mt-3 pt-3 border-top">
                    <small className="text-muted">
                      <BsShield className="me-1" />
                      Your order is protected by our buyer protection policy.
                    </small>
                  </div>
                </Card.Body>
              </Card>
            </div>
          </Col>
        </Row>
      </Container>

      {/* Review Modal */}
      <Modal show={showReviewModal} onHide={() => setShowReviewModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <BsStar className="me-2 text-warning" />
            Write a Review for {selectedItem?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Rating</Form.Label>
              <div className="d-flex align-items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <BsStarFill
                    key={star}
                    className={`cursor-pointer ${star <= reviewForm.star ? 'text-warning' : 'text-muted'}`}
                    size={24}
                    onClick={() => setReviewForm({ ...reviewForm, star })}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
                <span className="ms-2 fw-medium">{reviewForm.star} out of 5</span>
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Review Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                placeholder="Share your experience with this product..."
                value={reviewForm.description}
                onChange={(e) => setReviewForm({ ...reviewForm, description: e.target.value })}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowReviewModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSubmitReview}
            disabled={reviewLoading || !reviewForm.description.trim()}
          >
            {reviewLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Submitting...
              </>
            ) : (
              <>
                <BsStar className="me-2" />
                Submit Review
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}

export default OrderDetail
