import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Container,
    Row,
    Col,
    Card,
    Table,
    Button,
    Form,
    Badge,
    Alert,
    Spinner,
    InputGroup,
    Pagination,
    OverlayTrigger,
    Tooltip
} from 'react-bootstrap';
import {
    BsClock,
    BsPersonFill,
    BsBoxSeam,
    BsCart,
    BsCurrencyDollar,
    BsFilter,
    BsSearch,
    BsArrowClockwise,
    BsCalendar,
    BsExclamationCircle,
    BsCheckCircle,
    BsXCircle,
    BsFileText,
    BsDownload,
    BsEye
} from 'react-icons/bs';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const LogsView = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);

    // Filters
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        action: '',
        entityType: '',
        userId: '',
        searchTerm: ''
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const limit = 50;

    // Time range for stats
    const [statsTimeRange, setStatsTimeRange] = useState('24h');

    // Auto-refresh
    const [autoRefresh, setAutoRefresh] = useState(false);

    // Fetch logs
    const fetchLogs = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const queryParams = new URLSearchParams({
                page: currentPage,
                limit,
                ...filters
            });

            const response = await axios.get(
                `${BACKEND_URL}/api/logs?${queryParams}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setLogs(response.data.logs);
            setTotalLogs(response.data.total);
            setTotalPages(response.data.totalPages);
            setError(null);
        } catch (err) {
            console.error('Error fetching logs:', err);
            setError('Failed to fetch logs');
        } finally {
            setLoading(false);
        }
    }, [currentPage, filters]);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `${BACKEND_URL}/api/logs/stats?timeRange=${statsTimeRange}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setStats(response.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    }, [statsTimeRange]);

    useEffect(() => {
        fetchLogs();
        fetchStats();
    }, [fetchLogs, fetchStats]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(() => {
                fetchLogs();
                fetchStats();
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [autoRefresh, fetchLogs, fetchStats]);

    // Get action icon
    const getActionIcon = (action) => {
        if (action.includes('order')) return <BsCart className="text-primary" />;
        if (action.includes('payment')) return <BsCurrencyDollar className="text-success" />;
        if (action.includes('item')) return <BsBoxSeam className="text-info" />;
        if (action.includes('user')) return <BsPersonFill className="text-warning" />;
        if (action.includes('delivery')) return <BsCheckCircle className="text-success" />;
        return <BsFileText className="text-secondary" />;
    };

    // Get action color
    const getActionColor = (action) => {
        if (action.includes('created')) return 'success';
        if (action.includes('updated') || action.includes('changed')) return 'info';
        if (action.includes('deleted') || action.includes('cancelled')) return 'danger';
        if (action.includes('payment')) return 'success';
        if (action.includes('refund')) return 'warning';
        if (action.includes('activated')) return 'success';
        return 'secondary';
    };

    // Format log details
    const formatDetails = (details) => {
        if (!details || Object.keys(details).length === 0) return '-';

        return Object.entries(details)
            .filter(([key, value]) => value !== null && value !== undefined)
            .map(([key, value]) => (
                <div key={key} className="small">
                    <span className="text-muted">{key.replace(/_/g, ' ')}:</span>{' '}
                    <span className="fw-medium">{value.toString()}</span>
                </div>
            ));
    };

    // Handle filter change
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        setCurrentPage(1);
    };

    // Reset filters
    const resetFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            action: '',
            entityType: '',
            userId: '',
            searchTerm: ''
        });
        setCurrentPage(1);
    };

    // Export logs
    const exportLogs = () => {
        const csvContent = [
            ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details'],
            ...logs.map(log => [
                new Date(log.timestamp).toLocaleString(),
                log.userName,
                log.action,
                log.entityType,
                log.entityId || '-',
                JSON.stringify(log.details)
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (loading && logs.length === 0) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="mb-1">Activity Logs</h2>
                    <p className="text-muted mb-0">Monitor all system activities and user actions</p>
                </div>
                <div className="d-flex gap-2">
                    <Button
                        variant={autoRefresh ? "success" : "outline-secondary"}
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        <BsArrowClockwise className={autoRefresh ? "spin" : ""} />
                        {autoRefresh ? " Auto-refresh ON" : " Auto-refresh OFF"}
                    </Button>
                    <Button variant="outline-primary" size="sm" onClick={exportLogs}>
                        <BsDownload className="me-1" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <Row className="g-3 mb-4">
                    <Col lg={3} md={6}>
                        <Card className="border-0 shadow-sm">
                            <Card.Body>
                                <div className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h6 className="text-muted mb-1">Total Activities</h6>
                                        <h3 className="mb-0">{stats.totalLogs}</h3>
                                        <small className="text-muted">Last {statsTimeRange}</small>
                                    </div>
                                    <BsClock size={32} className="text-primary opacity-25" />
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                    {stats.stats.slice(0, 3).map((stat, index) => (
                        <Col lg={3} md={6} key={stat._id}>
                            <Card className="border-0 shadow-sm">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <h6 className="text-muted mb-1">
                                                {stat._id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                            </h6>
                                            <h3 className="mb-0">{stat.count}</h3>
                                            <small className="text-muted">
                                                {((stat.count / stats.totalLogs) * 100).toFixed(1)}%
                                            </small>
                                        </div>
                                        {getActionIcon(stat._id)}
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}

            {/* Filters */}
            <Card className="border-0 shadow-sm mb-4">
                <Card.Body>
                    <Row className="g-3">
                        <Col lg={3}>
                            <Form.Group>
                                <Form.Label className="small">Start Date</Form.Label>
                                <Form.Control
                                    type="datetime-local"
                                    name="startDate"
                                    value={filters.startDate}
                                    onChange={handleFilterChange}
                                    size="sm"
                                />
                            </Form.Group>
                        </Col>
                        <Col lg={3}>
                            <Form.Group>
                                <Form.Label className="small">End Date</Form.Label>
                                <Form.Control
                                    type="datetime-local"
                                    name="endDate"
                                    value={filters.endDate}
                                    onChange={handleFilterChange}
                                    size="sm"
                                />
                            </Form.Group>
                        </Col>
                        <Col lg={2}>
                            <Form.Group>
                                <Form.Label className="small">Action Type</Form.Label>
                                <Form.Select
                                    name="action"
                                    value={filters.action}
                                    onChange={handleFilterChange}
                                    size="sm"
                                >
                                    <option value="">All Actions</option>
                                    <option value="order_created">Order Created</option>
                                    <option value="order_status_changed">Status Changed</option>
                                    <option value="payment_received">Payment Received</option>
                                    <option value="item_created">Item Created</option>
                                    <option value="item_updated">Item Updated</option>
                                    <option value="item_deleted">Item Deleted</option>
                                    <option value="user_login">User Login</option>
                                    <option value="delivery_proof_uploaded">Delivery Proof</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col lg={2}>
                            <Form.Group>
                                <Form.Label className="small">Entity Type</Form.Label>
                                <Form.Select
                                    name="entityType"
                                    value={filters.entityType}
                                    onChange={handleFilterChange}
                                    size="sm"
                                >
                                    <option value="">All Types</option>
                                    <option value="order">Orders</option>
                                    <option value="payment">Payments</option>
                                    <option value="item">Items</option>
                                    <option value="user">Users</option>
                                    <option value="category">Categories</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col lg={2}>
                            <div className="d-flex gap-2 align-items-end h-100">
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={resetFilters}
                                    className="w-100"
                                >
                                    <BsXCircle className="me-1" />
                                    Reset
                                </Button>
                            </div>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Logs Table */}
            <Card className="border-0 shadow-sm">
                <Card.Body className="p-0">
                    {error ? (
                        <Alert variant="danger" className="m-3">
                            <BsExclamationCircle className="me-2" />
                            {error}
                        </Alert>
                    ) : (
                        <div className="table-responsive">
                            <Table hover className="mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="border-0">Time</th>
                                        <th className="border-0">User</th>
                                        <th className="border-0">Action</th>
                                        <th className="border-0">Entity</th>
                                        <th className="border-0">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="text-center py-4 text-muted">
                                                No logs found matching your criteria
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log) => (
                                            <tr key={log._id}>
                                                <td className="py-3">
                                                    <div className="small">
                                                        <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                                                        <div className="text-muted">
                                                            {new Date(log.timestamp).toLocaleTimeString()}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                    <div className="d-flex align-items-center">
                                                        <BsPersonFill className="me-2 text-muted" />
                                                        <div>
                                                            <div className="fw-medium">{log.userName}</div>
                                                            <Badge bg={log.userRole === 'admin' ? 'danger' : 'primary'} className="small">
                                                                {log.userRole}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                    <div className="d-flex align-items-center">
                                                        {getActionIcon(log.action)}
                                                        <Badge bg={getActionColor(log.action)} className="ms-2">
                                                            {log.action.replace(/_/g, ' ')}
                                                        </Badge>
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                    <div className="small">
                                                        <div className="text-muted">{log.entityType}</div>
                                                        {log.entityId && (
                                                            <div className="font-monospace">#{log.entityId.slice(-8)}</div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3">
                                                    <OverlayTrigger
                                                        placement="left"
                                                        overlay={
                                                            <Tooltip>
                                                                {formatDetails(log.details)}
                                                            </Tooltip>
                                                        }
                                                    >
                                                        <Button variant="outline-secondary" size="sm">
                                                            <BsEye /> View
                                                        </Button>
                                                    </OverlayTrigger>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>

                {/* Pagination */}
                {totalPages > 1 && (
                    <Card.Footer className="bg-white border-top-0">
                        <div className="d-flex justify-content-between align-items-center">
                            <small className="text-muted">
                                Showing {(currentPage - 1) * limit + 1} to{' '}
                                {Math.min(currentPage * limit, totalLogs)} of {totalLogs} logs
                            </small>
                            <Pagination size="sm" className="mb-0">
                                <Pagination.Prev
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(currentPage - 1)}
                                />
                                {[...Array(Math.min(5, totalPages))].map((_, index) => {
                                    const pageNum = currentPage <= 3 ? index + 1 : currentPage - 2 + index;
                                    if (pageNum <= totalPages) {
                                        return (
                                            <Pagination.Item
                                                key={pageNum}
                                                active={pageNum === currentPage}
                                                onClick={() => setCurrentPage(pageNum)}
                                            >
                                                {pageNum}
                                            </Pagination.Item>
                                        );
                                    }
                                    return null;
                                })}
                                <Pagination.Next
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                />
                            </Pagination>
                        </div>
                    </Card.Footer>
                )}
            </Card>

            <style jsx>{`
                .spin {
                    animation: spin 2s linear infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default LogsView; 