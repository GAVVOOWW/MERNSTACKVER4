"use client"

import React, { useState, useEffect, useMemo } from "react"
import axios from "axios"
import { useNavigate, Link } from "react-router-dom"
import {
    Container,
    Row,
    Col,
    Card,
    Button,
    Form,
    InputGroup,
    Navbar,
    Nav,
    Alert,
    Spinner,
    Badge,
    Dropdown,
    Collapse,
    Pagination,
    Toast,
    ToastContainer,
} from "react-bootstrap"
import MainNavbar from "./components/MainNavbar.jsx"
import {
    BsSearch,
    BsFilter,
    BsHeart,
    BsHeartFill,
    BsStarFill,
    BsStar,
    BsShop,
    BsCart,
    BsRobot,
    BsListUl,
    BsChatDots,
    BsBoxArrowRight,
    BsSortDown,
    BsGrid3X3Gap,
    BsList,
    BsGeoAlt,
    BsAward,
    BsCheckCircle,
    BsHouse,
    BsGift,
    BsLightbulb,
    BsStars,
    BsPercent,
    BsSliders,
    BsClipboardCheck,
} from "react-icons/bs"

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const RecommendationPage = () => {
    // State for data
    const [initialItems, setInitialItems] = useState([]) // Holds the initial "recommended" items
    const [searchResults, setSearchResults] = useState(null) // Holds results from an AI search, null if no search is active

    // State for UI and controls
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [sortOption, setSortOption] = useState("featured")
    const [viewMode, setViewMode] = useState("grid")
    const [currentPage, setCurrentPage] = useState(1)
    const [wishlist, setWishlist] = useState(new Set())
    const [showFilters, setShowFilters] = useState(false)
    const [showToast, setShowToast] = useState(false)
    const [toastMessage, setToastMessage] = useState("")

    // State for new AI Semantic Search feature
    const [searchQuery, setSearchQuery] = useState("") // The text in the search box
    // Removed limit state - AI will control this

    const [filters, setFilters] = useState({
        category: "All",
        furnitureType: "All",
        priceRange: [0, 99999],
        showBestsellers: false,
        showInStock: false,
        showPackages: false,
    })

    const navigate = useNavigate()
    const userRole = localStorage.getItem("role")
    const itemsPerPage = 12



    // In your RecommendationPage.js file

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            setSearchResults(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await axios.post(`${BACKEND_URL}/api/items/semantic-search`, {
                query: searchQuery,
                // Removed limit - AI will determine optimal number of results
            });
            setSearchResults(response.data.ItemData);
        } catch (e) {
            setError('Failed to fetch search results.');
            console.error("Search API error:", e);
        } finally {
            setLoading(false);
        }
    };

    // Fetches the initial recommendations on page load
    useEffect(() => {
        const fetchInitialRecommendations = async () => {
            try {
                setLoading(true)
                const res = await axios.get(`${BACKEND_URL}/api/items`)
                const itemData = res.data.ItemData || res.data || []
                const processedItems = Array.isArray(itemData) ? itemData : []
                const recommendedItems = processedItems.sort((a, b) => {
                    if (a.is_bestseller && !b.is_bestseller) return -1
                    if (!a.is_bestseller && b.is_bestseller) return 1
                    return (b.rating || 4.5) - (a.rating || 4.5)
                })
                setInitialItems(recommendedItems)
            } catch (err) {
                setError("Failed to load initial recommendations")
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        fetchInitialRecommendations()
    }, [])

    // Helper functions
    const extractCategory = (cat) => (cat && typeof cat === "object" ? cat.name || "" : cat)
    const extractFurnitureType = (type) => (type && typeof type === "object" ? type.name || "" : type)

    // This derived value will be the single source of truth for what to display.
    // It applies client-side filters and sorting to the correct item list (either search results or initial items).
    const filteredAndSortedItems = useMemo(() => {
        let itemsToProcess = searchResults !== null ? searchResults : initialItems

        // Apply client-side filters
        if (filters.category !== "All") {
            itemsToProcess = itemsToProcess.filter((item) => {
                const cats = Array.isArray(item.category) ? item.category : [item.category]
                return cats.some((c) => extractCategory(c) === filters.category)
            })
        }
        if (filters.furnitureType !== "All") {
            itemsToProcess = itemsToProcess.filter((item) => {
                const types = Array.isArray(item.furnituretype) ? item.furnituretype : [item.furnituretype]
                return types.some((t) => extractFurnitureType(t) === filters.furnitureType)
            })
        }
        itemsToProcess = itemsToProcess.filter((item) => item.price >= filters.priceRange[0] && item.price <= filters.priceRange[1])
        if (filters.showBestsellers) {
            itemsToProcess = itemsToProcess.filter((item) => item.is_bestseller)
        }
        if (filters.showInStock) {
            itemsToProcess = itemsToProcess.filter((item) => item.stock > 0)
        }
        if (filters.showPackages) {
            itemsToProcess = itemsToProcess.filter((item) => item.isPackage)
        }

        // Apply sorting
        const sortedItems = [...itemsToProcess]
        switch (sortOption) {
            case "price-low-high":
                sortedItems.sort((a, b) => a.price - b.price)
                break
            case "price-high-low":
                sortedItems.sort((a, b) => b.price - a.price)
                break
            case "name-a-z":
                sortedItems.sort((a, b) => a.name.localeCompare(b.name))
                break
            case "name-z-a":
                sortedItems.sort((a, b) => b.name.localeCompare(a.name))
                break
            case "rating":
                sortedItems.sort((a, b) => (b.rating || 4.5) - (a.rating || 4.5))
                break
            case "featured":
            default:
                // For 'featured', we don't re-sort the results from the AI search
                break
        }
        return sortedItems
    }, [searchResults, initialItems, filters, sortOption])


    // Build unique option lists for filter dropdowns from the initial full list
    const categoryOptions = useMemo(() => [...new Set(initialItems.flatMap(it => Array.isArray(it.category) ? it.category.map(extractCategory) : [extractCategory(it.category)]).filter(Boolean))], [initialItems])
    const typeOptions = useMemo(() => [...new Set(initialItems.flatMap(it => Array.isArray(it.furnituretype) ? it.furnituretype.map(extractFurnitureType) : [extractFurnitureType(it.furnituretype)]).filter(Boolean))], [initialItems])

    const toggleWishlist = (itemId) => {
        const newWishlist = new Set(wishlist)
        if (newWishlist.has(itemId)) {
            newWishlist.delete(itemId)
            setToastMessage("Removed from wishlist")
        } else {
            newWishlist.add(itemId)
            setToastMessage("Added to wishlist")
        }
        setWishlist(newWishlist)
        setShowToast(true)
    }

    const renderStars = (rating = 4.5) => {
        const stars = []
        for (let i = 0; i < 5; i++) {
            stars.push(<BsStarFill key={i} className={i < rating ? "text-warning" : "text-muted"} />)
        }
        return stars
    }

    const calculateAverageRating = (reviews) => {
        if (!reviews || reviews.length === 0) return 4.5;
        const totalStars = reviews.reduce((sum, review) => sum + review.star, 0);
        return totalStars / reviews.length;
    }

    // Pagination logic now uses the final derived list
    const indexOfLastItem = currentPage * itemsPerPage
    const indexOfFirstItem = indexOfLastItem - itemsPerPage
    const currentItems = filteredAndSortedItems.slice(indexOfFirstItem, indexOfLastItem)
    const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage)

    // Main loading and error states
    if (loading && initialItems.length === 0) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
                <div className="text-center">
                    <Spinner animation="border" variant="primary" style={{ width: "4rem", height: "4rem" }} />
                    <p className="mt-3 text-muted">AI is preparing your experience...</p>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <Container className="mt-5">
                <Alert variant="danger" className="text-center shadow-sm">
                    <Alert.Heading>
                        <BsRobot className="me-2" /> An Error Occurred
                    </Alert.Heading>
                    <p>{error}</p>
                    <Button variant="outline-danger" onClick={() => window.location.reload()}>Try Again</Button>
                </Alert>
            </Container>
        )
    }

    return (
        <div style={{ backgroundColor: "#f8f9fa", minHeight: "100vh" }}>
            <ToastContainer position="top-end" className="p-3" style={{ zIndex: 1050 }}>
                <Toast onClose={() => setShowToast(false)} show={showToast} delay={3000} autohide>
                    <Toast.Header closeButton={true}>
                        <BsCheckCircle className="text-success me-2" />
                        <strong className="me-auto">Success</strong>
                    </Toast.Header>
                    <Toast.Body>{toastMessage}</Toast.Body>
                </Toast>
            </ToastContainer>

            <MainNavbar />

            <div style={{ backgroundImage: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`, color: "white", padding: "4rem 0", textAlign: "center", }} className="mb-5">
                <Container>
                   
                    <h1 className="display-4 fw-bold mb-3"><BsRobot size={64} className="mb-3" /> AI-Powered Assistant</h1>
                    <p className="lead fs-5 mb-4">Ask for furniture in your own words and let our AI find the perfect match for you.</p>
                    <div className="d-flex justify-content-center gap-3">
                    <Form className="flex-grow-1 mx-4" style={{ maxWidth: "800px", maxHeight: "100px" }} onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
                            <InputGroup>
                                <Form.Control
                                    type="search"
                                    placeholder="Ask our AI... (e.g., 'a wooden table for my office')"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <Button variant="primary" onClick={handleSearch} disabled={loading}>
                                    {loading && searchResults !== null ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : <BsSearch />}
                                </Button>
                            </InputGroup>
                        </Form>
                    </div>
                </Container>
            </div>

            <Container className="my-5">
               

                <div className="text-center mb-5">
                    <h2 className="fw-bold text-dark mb-3">
                        <BsRobot className="me-2 text-primary" />
                        {searchResults !== null ? "AI Search Results" : "Featured Recommendations"}
                    </h2>
                    <div className="mx-auto" style={{ height: "4px", width: "80px", backgroundColor: "#EE4D2D", borderRadius: "2px" }}></div>
                </div>

                <Row className="mb-4">
                    <Col>
                        <Card className="border-0 shadow-sm mb-4">
                            
                            <Collapse in={showFilters}>
                                <Card.Body>
                                    <Row className="align-items-center">
                                        <Col md={3} className="mb-3">
                                            <Form.Label className="fw-medium">Category</Form.Label>
                                            <Form.Select size="sm" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
                                                <option value="All">All Categories</option>
                                                {categoryOptions.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                                            </Form.Select>
                                        </Col>
                                        <Col md={3} className="mb-3">
                                            <Form.Label className="fw-medium">Furniture Type</Form.Label>
                                            <Form.Select size="sm" value={filters.furnitureType} onChange={(e) => setFilters({ ...filters, furnitureType: e.target.value })}>
                                                <option value="All">All Types</option>
                                                {typeOptions.map((type) => (<option key={type} value={type}>{type}</option>))}
                                            </Form.Select>
                                        </Col>
                                        <Col md={3} className="mb-3">
                                            <Form.Label className="fw-medium">Price Range</Form.Label>
                                            <InputGroup size="sm">
                                                <Form.Control type="number" placeholder="Min" value={filters.priceRange[0]} onChange={(e) => setFilters({ ...filters, priceRange: [Number(e.target.value), filters.priceRange[1]] })} />
                                                <Form.Control type="number" placeholder="Max" value={filters.priceRange[1]} onChange={(e) => setFilters({ ...filters, priceRange: [filters.priceRange[0], Number(e.target.value)] })} />
                                            </InputGroup>
                                        </Col>
                                        <Col md={3} className="mb-3">
                                            <Form.Label className="fw-medium">Quick Filters</Form.Label>
                                            <div className="d-flex flex-column gap-1">
                                                <Form.Check type="checkbox" label="Bestsellers Only" checked={filters.showBestsellers} onChange={(e) => setFilters({ ...filters, showBestsellers: e.target.checked })} className="small" />
                                                <Form.Check type="checkbox" label="In Stock Only" checked={filters.showInStock} onChange={(e) => setFilters({ ...filters, showInStock: e.target.checked })} className="small" />
                                                <Form.Check type="checkbox" label="Package Deals" checked={filters.showPackages} onChange={(e) => setFilters({ ...filters, showPackages: e.target.checked })} className="small" />
                                            </div>
                                        </Col>
                                    </Row>
                                </Card.Body>
                            </Collapse>
                        </Card>

                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <div>
                                <h5 className="mb-1">{filteredAndSortedItems.length} Item{filteredAndSortedItems.length !== 1 ? "s" : ""} Found</h5>
                                <p className="text-muted mb-0 small">
                                    {searchQuery && searchResults !== null ? (
                                        <>
                                            <BsRobot className="me-1" />
                                            AI selected {filteredAndSortedItems.length} results for "{searchQuery}"
                                        </>
                                    ) : (
                                        "Featured recommendations"
                                    )}
                                </p>
                            </div>
                            <div className="d-flex align-items-center gap-3">
                                <div className="btn-group" role="group">
                                    <Button variant={viewMode === "grid" ? "primary" : "outline-secondary"} size="sm" onClick={() => setViewMode("grid")}><BsGrid3X3Gap /></Button>
                                    <Button variant={viewMode === "list" ? "primary" : "outline-secondary"} size="sm" onClick={() => setViewMode("list")}><BsList /></Button>
                                </div>
                                <Dropdown>
                                    <Dropdown.Toggle variant="outline-secondary" size="sm"><BsSortDown className="me-1" />Sort</Dropdown.Toggle>
                                    <Dropdown.Menu>
                                        <Dropdown.Item onClick={() => setSortOption("featured")}>AI Featured</Dropdown.Item>
                                        <Dropdown.Item onClick={() => setSortOption("rating")}>Highest Rated</Dropdown.Item>
                                        <Dropdown.Item onClick={() => setSortOption("price-low-high")}>Price: Low to High</Dropdown.Item>
                                        <Dropdown.Item onClick={() => setSortOption("price-high-low")}>Price: High to Low</Dropdown.Item>
                                        <Dropdown.Item onClick={() => setSortOption("name-a-z")}>Name: A to Z</Dropdown.Item>
                                        <Dropdown.Item onClick={() => setSortOption("name-z-a")}>Name: Z to A</Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                            </div>
                        </div>

                        {filteredAndSortedItems.length === 0 ? (
                            <Alert variant="light" className="text-center p-5 shadow-sm border-0">
                                <BsRobot size={48} className="text-muted mb-3" />
                                <h4>No Matching Items Found</h4>
                                <p className="text-muted mb-3">Try adjusting your filters or search terms.</p>
                                <Button variant="outline-primary" onClick={() => { setSearchQuery(""); setSearchResults(null); setFilters({ category: "All", furnitureType: "All", priceRange: [0, 99999], showBestsellers: false, showInStock: false, showPackages: false }); }}>Reset Search & Filters</Button>
                            </Alert>
                        ) : (
                            <>
                                <Row className={viewMode === "grid" ? "g-4" : "g-3"}>
                                    {currentItems.map((item, index) => (
                                        <Col key={item._id} xs={viewMode === "grid" ? 6 : 12} md={viewMode === "grid" ? 4 : 12} lg={viewMode === "grid" ? 4 : 12} xl={viewMode === "grid" ? 3 : 12}>
                                            {viewMode === "grid" ? (
                                                <Card className="h-100 border-0 shadow-sm product-card position-relative">
                                                    <div className="position-relative">
                                                        
                                                        <Link to={`/item/${item._id}`} className="text-decoration-none">
                                                            <div style={{ height: "250px", overflow: "hidden" }}>
                                                                <Card.Img variant="top" src={(item.imageUrl && item.imageUrl[0]) || "https://placehold.co/400x400?text=No+Image"} alt={item.name} style={{ height: "100%", objectFit: "contain", transition: "transform 0.3s ease" }} onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")} onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")} />
                                                            </div>
                                                        </Link>
                                                    </div>
                                                    <Card.Body className="d-flex flex-column">
                                                        <Link to={`/item/${item._id}`} className="text-decoration-none text-dark">
                                                            <h6 className="card-title mb-2" style={{ height: "48px", overflow: "hidden" }}>{item.name}</h6>
                                                        </Link>
                                                        <div className="d-flex align-items-center mb-2">
                                                            <div className="me-2">{renderStars(calculateAverageRating(item.reviews))}</div>
                                                            <small className="text-muted">({item.reviews ? item.reviews.length : 0})</small>
                                                        </div>
                                                        <div className="mt-auto">
                                                            <h5 className="text-primary fw-bold mb-2">₱{item.price.toFixed(2)}</h5>
                                                            {item.aiExplanation && searchResults !== null && (
                                                                <div className="mb-2 p-2 bg-light rounded" style={{ fontSize: "0.8rem" }}>
                                                                    <BsRobot className="text-primary me-1" size={12} />
                                                                    <span className="text-muted">{item.aiExplanation}</span>
                                                                </div>
                                                            )}
                                                            <div className="d-flex justify-content-between align-items-center">
                                                                <small className="text-muted"><BsGeoAlt className="me-1" />Tanay, Rizal</small>
                                                                <Badge bg="light" text="dark">{item.sales || Math.floor(Math.random() * 500)} sold</Badge>
                                                            </div>
                                                        </div>
                                                    </Card.Body>
                                                </Card>
                                            ) : (
                                                <Card className="border-0 shadow-sm">
                                                    <Row className="g-0">
                                                        <Col md={3}>
                                                            <div className="position-relative" style={{ height: "200px" }}>
                                                                <Link to={`/item/${item._id}`}>
                                                                    <Card.Img src={(item.imageUrl && item.imageUrl[0]) || "https://placehold.co/400x400?text=No+Image"} alt={item.name} style={{ height: "100%", objectFit: "contain" }} />
                                                                </Link>
                                                            </div>
                                                        </Col>
                                                        <Col md={9}>
                                                            <Card.Body>
                                                                <div className="d-flex justify-content-between">
                                                                    <div className="flex-grow-1">
                                                                        <Link to={`/item/${item._id}`} className="text-decoration-none text-dark"><h5 className="card-title">{item.name}</h5></Link>
                                                                        <div className="d-flex align-items-center mb-2">
                                                                            <div className="me-2">{renderStars(calculateAverageRating(item.reviews))}</div>
                                                                            <small className="text-muted">({item.reviews ? item.reviews.length : 0} reviews)</small>
                                                                        </div>
                                                                        <p className="text-muted mb-3">{item.description}</p>
                                                                        {item.aiExplanation && searchResults !== null && (
                                                                            <div className="mb-3 p-2 bg-light rounded">
                                                                                <BsRobot className="text-primary me-1" />
                                                                                <span className="text-muted small">{item.aiExplanation}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="d-flex align-items-center gap-3">
                                                                            <h4 className="text-primary fw-bold mb-0">₱{item.price.toFixed(2)}</h4>
                                                                            <Badge bg="light" text="dark">{item.sold || Math.floor(Math.random() * 500)} sold</Badge>
                                                                            <small className="text-muted"><BsGeoAlt className="me-1" />Tanay, Rizal</small>
                                                                        </div>
                                                                    </div>
                                                                    <div className="d-flex flex-column gap-2">
                                                                        <Button variant="light" size="sm" className="rounded-circle" style={{ width: "40px", height: "40px" }} onClick={() => toggleWishlist(item._id)}>
                                                                            {wishlist.has(item._id) ? <BsHeartFill className="text-danger" /> : <BsHeart />}
                                                                        </Button>
                                                                        <Button variant="primary" size="sm" as={Link} to={`/item/${item._id}`}>View Details</Button>
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

                                {totalPages > 1 && (
                                    <div className="d-flex justify-content-center mt-5">
                                        <Pagination>
                                            <Pagination.Prev disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} />
                                            {[...Array(totalPages)].map((_, index) => (
                                                <Pagination.Item key={index + 1} active={index + 1 === currentPage} onClick={() => setCurrentPage(index + 1)}>
                                                    {index + 1}
                                                </Pagination.Item>
                                            ))}
                                            <Pagination.Next disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} />
                                        </Pagination>
                                    </div>
                                )}
                            </>
                        )}
                    </Col>
                </Row>
            </Container>

            <footer className="bg-dark text-white py-5">
                <Container>
                    <Row>
                        <Col md={6}>
                            <h5 className="fw-bold mb-3"><BsShop className="me-2" /> Wawa Furniture</h5>
                            <p className="text-muted">Your trusted partner for premium furniture and home decor. Creating beautiful spaces with AI-powered recommendations since 2020.</p>
                        </Col>
                        <Col md={6}>
                            <Row>
                                <Col md={6}>
                                    <h6 className="fw-bold mb-3">Quick Links</h6>
                                    <Nav className="flex-column">
                                        <Nav.Link as={Link} to="/about" className="text-light p-0 mb-2">About Us</Nav.Link>
                                        <Nav.Link as={Link} to="/contact" className="text-light p-0 mb-2">Contact</Nav.Link>
                                        <Nav.Link as={Link} to="/privacy" className="text-light p-0 mb-2">Privacy Policy</Nav.Link>
                                    </Nav>
                                </Col>
                                <Col md={6}>
                                    <h6 className="fw-bold mb-3">AI Features</h6>
                                    <Nav className="flex-column">
                                        <Nav.Link as={Link} to="/how-it-works" className="text-light p-0 mb-2">How AI Works</Nav.Link>
                                        <Nav.Link as={Link} to="/personalization" className="text-light p-0 mb-2">Personalization</Nav.Link>
                                        <Nav.Link as={Link} to="/feedback" className="text-light p-0 mb-2">Improve AI</Nav.Link>
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
        </div>
    )
}

export default RecommendationPage