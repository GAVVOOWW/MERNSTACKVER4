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
  Form,
  Navbar,
  Nav,
  InputGroup,
  Alert,
  Spinner,
  Badge,
  Dropdown,
  Pagination,
} from "react-bootstrap"
import {
  BsSearch,
  BsHeart,
  BsHeartFill,
  BsStarFill,
  BsStar,
  BsShop,
  BsCart,
  BsPerson,
  BsRobot,
  BsListUl,
  BsChatDots,
  BsBoxArrowRight,
  BsFilter,
  BsSortDown,
  BsGrid3X3Gap,
  BsList,
  BsEye,
  BsGeoAlt,
  BsAward,
  BsShield,
  BsTruck,
  BsCheckCircle,
  BsHouse,
} from "react-icons/bs"
import MainNavbar from "./components/MainNavbar.jsx"
import ChatPage from "./ChatPage.jsx"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const ACCENT_COLOR = "#EE4D2D";
const ACCENT_COLOR_2 = "#FF8A50"; // lighter for gradients

const ItemsPage = () => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState("")
  const [filteredItems, setFilteredItems] = useState([])
  const [sortOption, setSortOption] = useState("featured")
  const [viewMode, setViewMode] = useState("grid")
  const [currentPage, setCurrentPage] = useState(1)
  const [wishlist, setWishlist] = useState(new Set())
  const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 })
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [categories, setCategories] = useState([])
  const [showAllCategories, setShowAllCategories] = useState(false)
  const itemsPerPage = 12;

  const navigate = useNavigate()
  const token = localStorage.getItem("token")
  const userRole = localStorage.getItem("role")

  // Compute visible categories for the chip bar
  const maxVisibleChips = 10
  const visibleCategories = showAllCategories ? categories : categories.slice(0, maxVisibleChips)

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("userId")
    localStorage.removeItem("role")
    navigate("/")
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, categoriesRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/items`),
          axios.get(`${BACKEND_URL}/api/categories`),
        ])
        setItems(itemsRes.data.ItemData || [])
        setFilteredItems(itemsRes.data.ItemData || [])
        setCategories(categoriesRes.data.CategoryData || [])
      } catch (err) {
        setError("Error fetching items. Please try again later.")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    let filtered = items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
      const matchesPrice = item.price >= priceRange.min && item.price <= priceRange.max
      const matchesCategory =
        selectedCategory === "all" ||
        (item.category &&
          ((Array.isArray(item.category) && item.category.some((cat) => cat.name === selectedCategory)) ||
            (typeof item.category === "object" && item.category.name === selectedCategory) ||
            item.category === selectedCategory))

      return matchesSearch && matchesPrice && matchesCategory
    })

    if (sortOption === "customizable") {
      filtered = filtered.filter((item) => item.is_customizable)
    }

    // Apply sorting
    switch (sortOption) {
      case "price-low-high":
        filtered.sort((a, b) => a.price - b.price)
        break
      case "price-high-low":
        filtered.sort((a, b) => b.price - a.price)
        break
      case "newest":
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        break
      case "popular":
        filtered.sort((a, b) => (b.sold || 0) - (a.sold || 0))
        break
      case "rating":
        filtered.sort((a, b) => (b.rating || 4.5) - (a.rating || 4.5))
        break
      case "featured":
      case "customizable": // Now it filters, then sorts by the default
      default:
        // Prioritize bestsellers
        filtered.sort((a, b) => {
          if (a.is_bestseller && !b.is_bestseller) return -1
          if (!a.is_bestseller && b.is_bestseller) return 1
          return 0
        })
        break
    }

    setFilteredItems(filtered)
    setCurrentPage(1)
  }, [search, items, sortOption, priceRange, selectedCategory])

  const toggleWishlist = (itemId) => {
    const newWishlist = new Set(wishlist)
    if (newWishlist.has(itemId)) {
      newWishlist.delete(itemId)
    } else {
      newWishlist.add(itemId)
    }
    setWishlist(newWishlist)
  }

  const renderStars = (rating = 4.5) => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 !== 0

    for (let i = 0; i < fullStars; i++) {
      stars.push(<BsStarFill key={i} className="text-warning" />)
    }

    if (hasHalfStar) {
      stars.push(<BsStarFill key="half" className="text-warning" style={{ opacity: 0.5 }} />)
    }

    const remainingStars = 5 - Math.ceil(rating)
    for (let i = 0; i < remainingStars; i++) {
      stars.push(<BsStar key={`empty-${i}`} className="text-muted" />)
    }

    return stars
  }

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem)
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)

  const categoryIconMap = {
    Bathroom: "🛁",
    Bedroom: "🛏️",
    "Dining Room": "🍽️",
    "Home Office / Study": "💼",
    "Kids' Room": "🎈",
    Kitchen: "🍳",
    "Living Room": "🛋️",
    Outdoor: "🌿",
    Utility: "🧰",
  }

  const renderCategoryLabel = (name) => (
    <span className="d-inline-flex align-items-center gap-2">
      <span aria-hidden>{categoryIconMap[name] || "🏷️"}</span>
      <span>{name}</span>
    </span>
  )

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: "4rem", height: "4rem" }} />
          <p className="mt-3 text-muted">Loading our amazing products...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Container className="mt-5">
        <Alert variant="danger" className="text-center shadow-sm">
          <Alert.Heading>Oops! Something went wrong</Alert.Heading>
          <p>{error}</p>
          <Button variant="outline-danger" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </Alert>
      </Container>
    )
  }

  return (
    <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
      {/* Navigation Bar */}
      <MainNavbar enableSearch searchValue={search} onSearchChange={(e) => setSearch(e.target.value)} />

      {/* Hero Section */}
      <div
        style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(https://images.pexels.com/photos/32485141/pexels-photo-32485141/free-photo-of-cozy-indoor-workspace-with-vintage-lamp.jpeg?auto=compress&cs=tinysrgb&w=1200)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          height: "50vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          textAlign: "center",
        }}
        className="mb-5"
      >
        <Container>
          <h1 className="display-4 fw-bold mb-3">Perfect Furniture For Your Home!</h1>
          <p className="lead fs-5 mb-4">Discover our curated collection of premium furniture and home decor</p>
          <div className="d-flex justify-content-center gap-3">
            <Button variant="light" size="lg" as={Link} to="/recommendation">
              <BsRobot className="me-2" />
              Get AI Suggestions
            </Button>

          </div>
        </Container>
      </div>

      <Container className="my-5" id="products">
        {/* Page Header */}
        <div className="text-center mb-5">
          <h2 className="fw-bold text-dark mb-3">Our Premium Collection</h2>
          <div
            className="mx-auto"
            style={{
              height: "4px",
              width: "80px",
              backgroundColor: "#EE4D2D",
              borderRadius: "2px",
            }}
          ></div>
        </div>

        {/* Category Chip Bar (responsive wrap with More toggle) */}
        <div className="mb-4">
          <div className="d-flex align-items-center justify-content-between mb-2 px-2">
            <small className="text-muted d-flex align-items-center">
              <BsListUl className="me-2" /> Browse by category
            </small>
            {categories.length > 10 && (
              <Button
                size="sm"
                variant="link"
                className="text-decoration-none"
                style={{ color: ACCENT_COLOR }}
                onClick={() => setShowAllCategories((prev) => !prev)}
              >
                {showAllCategories ? "Show less" : "More"}
              </Button>
            )}
          </div>

          <div
            className="p-2"
            style={{
              background: "rgba(255,255,255,0.7)",
              borderRadius: 16,
              boxShadow: "0 .35rem 1rem rgba(0,0,0,0.06)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            <style>{`
              .category-chip {
                border-radius: 9999px;
                font-weight: 600;
                letter-spacing: .2px;
                padding: .45rem .9rem;
                transition: transform .18s ease, box-shadow .18s ease, background .18s ease, color .18s ease, border-color .18s ease;
              }
              .category-chip:hover {
                transform: translateY(-2px);
                box-shadow: 0 .5rem 1rem rgba(0,0,0,0.10);
              }
              .category-chip:focus-visible {
                outline: none;
                box-shadow: 0 0 0 .2rem rgba(238,77,45,0.25), 0 .5rem 1rem rgba(0,0,0,0.10);
              }
            `}</style>

            <div className="d-flex flex-wrap align-items-center gap-2">
              <Button
                key="all"
                size="sm"
                className="category-chip shadow-sm"
                variant="light"
                style={{
                  background: selectedCategory === "all" ? `linear-gradient(135deg, ${ACCENT_COLOR} 0%, ${ACCENT_COLOR_2} 100%)` : "rgba(238,77,45,0.06)",
                  color: selectedCategory === "all" ? "#ffffff" : "#1f2937",
                  borderColor: selectedCategory === "all" ? "transparent" : "rgba(0,0,0,0.06)",
                  boxShadow: selectedCategory === "all" ? "0 .5rem 1rem rgba(238,77,45,.35)" : "0 .25rem .5rem rgba(0,0,0,0.06)",
                }}
                onClick={() => setSelectedCategory("all")}
              >
                All
              </Button>

              {visibleCategories.map((cat) => {
                const isActive = selectedCategory === cat.name
                return (
                  <Button
                    key={cat._id || cat.name}
                    size="sm"
                    className="category-chip shadow-sm"
                    variant="light"
                    style={{
                      background: isActive ? `linear-gradient(135deg, ${ACCENT_COLOR} 0%, ${ACCENT_COLOR_2} 100%)` : "rgba(238,77,45,0.06)",
                      color: isActive ? "#ffffff" : "#1f2937",
                      borderColor: isActive ? "transparent" : "rgba(0,0,0,0.06)",
                      boxShadow: isActive ? "0 .5rem 1rem rgba(238,77,45,.35)" : "0 .25rem .5rem rgba(0,0,0,0.06)",
                    }}
                    onClick={() => setSelectedCategory(cat.name)}
                  >
                    {renderCategoryLabel(cat.name)}
                  </Button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Products Section */}
        <Row className="mb-4">
          <Col lg={12}>
            {/* Results Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h5 className="mb-1">
                  {filteredItems.length} Product{filteredItems.length !== 1 ? "s" : ""} Found
                </h5>
                <p className="text-muted mb-0 small">
                  {search && `Results for "${search}"`}
                  {selectedCategory !== "all" && ` in ${selectedCategory}`}
                </p>
              </div>
              <div className="d-flex align-items-center gap-3">
                {/* View Mode Toggle */}
                <div className="btn-group" role="group">
                  <Button
                    variant={viewMode === "grid" ? "primary" : "outline-secondary"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                  >
                    <BsGrid3X3Gap />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "primary" : "outline-secondary"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                  >
                    <BsList />
                  </Button>
                </div>

                {/* Sort Dropdown */}
                <Dropdown>
                  <Dropdown.Toggle variant="outline-secondary" size="sm">
                    <BsSortDown className="me-1" />
                    Sort
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={() => setSortOption("featured")}>Featured</Dropdown.Item>
                    <Dropdown.Item onClick={() => setSortOption("price-low-high")}>Price: Low to High</Dropdown.Item>
                    <Dropdown.Item onClick={() => setSortOption("price-high-low")}>Price: High to Low</Dropdown.Item>
                    <Dropdown.Item onClick={() => setSortOption("newest")}>Newest First</Dropdown.Item>
                    <Dropdown.Item onClick={() => setSortOption("popular")}>Most Popular</Dropdown.Item>
                    <Dropdown.Item onClick={() => setSortOption("rating")}>Highest Rated</Dropdown.Item>
                    <Dropdown.Item onClick={() => setSortOption("customizable")}>Customizable</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            </div>

            {/* Products Grid/List */}
            {filteredItems.length === 0 ? (
              <Alert variant="light" className="text-center p-5 shadow-sm border-0">
                <BsSearch size={48} className="text-muted mb-3" />
                <h4>No products found</h4>
                <p className="text-muted mb-3">
                  Try adjusting your search terms or filters to find what you're looking for.
                </p>
                <Button
                  variant="outline-primary"
                  onClick={() => {
                    setSearch("")
                    setSelectedCategory("all")
                    setPriceRange({ min: 0, max: 100000 })
                  }}
                >
                  Clear All Filters
                </Button>
              </Alert>
            ) : (
              <>
                <Row className={viewMode === "grid" ? "g-4" : "g-3"}>
                  {currentItems.map((item) => (
                    <Col
                      key={item._id}
                      xs={viewMode === "grid" ? 6 : 12}
                      md={viewMode === "grid" ? 5 : 12}
                      lg={viewMode === "grid" ? 4 : 12}
                      xl={viewMode === "grid" ? 3 : 12}
                    >
                      {viewMode === "grid" ? (
                        <Card className="h-100 border-0 shadow-sm product-card">
                          <div className="position-relative">
                            {item.is_bestseller && (
                              <Badge
                                bg="warning"
                                text="dark"
                                className="position-absolute top-0 start-0 m-2"
                                style={{ zIndex: 1 }}
                              >
                                <BsAward className="me-1" />
                                Bestseller
                              </Badge>
                            )}

                            <Link to={`/item/${item._id}`} className="text-decoration-none">
                              <div style={{ height: "250px", overflow: "hidden" }}>
                                <Card.Img
                                  variant="top"
                                  src={
                                    (item.imageUrl && item.imageUrl[0]) || "https://placehold.co/400x400?text=No+Image"
                                  }
                                  alt={item.name}
                                  style={{
                                    height: "100%",
                                    objectFit: "contain",
                                    transition: "transform 0.3s ease",
                                  }}
                                  onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                                  onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
                                />
                              </div>
                            </Link>
                          </div>
                          <Card.Body className="d-flex flex-column">
                            <Link to={`/item/${item._id}`} className="text-decoration-none text-dark">
                              <h6 className="card-title mb-2" style={{ height: "48px", overflow: "hidden" }}>
                                {item.name}
                              </h6>
                            </Link>
                            <div className="d-flex align-items-center mb-2">
                              <div className="me-2">{renderStars(item.rating || 4.5)}</div>
                              <small className="text-muted">({Array.isArray(item.reviews) ? item.reviews.length : (item.reviews || Math.floor(Math.random() * 100))})</small>
                            </div>
                            <div className="mt-auto">
                              <h5 className="text-primary fw-bold mb-2">₱{item.price.toFixed(2)}</h5>
                              <div className="d-flex justify-content-between align-items-center">
                                <small className="text-muted">
                                  <BsGeoAlt className="me-1" />
                                  Tanay, Rizal
                                </small>
                                <Badge bg="light" text="dark">
                                  {item.sales} sold
                                </Badge>
                              </div>
                            </div>
                          </Card.Body>
                        </Card>
                      ) : (
                        <Card className="border-0 shadow-sm">
                          <Row className="g-0">
                            <Col md={3}>
                              <div className="position-relative" style={{ height: "200px" }}>
                                {item.is_bestseller && (
                                  <Badge
                                    bg="warning"
                                    text="dark"
                                    className="position-absolute top-0 start-0 m-2"
                                    style={{ zIndex: 1 }}
                                  >
                                    <BsAward className="me-1" />
                                    Bestseller
                                  </Badge>
                                )}
                                <Link to={`/item/${item._id}`}>
                                  <Card.Img
                                    src={
                                      (item.imageUrl && item.imageUrl[0]) ||
                                      "https://placehold.co/400x400?text=No+Image"
                                    }
                                    alt={item.name}
                                    style={{ height: "100%", objectFit: "cover" }}
                                  />
                                </Link>
                              </div>
                            </Col>
                            <Col md={9}>
                              <Card.Body>
                                <div className="d-flex justify-content-between">
                                  <div className="flex-grow-1">
                                    <Link to={`/item/${item._id}`} className="text-decoration-none text-dark">
                                      <h5 className="card-title">{item.name}</h5>
                                    </Link>
                                    <div className="d-flex align-items-center mb-2">
                                      <div className="me-2">{renderStars(item.rating || 4.5)}</div>
                                      <small className="text-muted">
                                        ({Array.isArray(item.reviews) ? item.reviews.length : (item.reviews || Math.floor(Math.random() * 100))} reviews)
                                      </small>
                                    </div>
                                    <p className="text-muted mb-3">{item.description}</p>
                                    <div className="d-flex align-items-center gap-3">
                                      <h4 className="text-primary fw-bold mb-0">₱{item.price.toFixed(2)}</h4>
                                      <Badge bg="light" text="dark">
                                        {item.sold || Math.floor(Math.random() * 500)} sold
                                      </Badge>
                                      <small className="text-muted">
                                        <BsGeoAlt className="me-1" />
                                        Tanay, Rizal
                                      </small>
                                    </div>
                                  </div>
                                  <div className="d-flex flex-column gap-2">
                                    <Button
                                      variant="light"
                                      size="sm"
                                      className="rounded-circle"
                                      style={{ width: "40px", height: "40px" }}
                                      onClick={() => toggleWishlist(item._id)}
                                    >
                                      {wishlist.has(item._id) ? <BsHeartFill className="text-danger" /> : <BsHeart />}
                                    </Button>
                                    <Button variant="primary" size="sm" as={Link} to={`/item/${item._id}`}>
                                      View Details
                                    </Button>
                                  </div>
                                </div>
                              </Card.Body>
                            </Col>
                          </Row>
                        </Card>
                      )}
                    </Col>
                  ))}
                </Row>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="d-flex justify-content-center mt-5">
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
                )}
              </>
            )}
          </Col>
        </Row>
      </Container>

      {/* Trust Indicators */}
      <Container className="my-5">
        <Row className="text-center">
          <Col md={3} className="mb-4">
            <div className="p-4">
              <BsShield size={48} className="text-primary mb-3" />
              <h5 className="fw-bold">Secure Shopping</h5>
              <p className="text-muted">Your data is protected with us</p>
            </div>
          </Col>
          <Col md={3} className="mb-4">
            <div className="p-4">
              <BsTruck size={48} className="text-success mb-3" />
              <h5 className="fw-bold">Reliable Delivery</h5>
              <p className="text-muted">We Deliver at your Door Steps!</p>
            </div>
          </Col>
          <Col md={3} className="mb-4">
            <div className="p-4">
              <BsCheckCircle size={48} className="text-info mb-3" />
              <h5 className="fw-bold">Quality Assured</h5>
              <p className="text-muted">Premium furniture guaranteed</p>
            </div>
          </Col>
          <Col md={3} className="mb-4">
            <div className="p-4">
              <BsChatDots size={48} className="text-warning mb-3" />
              <h5 className="fw-bold">Customer Support</h5>
              <p className="text-muted">We're here to help with Any of your Concerns</p>
            </div>
          </Col>
        </Row>
      </Container>

      {/* Footer */}
      <footer className="bg-dark text-white py-5">
        <Container>
          <Row>
            <Col md={6}>
              <h5 className="fw-bold mb-3">
                <BsShop className="me-2" />
                Wawa Furniture
              </h5>
              <p className="text-muted">
                Your trusted partner for premium furniture and home decor. Creating beautiful spaces since 2020.
              </p>
            </Col>
            <Col md={6}>
              <Row>
                <Col md={6}>
                  <h6 className="fw-bold mb-3">Quick Links</h6>
                  <Nav className="flex-column">
                    <Nav.Link as={Link} to="/about" className="text-light p-0 mb-2">
                      About Us
                    </Nav.Link>
                    <Nav.Link as={Link} to="/contact" className="text-light p-0 mb-2">
                      Contact
                    </Nav.Link>
                    <Nav.Link as={Link} to="/privacy" className="text-light p-0 mb-2">
                      Privacy Policy
                    </Nav.Link>
                  </Nav>
                </Col>
                <Col md={6}>
                  <h6 className="fw-bold mb-3">Customer Service</h6>
                  <Nav className="flex-column">
                    <Nav.Link as={Link} to="/help" className="text-light p-0 mb-2">
                      Help Center
                    </Nav.Link>
                    <Nav.Link as={Link} to="/returns" className="text-light p-0 mb-2">
                      Returns
                    </Nav.Link>
                    <Nav.Link as={Link} to="/shipping" className="text-light p-0 mb-2">
                      Shipping Info
                    </Nav.Link>
                  </Nav>
                </Col>
              </Row>
            </Col>
          </Row>
          <hr className="my-4" />
          <div className="text-center">
            <p className="mb-0">&copy; {new Date().getFullYear()} Wawa Furniture. All Rights Reserved.</p>
          </div>
        </Container>
      </footer>

      {/* Chat Widget - Only for users */}
      {userRole === "user" && <ChatPage />}
    </div>
  )
}

export default ItemsPage
