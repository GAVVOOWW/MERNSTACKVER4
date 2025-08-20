import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ComposedChart,
    Area
} from 'recharts';
import { Tabs, Tab, Card, Table, Spinner, Alert, Container, Row, Col, Badge } from 'react-bootstrap';
import { FaChartLine, FaDollarSign, FaShoppingCart, FaBoxes } from 'react-icons/fa';
import { saveAs } from 'file-saver';

const AnalyticsView = () => {
    const [period, setPeriod] = useState('daily');
    const [analyticsData, setAnalyticsData] = useState([]);
    const [itemSalesData, setItemSalesData] = useState([]);
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [customOrders, setCustomOrders] = useState([]);
    const [customOrdersLoading, setCustomOrdersLoading] = useState(false);
    const [customOrdersError, setCustomOrdersError] = useState(null);

    // Colors for charts
    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d0'];

    // Fetch analytics data
    const fetchAnalytics = async (selectedPeriod) => {
        try {
            setLoading(true);
            setError(null);

            // Validate period parameter
            if (!selectedPeriod) {
                throw new Error('Period parameter is required');
            }

            const validPeriods = ['hourly', 'daily', 'weekly', 'monthly'];
            if (!validPeriods.includes(selectedPeriod)) {
                throw new Error(`Invalid period: ${selectedPeriod}. Must be one of: ${validPeriods.join(', ')}`);
            }

            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Fetch both detailed analytics and summary
            const [analyticsResponse, summaryResponse] = await Promise.all([
                axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/analytics/${selectedPeriod}`, { headers }),
                axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/analytics/summary`, { headers })
            ]);

            setAnalyticsData(analyticsResponse.data.analytics || []);
            setItemSalesData(analyticsResponse.data.itemSales || []);
            setSummaryData(summaryResponse.data.summary);

        } catch (err) {
            console.error('Error fetching analytics:', err);
            setError(err.response?.data?.message || 'Failed to fetch analytics data');
        } finally {
            setLoading(false);
        }
    };

    // Fetch custom orders
    const fetchCustomOrders = async () => {
        try {
            setCustomOrdersLoading(true);
            setCustomOrdersError(null);
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/analytics/custom-orders`, { headers });
            setCustomOrders(response.data.customOrders || []);
        } catch (err) {
            setCustomOrdersError(err.response?.data?.message || 'Failed to fetch custom orders');
        } finally {
            setCustomOrdersLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics(period);
        fetchCustomOrders();
    }, [period]);

    // Format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP'
        }).format(value);
    };

    // Format number
    const formatNumber = (value) => {
        return new Intl.NumberFormat('en-US').format(value);
    };

    // Custom tooltip for charts
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border rounded shadow-sm">
                    <p className="font-weight-bold">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color }}>
                            {entry.name}: {formatCurrency(entry.value)}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    // Summary cards component
    const SummaryCards = () => {
        if (!summaryData) return null;

        const summaryPeriods = [
            { key: 'today', label: 'Today', color: 'primary' },
            { key: 'week', label: 'This Week', color: 'success' },
            { key: 'month', label: 'This Month', color: 'warning' },
            { key: 'allTime', label: 'All Time', color: 'info' }
        ];

        return (
            <Row className="mb-4">
                {summaryPeriods.map(({ key, label, color }) => (
                    <Col lg={3} md={6} className="mb-3" key={key}>
                        <Card className={`h-100 border-${color}`}>
                            <Card.Body>
                                <h6 className="text-muted mb-2">{label}</h6>
                                <h3 className={`text-${color} mb-2`}>
                                    {formatCurrency(summaryData[key].revenue)}
                                </h3>
                                <small className="text-muted">
                                    {summaryData[key].orderCount} orders •
                                    Avg: {formatCurrency(summaryData[key].averageOrderValue)}
                                </small>
                                <div className="mt-2">
                                    <Badge bg="success" className="me-2">
                                        Profit: {formatCurrency(summaryData[key].totalProfit)}
                                    </Badge>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>
        );
    };

    // Revenue and Average Order Chart
    const RevenueChart = () => (
        <Card className="mb-4">
            <Card.Header className="bg-primary text-white">
                <FaChartLine className="me-2" />
                Revenue & Average Order Amount
            </Card.Header>
            <Card.Body>
                <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={analyticsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="revenue" fill="#8884d8" name="Revenue" />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="averageOrderAmount"
                            stroke="#ff7300"
                            strokeWidth={3}
                            name="Avg Order Amount"
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </Card.Body>
        </Card>
    );

    // Profit Breakdown Chart
    const ProfitChart = () => (
        <Card className="mb-4 h-100">
            <Card.Header className="bg-success text-white">
                <FaDollarSign className="me-2" />
                Profit Breakdown (Customized vs Normal)
            </Card.Header>
            <Card.Body className="d-flex flex-column">
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={analyticsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="customizedProfit" stackId="a" fill="#82ca9d" name="Customized Items Profit" />
                        <Bar dataKey="normalProfit" stackId="a" fill="#ffc658" name="Normal Items Profit" />
                    </BarChart>
                </ResponsiveContainer>
            </Card.Body>
        </Card>
    );

    // Total Profit Trend Chart
    const ProfitTrendChart = () => (
        <Card className="mb-4 h-100">
            <Card.Header className="bg-warning text-dark">
                <FaChartLine className="me-2" />
                Total Profit Trend
            </Card.Header>
            <Card.Body className="d-flex flex-column">
                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={analyticsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="totalProfit"
                            stroke="#8884d8"
                            strokeWidth={3}
                            name="Total Profit"
                            dot={{ fill: '#8884d8', r: 6 }}
                            activeDot={{ r: 8 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </Card.Body>
        </Card>
    );

    // Utility: Convert array of objects to CSV string
    const arrayToCSV = (data, columns) => {
        const header = columns.map(col => col.label).join(',');
        const rows = data.map(row => columns.map(col => {
            let val = row[col.key];
            if (typeof val === 'string') {
                val = '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
        }).join(','));
        return [header, ...rows].join('\r\n');
    };

    // Download Item Sales as CSV
    const handleDownloadItemSalesCSV = () => {
        if (!itemSalesData.length) return;
        const columns = [
            { key: 'name', label: 'Item Name' },
            { key: 'costPrice', label: 'Cost Price' },
            { key: 'sellingPrice', label: 'Selling Price' },
            { key: 'totalSold', label: 'Units Sold' },
            { key: 'totalRevenue', label: 'Revenue' },
            { key: 'totalProfit', label: 'Profit' },
            { key: 'margin', label: 'Margin %' },
        ];
        const data = itemSalesData.map(item => ({
            ...item,
            margin: item.totalRevenue > 0 ? ((item.totalProfit / item.totalRevenue) * 100).toFixed(1) : 0
        }));
        const csv = arrayToCSV(data, columns);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'item_sales.csv');
    };

    // Download Custom Orders as CSV
    const handleDownloadCustomOrdersCSV = () => {
        if (!customOrders.length) return;
        const columns = [
            { key: 'orderId', label: 'Order ID' },
            { key: 'customer', label: 'Customer' },
            { key: 'itemName', label: 'Item' },
            { key: 'date', label: 'Date' },
            { key: 'customPrice', label: 'Custom Price' },
            { key: 'margin', label: 'Margin' },
            { key: 'cost', label: 'Cost' },
            { key: 'profit', label: 'Profit' },
        ];
        const data = customOrders.map(order => ({
            ...order,
            date: new Date(order.date).toLocaleString(),
            margin: (order.margin * 100).toFixed(1) + '%',
        }));
        const csv = arrayToCSV(data, columns);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'custom_orders.csv');
    };

    // Item Sales Table
    const ItemSalesTable = () => (
        <Card className="mb-4">
            <Card.Header className="bg-info text-white d-flex justify-content-between align-items-center">
                <span><FaBoxes className="me-2" />Item Sales Performance</span>
                <button className="btn btn-light btn-sm" onClick={handleDownloadItemSalesCSV} disabled={!itemSalesData.length}>
                    Download CSV
                </button>
            </Card.Header>
            <Card.Body>
                <div className="table-responsive">
                    <Table striped bordered hover>
                        <thead>
                            <tr>
                                <th>Item Name</th>
                                <th className="text-end">Cost Price</th>
                                <th className="text-end">Selling Price</th>
                                <th className="text-center">Units Sold</th>
                                <th className="text-end">Revenue</th>
                                <th className="text-end">Profit</th>
                                <th className="text-center">Margin %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {itemSalesData.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center text-muted">
                                        No sales data available for this period
                                    </td>
                                </tr>
                            ) : (
                                itemSalesData.map((item, index) => {
                                    const margin = item.totalRevenue > 0
                                        ? ((item.totalProfit / item.totalRevenue) * 100).toFixed(1)
                                        : 0;

                                    return (
                                        <tr key={item.itemId}>
                                            <td>{item.name}</td>
                                            <td className="text-end">{formatCurrency(item.costPrice)}</td>
                                            <td className="text-end">{formatCurrency(item.sellingPrice)}</td>
                                            <td className="text-center">
                                                <Badge bg="primary">{item.totalSold}</Badge>
                                            </td>
                                            <td className="text-end">{formatCurrency(item.totalRevenue)}</td>
                                            <td className="text-end">
                                                <span className={item.totalProfit >= 0 ? 'text-success' : 'text-danger'}>
                                                    {formatCurrency(item.totalProfit)}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                <Badge bg={margin >= 30 ? 'success' : margin >= 20 ? 'warning' : 'danger'}>
                                                    {margin}%
                                                </Badge>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {itemSalesData.length > 0 && (
                            <tfoot>
                                <tr className="fw-bold">
                                    <td colSpan="3">Total</td>
                                    <td className="text-center">
                                        <Badge bg="dark">
                                            {itemSalesData.reduce((sum, item) => sum + item.totalSold, 0)}
                                        </Badge>
                                    </td>
                                    <td className="text-end">
                                        {formatCurrency(itemSalesData.reduce((sum, item) => sum + item.totalRevenue, 0))}
                                    </td>
                                    <td className="text-end text-success">
                                        {formatCurrency(itemSalesData.reduce((sum, item) => sum + item.totalProfit, 0))}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );

    // Top 5 Profitable Items Pie Chart
    const TopItemsChart = () => {
        const topItems = itemSalesData.slice(0, 5);

        if (topItems.length === 0) return null;

        return (
            <Card className="mb-4">
                <Card.Header className="bg-secondary text-white">
                    <FaShoppingCart className="me-2" />
                    Top 5 Most Profitable Items
                </Card.Header>
                <Card.Body>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={topItems}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="totalProfit"
                            >
                                {topItems.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => formatCurrency(value)} />
                        </PieChart>
                    </ResponsiveContainer>
                </Card.Body>
            </Card>
        );
    };

    // Customized Orders Table
    const CustomOrdersTable = () => (
        <Card className="mb-4">
            <Card.Header className="bg-dark text-white d-flex justify-content-between align-items-center">
                <span>Customized Orders Profit Analysis</span>
                <button className="btn btn-light btn-sm" onClick={handleDownloadCustomOrdersCSV} disabled={!customOrders.length}>
                    Download CSV
                </button>
            </Card.Header>
            <Card.Body>
                {customOrdersLoading ? (
                    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100px' }}>
                        <Spinner animation="border" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </Spinner>
                    </div>
                ) : customOrdersError ? (
                    <Alert variant="danger">{customOrdersError}</Alert>
                ) : (
                    <div className="table-responsive">
                        <Table striped bordered hover>
                            <thead>
                                <tr>
                                    <th>Order ID</th>
                                    <th>Customer</th>
                                    <th>Item</th>
                                    <th>Date</th>
                                    <th>Custom Price</th>
                                    <th>Margin</th>
                                    <th>Cost</th>
                                    <th>Profit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center text-muted">
                                            No customized orders found
                                        </td>
                                    </tr>
                                ) : (
                                    customOrders.map((order, idx) => (
                                        <tr key={order.orderId + '-' + idx}>
                                            <td>{order.orderId}</td>
                                            <td>{order.customer}</td>
                                            <td>{order.itemName}</td>
                                            <td>{new Date(order.date).toLocaleString()}</td>
                                            <td>{formatCurrency(order.customPrice)}</td>
                                            <td>{(order.margin * 100).toFixed(1)}%</td>
                                            <td>{formatCurrency(order.cost)}</td>
                                            <td className={order.profit >= 0 ? 'text-success' : 'text-danger'}>
                                                {formatCurrency(order.profit)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </Table>
                    </div>
                )}
            </Card.Body>
        </Card>
    );

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </Container>
        );
    }

    if (error) {
        return (
            <Container className="mt-4">
                <Alert variant="danger">
                    <Alert.Heading>Error Loading Analytics</Alert.Heading>
                    <p>{error}</p>
                </Alert>
            </Container>
        );
    }

    return (
        <Container fluid className="py-4">
            <h1 className="mb-4">
                <FaChartLine className="me-2" />
                Analytics Dashboard
            </h1>

            <SummaryCards />

            <Tabs
                activeKey={period}
                onSelect={(k) => setPeriod(k)}
                className="mb-4"
            >
                <Tab eventKey="hourly" title="Hourly (Last 24 Hours)" />
                <Tab eventKey="daily" title="Daily (Last 7 Days)" />
                <Tab eventKey="weekly" title="Weekly (Last 4 Weeks)" />
                <Tab eventKey="monthly" title="Monthly (Last 12 Months)" />
            </Tabs>

            <Row>
                <Col lg={12}>
                    <RevenueChart />
                </Col>
            </Row>

            <Row>
                <Col lg={6}>
                    <ProfitChart />
                </Col>
                <Col lg={6}>
                    <ProfitTrendChart />
                </Col>
            </Row>

            <Row>
                <Col lg={4}>
                    <TopItemsChart />
                </Col>
            </Row>

            <Row>
                <Col lg={12}>
                    <ItemSalesTable />
                </Col>
            </Row>

            <Row>
                <Col lg={12}>
                    <CustomOrdersTable />
                </Col>
            </Row>
        </Container>
    );
};

export default AnalyticsView; 