import React, { useState, useEffect } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Nav,
  Table,
  Badge,
  Button,
  Form,
  Modal,
  Spinner,
  Alert,
  ProgressBar
} from 'react-bootstrap';
import dayjs from 'dayjs';
import API from '../services/API';

function AdminDashboardView({ user }) {
  const [activeTab, setActiveTab] = useState('analytics');

  // Analytics data
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Facilities data
  const [facilities, setFacilities] = useState([]);
  const [loadingFacilities, setLoadingFacilities] = useState(false);

  // Equipment data
  const [equipment, setEquipment] = useState([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [stockEdit, setStockEdit] = useState({});

  // Users data
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Maintenance modal
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [targetFacility, setTargetFacility] = useState(null);
  const [maintReason, setMaintReason] = useState('');
  const [maintIsActive, setMaintIsActive] = useState(false);

  // Alerts
  const [feedback, setFeedback] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch analytics
  const fetchAnalytics = () => {
    setLoadingAnalytics(true);
    API.getAdminAnalytics()
      .then((data) => {
        setAnalytics(data);
      })
      .catch((err) => {
        setFeedback({ type: 'danger', message: err.error || 'Failed to load analytics.' });
      })
      .finally(() => {
        setLoadingAnalytics(false);
      });
  };

  // Fetch facilities
  const fetchFacilities = () => {
    setLoadingFacilities(true);
    API.getAdminFacilities()
      .then((data) => {
        setFacilities(data || []);
      })
      .catch((err) => {
        setFeedback({ type: 'danger', message: err.error || 'Failed to load facilities.' });
      })
      .finally(() => {
        setLoadingFacilities(false);
      });
  };

  // Fetch equipment
  const fetchEquipment = () => {
    setLoadingEquipment(true);
    API.getAdminEquipment()
      .then((data) => {
        setEquipment(data || []);
        const initialStock = {};
        for (const item of data || []) {
          initialStock[item.id] = item.totalQuantity;
        }
        setStockEdit(initialStock);
      })
      .catch((err) => {
        setFeedback({ type: 'danger', message: err.error || 'Failed to load equipment.' });
      })
      .finally(() => {
        setLoadingEquipment(false);
      });
  };

  // Fetch users
  const fetchUsers = () => {
    setLoadingUsers(true);
    API.getAdminUsers()
      .then((data) => {
        setUsers(data || []);
      })
      .catch((err) => {
        setFeedback({ type: 'danger', message: err.error || 'Failed to load users.' });
      })
      .finally(() => {
        setLoadingUsers(false);
      });
  };

  // Initial load
  useEffect(() => {
    let ignore = false;
    API.getAdminAnalytics()
      .then((data) => {
        if (!ignore) {
          setAnalytics(data);
          setLoadingAnalytics(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setFeedback({ type: 'danger', message: err.error || 'Failed to load analytics.' });
          setLoadingAnalytics(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  // When tab changes, load corresponding data
  const handleTabSelect = (selectedKey) => {
    setActiveTab(selectedKey);
    setFeedback(null);
    if (selectedKey === 'analytics') {
      fetchAnalytics();
    } else if (selectedKey === 'facilities') {
      fetchFacilities();
    } else if (selectedKey === 'equipment') {
      fetchEquipment();
    } else if (selectedKey === 'users') {
      fetchUsers();
    }
  };

  // Open Maintenance Modal
  const openMaintenanceModal = (fac) => {
    setTargetFacility(fac);
    setMaintIsActive(fac.isMaintenance === 1);
    setMaintReason(fac.maintenanceReason || '');
    setShowMaintModal(true);
  };

  // Save Maintenance Mode
  const handleSaveMaintenance = async (e) => {
    e.preventDefault();
    if (!targetFacility) return;

    setSubmitting(true);
    try {
      await API.toggleFacilityMaintenance(
        targetFacility.id,
        maintIsActive,
        maintIsActive ? (maintReason.trim() || 'Scheduled maintenance') : null
      );
      setFeedback({
        type: 'success',
        message: `Maintenance mode for ${targetFacility.name} (${targetFacility.id}) updated to ${
          maintIsActive ? 'ENABLED' : 'DISABLED'
        }.`
      });
      setShowMaintModal(false);
      fetchFacilities();
      fetchAnalytics();
    } catch (err) {
      setFeedback({ type: 'danger', message: err.error || 'Failed to update maintenance mode.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Save Equipment Quantity
  const handleUpdateStock = async (equipmentTypeId) => {
    const newQty = parseInt(stockEdit[equipmentTypeId], 10);
    if (isNaN(newQty) || newQty < 1) {
      setFeedback({ type: 'danger', message: 'Total quantity must be at least 1.' });
      return;
    }

    setSubmitting(true);
    try {
      await API.updateEquipmentStock(equipmentTypeId, newQty);
      setFeedback({
        type: 'success',
        message: `Equipment ${equipmentTypeId} total stock updated to ${newQty}.`
      });
      fetchEquipment();
      fetchAnalytics();
    } catch (err) {
      setFeedback({ type: 'danger', message: err.error || 'Failed to update equipment stock.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Update User Role (Admin only)
  const handleUpdateUserRole = async (userId, newRole) => {
    setSubmitting(true);
    try {
      await API.updateUserRole(userId, newRole);
      setFeedback({
        type: 'success',
        message: `User #${userId} role updated to ${newRole}.`
      });
      fetchUsers();
    } catch (err) {
      setFeedback({ type: 'danger', message: err.error || 'Failed to update user role.' });
    } finally {
      setSubmitting(false);
    }
  };

  const kpis = analytics?.kpis || {};
  const maxHourlyBookings = Math.max(
    ...(analytics?.hourlyUtilization?.map((h) => h.bookingCount) || [1]),
    1
  );

  return (
    <Container fluid="lg" className="py-4">
      {/* Header Banner */}
      <div className="bg-dark text-white p-4 rounded shadow-sm mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <h2 className="fw-bold mb-0">Admin & Facility Operations Dashboard</h2>
        </div>
        <div className="d-flex gap-2">
          <Button
            variant="outline-light"
            size="sm"
            onClick={() => handleTabSelect(activeTab)}
            disabled={submitting}
          >
            <i className="bi bi-arrow-clockwise me-1"></i> Refresh Data
          </Button>
        </div>
      </div>

      {feedback && (
        <Alert variant={feedback.type} dismissible onClose={() => setFeedback(null)} className="mb-4">
          {feedback.message}
        </Alert>
      )}

      {/* KPI Cards Row */}
      <Row className="g-3 mb-4">
        <Col xs={6} md={4} lg={2}>
          <Card className="shadow-sm border-0 bg-primary text-white h-100">
            <Card.Body className="p-3 text-center">
              <div className="text-white-50 small fw-semibold text-uppercase">Total Bookings</div>
              <div className="fs-3 fw-bold mt-1">
                {loadingAnalytics ? <Spinner animation="border" size="sm" /> : kpis.totalReservations ?? 0}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={4} lg={2}>
          <Card className="shadow-sm border-0 bg-success text-white h-100">
            <Card.Body className="p-3 text-center">
              <div className="text-white-50 small fw-semibold text-uppercase">Active Bookings</div>
              <div className="fs-3 fw-bold mt-1">
                {loadingAnalytics ? <Spinner animation="border" size="sm" /> : kpis.activeReservations ?? 0}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={4} lg={2}>
          <Card className="shadow-sm border-0 bg-danger text-white h-100">
            <Card.Body className="p-3 text-center">
              <div className="text-white-50 small fw-semibold text-uppercase">Cancellations</div>
              <div className="fs-3 fw-bold mt-1">
                {loadingAnalytics ? <Spinner animation="border" size="sm" /> : kpis.totalCancellations ?? 0}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={4} lg={2}>
          <Card className="shadow-sm border-0 bg-warning text-dark h-100">
            <Card.Body className="p-3 text-center">
              <div className="text-muted small fw-semibold text-uppercase">In Maintenance</div>
              <div className="fs-3 fw-bold mt-1">
                {loadingAnalytics ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  `${kpis.maintenanceFacilities ?? 0} / ${kpis.totalFacilities ?? 0}`
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={4} lg={2}>
          <Card className="shadow-sm border-0 bg-info text-white h-100">
            <Card.Body className="p-3 text-center">
              <div className="text-white-50 small fw-semibold text-uppercase">Members</div>
              <div className="fs-3 fw-bold mt-1">
                {loadingAnalytics ? <Spinner animation="border" size="sm" /> : kpis.totalUsers ?? 0}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={4} lg={2}>
          <Card className="shadow-sm border-0 bg-secondary text-white h-100">
            <Card.Body className="p-3 text-center">
              <div className="text-white-50 small fw-semibold text-uppercase">Penalized Users</div>
              <div className="fs-3 fw-bold mt-1">
                {loadingAnalytics ? <Spinner animation="border" size="sm" /> : kpis.totalPenalizedUsers ?? 0}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Tabs Navigation */}
      <Card className="shadow-sm border-0">
        <Card.Header className="bg-white border-bottom p-0">
          <Nav
            variant="tabs"
            activeKey={activeTab}
            onSelect={handleTabSelect}
            className="px-3 pt-2 flex-nowrap overflow-x-auto border-bottom-0"
          >
            <Nav.Item>
              <Nav.Link eventKey="analytics" className="fw-semibold text-nowrap small">
                Operational Analytics & Insights
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="facilities" className="fw-semibold text-nowrap small">
                Facility Maintenance Mode
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="equipment" className="fw-semibold text-nowrap small">
                Equipment Stock Management
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="users" className="fw-semibold text-nowrap small">
                User Management & Penalties
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Card.Header>

        <Card.Body className="p-4">
          {/* TAB 1: ANALYTICS & INSIGHTS */}
          {activeTab === 'analytics' && (
            <>
              {loadingAnalytics ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-3 text-muted">Calculating real-time analytics...</p>
                </div>
              ) : (
                <Row className="g-4">
                  {/* Discipline Popularity */}
                  <Col xs={12} lg={6}>
                    <Card className="border shadow-sm h-100">
                      <Card.Header className="bg-light fw-bold py-3">
                        <i className="bi bi-pie-chart-fill text-primary me-2"></i> Sports Discipline Popularity
                      </Card.Header>
                      <Card.Body className="p-3">
                        {analytics?.disciplinePopularity?.map((d) => (
                          <div key={d.typeId} className="mb-3">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="fw-semibold">{d.typeName}</span>
                              <span className="text-muted small">
                                <strong>{d.bookingCount}</strong> booking(s) ({d.percentage}%)
                              </span>
                            </div>
                            <ProgressBar
                              now={d.percentage}
                              variant={
                                d.typeId === 'TENNIS'
                                  ? 'primary'
                                  : d.typeId === 'BASKETBALL'
                                  ? 'warning'
                                  : d.typeId === 'SOCCER'
                                  ? 'success'
                                  : d.typeId === 'VOLLEYBALL'
                                  ? 'info'
                                  : 'secondary'
                              }
                              style={{ height: '10px' }}
                            />
                          </div>
                        ))}
                      </Card.Body>
                    </Card>
                  </Col>

                  {/* Peak Utilization Hours */}
                  <Col xs={12} lg={6}>
                    <Card className="border shadow-sm h-100">
                      <Card.Header className="bg-light fw-bold py-3">
                        <i className="bi bi-clock-history text-primary me-2"></i> Peak Hourly Utilization
                      </Card.Header>
                      <Card.Body className="p-3">
                        <div className="overflow-auto" style={{ maxHeight: '320px' }}>
                          {analytics?.hourlyUtilization?.map((h) => {
                            const pct = Math.round((h.bookingCount / maxHourlyBookings) * 100);
                            const isPeak = h.bookingCount > 0 && pct >= 70;
                            return (
                              <div key={h.slot} className="mb-2">
                                <div className="d-flex justify-content-between align-items-center mb-1 small">
                                  <span className="fw-semibold font-monospace">{h.label}</span>
                                  <span>
                                    {h.bookingCount} booking(s)
                                    {isPeak && (
                                      <Badge bg="danger" className="ms-2">
                                        Peak
                                      </Badge>
                                    )}
                                  </span>
                                </div>
                                <ProgressBar
                                  now={pct}
                                  variant={isPeak ? 'danger' : pct > 30 ? 'primary' : 'info'}
                                  style={{ height: '8px' }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>

                  {/* Facility Court Utilization */}
                  <Col xs={12} lg={6}>
                    <Card className="border shadow-sm h-100">
                      <Card.Header className="bg-light fw-bold py-3">
                        <i className="bi bi-grid text-primary me-2"></i> Facility Court Bookings
                      </Card.Header>
                      <Card.Body className="p-0">
                        <Table responsive hover className="mb-0 align-middle">
                          <thead className="table-light">
                            <tr>
                              <th className="ps-3">Court / Facility</th>
                              <th>Sport</th>
                              <th className="text-center">Total Bookings</th>
                              <th className="text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics?.facilityUtilization?.map((f) => (
                              <tr key={f.facilityId}>
                                <td className="ps-3 fw-semibold">
                                  {f.facilityName} <span className="text-muted small">({f.facilityId})</span>
                                </td>
                                <td>{f.typeName}</td>
                                <td className="text-center fw-bold">{f.bookingCount}</td>
                                <td className="text-center">
                                  {f.isMaintenance === 1 ? (
                                    <Badge bg="warning" text="dark">
                                      🔧 Maintenance
                                    </Badge>
                                  ) : (
                                    <Badge bg="success">Operational</Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                  </Col>

                  {/* Recent Cancellations Log */}
                  <Col xs={12} lg={6}>
                    <Card className="border shadow-sm h-100">
                      <Card.Header className="bg-light fw-bold py-3">
                        <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i> Recent Cancellations & Penalty Log
                      </Card.Header>
                      <Card.Body className="p-0">
                        {analytics?.recentCancellations?.length === 0 ? (
                          <div className="p-4 text-center text-muted">No cancellations recorded.</div>
                        ) : (
                          <Table responsive hover className="mb-0 align-middle">
                            <thead className="table-light">
                              <tr>
                                <th className="ps-3">User</th>
                                <th className="text-center">Current Score</th>
                                <th>Sport Discipline</th>
                                <th className="text-end pe-3">Cancelled At</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analytics?.recentCancellations?.map((c) => (
                                <tr key={c.id}>
                                  <td className="ps-3 fw-semibold">{c.username}</td>
                                  <td className="text-center">
                                    <Badge bg={c.currentScore < 0 ? 'danger' : 'success'}>
                                      {c.currentScore}
                                    </Badge>
                                  </td>
                                  <td>{c.typeName}</td>
                                  <td className="text-end pe-3 text-muted small">
                                    {dayjs(c.releasedAt).format('YYYY-MM-DD HH:mm:ss')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              )}
            </>
          )}

          {/* TAB 2: FACILITY MAINTENANCE MODE */}
          {activeTab === 'facilities' && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h4 className="fw-bold mb-0">Facility Maintenance Controls</h4>
                </div>
                <Button variant="outline-primary" size="sm" onClick={fetchFacilities} disabled={loadingFacilities}>
                  {loadingFacilities ? <Spinner animation="border" size="sm" /> : 'Refresh List'}
                </Button>
              </div>

              {loadingFacilities ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                </div>
              ) : (
                <Table responsive hover className="align-middle border shadow-sm">
                  <thead className="table-dark">
                    <tr>
                      <th className="ps-3">Code</th>
                      <th>Facility Name</th>
                      <th>Sport Discipline</th>
                      <th className="text-center">Operational Status</th>
                      <th>Maintenance Notice</th>
                      <th className="text-center">Total Bookings</th>
                      <th className="text-end pe-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facilities.map((fac) => {
                      const isMaint = fac.isMaintenance === 1;
                      return (
                        <tr key={fac.id} className={isMaint ? 'table-warning' : ''}>
                          <td className="ps-3 fw-bold font-monospace">{fac.id}</td>
                          <td className="fw-semibold">{fac.name}</td>
                          <td>{fac.typeName}</td>
                          <td className="text-center">
                            {isMaint ? (
                              <Badge bg="warning" text="dark" className="px-3 py-2 fs-7">
                                <i className="bi bi-tools me-1"></i> Maintenance
                              </Badge>
                            ) : (
                              <Badge bg="success" className="px-3 py-2 fs-7">
                                <i className="bi bi-check-circle me-1"></i> Operational
                              </Badge>
                            )}
                          </td>
                          <td className="small">
                            {isMaint ? (
                              <span className="text-dark fw-semibold">
                                <i className="bi bi-info-circle me-1 text-warning"></i>
                                {fac.maintenanceReason || 'Scheduled maintenance'}
                              </span>
                            ) : (
                              <span className="text-muted italic">None (Normal operations)</span>
                            )}
                          </td>
                          <td className="text-center fw-semibold">{fac.totalBookingsCount || 0}</td>
                          <td className="text-end pe-3">
                            <Button
                              variant={isMaint ? 'success' : 'outline-danger'}
                              size="sm"
                              className="fw-semibold"
                              onClick={() => openMaintenanceModal(fac)}
                            >
                              {isMaint ? 'Reopen Court' : 'Set Maintenance'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </div>
          )}

          {/* TAB 3: EQUIPMENT STOCK MANAGEMENT */}
          {activeTab === 'equipment' && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h4 className="fw-bold mb-0">Equipment Inventory & Stock Control</h4>
                </div>
                <Button variant="outline-primary" size="sm" onClick={fetchEquipment} disabled={loadingEquipment}>
                  {loadingEquipment ? <Spinner animation="border" size="sm" /> : 'Refresh Stock'}
                </Button>
              </div>

              {loadingEquipment ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                </div>
              ) : (
                <Table responsive hover className="align-middle border shadow-sm">
                  <thead className="table-dark">
                    <tr>
                      <th className="ps-3">Equipment Name</th>
                      <th className="text-center">Current Total Stock</th>
                      <th className="text-center">Peak Active Rentals</th>
                      <th className="text-center">All-Time Units Rented</th>
                      <th style={{ width: '260px' }} className="text-end pe-3">
                        Adjust Total Inventory
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map((eq) => {
                      const currentVal = stockEdit[eq.id] ?? eq.totalQuantity;
                      const hasChanged = currentVal !== eq.totalQuantity;
                      return (
                        <tr key={eq.id}>
                          <td className="ps-3 fw-semibold fs-6">{eq.name}</td>
                          <td className="text-center fs-5 fw-bold text-primary">{eq.totalQuantity}</td>
                          <td className="text-center">
                            <Badge bg={eq.maxActiveRented > 0 ? 'warning' : 'secondary'} text={eq.maxActiveRented > 0 ? 'dark' : 'white'} className="px-2 py-1">
                              {eq.maxActiveRented} unit(s)
                            </Badge>
                          </td>
                          <td className="text-center text-muted fw-semibold">
                            {eq.totalUnitsRentedAllTime || 0}
                          </td>
                          <td className="text-end pe-3">
                            <div className="d-flex align-items-center justify-content-end gap-2">
                              <Form.Control
                                type="number"
                                size="sm"
                                style={{ width: '80px' }}
                                min={Math.max(1, eq.maxActiveRented)}
                                value={currentVal}
                                onChange={(e) =>
                                  setStockEdit((prev) => ({
                                    ...prev,
                                    [eq.id]: parseInt(e.target.value, 10) || 0
                                  }))
                                }
                              />
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={!hasChanged || submitting}
                                onClick={() => handleUpdateStock(eq.id)}
                              >
                                Save
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </div>
          )}

          {/* TAB 4: USER MANAGEMENT & PENALTIES */}
          {activeTab === 'users' && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <h4 className="fw-bold mb-0">Members & Penalty Overview</h4>
                </div>
                <Button variant="outline-primary" size="sm" onClick={fetchUsers} disabled={loadingUsers}>
                  {loadingUsers ? <Spinner animation="border" size="sm" /> : 'Refresh Users'}
                </Button>
              </div>

              {loadingUsers ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                </div>
              ) : (
                <Table responsive hover className="align-middle border shadow-sm">
                  <thead className="table-dark">
                    <tr>
                      <th className="ps-3">ID</th>
                      <th>Username</th>
                      <th className="text-center">Penalty Score</th>
                      <th className="text-center">2FA (TOTP)</th>
                      <th className="text-center">Total Bookings</th>
                      <th className="text-center">Role</th>
                      {user?.role === 'admin' && <th className="text-end pe-3">Role Management</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isNegative = u.score < 0;
                      return (
                        <tr key={u.id} className={isNegative ? 'table-danger' : ''}>
                          <td className="ps-3 fw-bold font-monospace">#{u.id}</td>
                          <td className="fw-semibold">
                            {u.username}
                            {u.id === user?.id && <Badge bg="secondary" className="ms-2">You</Badge>}
                          </td>
                          <td className="text-center">
                            <Badge bg={isNegative ? 'danger' : 'success'} className="px-3 py-1 fs-7">
                              {u.score}
                            </Badge>
                          </td>
                          <td className="text-center">
                            {u.isTotp ? (
                              <Badge bg="success" className="text-lowercase">active</Badge>
                            ) : (
                              <Badge bg="secondary" className="text-lowercase">disabled</Badge>
                            )}
                          </td>
                          <td className="text-center fw-semibold">{u.reservationCount}</td>
                          <td className="text-center">
                            <Badge
                              bg={
                                u.role === 'admin'
                                  ? 'danger'
                                  : u.role === 'staff'
                                  ? 'info'
                                  : 'light'
                              }
                              text={u.role === 'user' ? 'dark' : 'white'}
                              className="text-lowercase px-2 py-1"
                            >
                              {u.role}
                            </Badge>
                          </td>
                          {user?.role === 'admin' && (
                            <td className="text-end pe-3">
                              <Form.Select
                                size="sm"
                                style={{ width: '120px', display: 'inline-block' }}
                                value={u.role}
                                disabled={u.id === user?.id || submitting}
                                onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                              >
                                <option value="user">user</option>
                                <option value="staff">staff</option>
                                <option value="admin">admin</option>
                              </Form.Select>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Maintenance Toggle Modal */}
      <Modal show={showMaintModal} onHide={() => setShowMaintModal(false)} centered>
        <Form onSubmit={handleSaveMaintenance}>
          <Modal.Header closeButton>
            <Modal.Title className="fw-bold">
              <i className="bi bi-tools me-2 text-warning"></i>
              Manage Facility Maintenance
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {targetFacility && (
              <>
                <div className="mb-3">
                  <div className="text-muted small">Target Facility:</div>
                  <div className="fw-bold fs-5">
                    {targetFacility.name} ({targetFacility.id})
                  </div>
                  <div className="text-secondary small">{targetFacility.typeName}</div>
                </div>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="switch"
                    id="maint-switch"
                    label="Facility is Under Maintenance"
                    checked={maintIsActive}
                    onChange={(e) => setMaintIsActive(e.target.checked)}
                    className="fw-bold fs-6"
                  />
                  <Form.Text className="text-muted">
                    When enabled, users will see a maintenance notice and will NOT be able to book this court.
                  </Form.Text>
                </Form.Group>

                {maintIsActive && (
                  <Form.Group className="mb-3">
                    <Form.Label className="fw-semibold">
                      Maintenance Reason / Banner Message
                    </Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="e.g. Clay court resurfacing & line repainting"
                      value={maintReason}
                      onChange={(e) => setMaintReason(e.target.value)}
                      required={maintIsActive}
                    />
                    <Form.Text className="text-muted">
                      Displayed on public overview, schedule calendar, and booking attempts.
                    </Form.Text>
                  </Form.Group>
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowMaintModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? <Spinner animation="border" size="sm" /> : 'Save Changes'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
}

export default AdminDashboardView;
