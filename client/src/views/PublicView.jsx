import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Spinner, Alert, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import API from '../services/API';

const TIME_SLOTS = [
  { start: '08:00', end: '09:00', label: '08:00 - 09:00' },
  { start: '09:00', end: '10:00', label: '09:00 - 10:00' },
  { start: '10:00', end: '11:00', label: '10:00 - 11:00' },
  { start: '11:00', end: '12:00', label: '11:00 - 12:00' },
  { start: '12:00', end: '13:00', label: '12:00 - 13:00' },
  { start: '13:00', end: '14:00', label: '13:00 - 14:00' },
  { start: '14:00', end: '15:00', label: '14:00 - 15:00' },
  { start: '15:00', end: '16:00', label: '15:00 - 16:00' },
  { start: '16:00', end: '17:00', label: '16:00 - 17:00' },
  { start: '17:00', end: '18:00', label: '17:00 - 18:00' },
  { start: '18:00', end: '19:00', label: '18:00 - 19:00' },
  { start: '19:00', end: '20:00', label: '19:00 - 20:00' },
  { start: '20:00', end: '21:00', label: '20:00 - 21:00' },
  { start: '21:00', end: '22:00', label: '21:00 - 22:00' },
];

function PublicView({ loggedIn }) {
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('10:00');

  const [facilities, setFacilities] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAvailability = (date = selectedDate, slot = selectedTimeSlot) => {
    setLoading(true);
    setError(null);
    API.getPublicAvailability(date, slot)
      .then((data) => {
        setFacilities(data.facilities || []);
        setEquipment(data.equipment || []);
      })
      .catch((err) => {
        setError(err.error || 'Unable to fetch availability. Please check the backend server.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let ignore = false;
    API.getPublicAvailability(selectedDate, selectedTimeSlot)
      .then((data) => {
        if (!ignore) {
          setFacilities(data.facilities || []);
          setEquipment(data.equipment || []);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.error || 'Unable to fetch availability.');
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedDate, selectedTimeSlot]);

  return (
    <Container className="pb-5">
      {/* Header Banner */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3 bg-light p-4 rounded shadow-sm">
        <div>
          <h2 className="mb-1 fw-bold">Sports Center Availability</h2>
          <p className="text-muted mb-0">
            View available sports courts, fields, and equipment inventory per date & time slot
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Button as={Link} to="/calendar" variant="outline-primary" className="fw-semibold">
            <i className="bi bi-calendar3 me-1"></i> Interactive Calendar
          </Button>
          <Button variant="outline-secondary" onClick={() => fetchAvailability()} disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : 'Refresh'}
          </Button>
          <Button
            as={Link}
            to={loggedIn ? '/new-reservation' : '/login'}
            variant="primary"
            className="fw-semibold"
          >
            + Reserve Facility
          </Button>
        </div>
      </div>

      {/* Date & Time Slot Control Card */}
      <Card className="shadow-sm border-0 mb-4 bg-white">
        <Card.Body className="p-3">
          <Row className="g-3 align-items-center">
            <Col xs={12} sm={6} md={4}>
              <Form.Label className="fw-semibold small text-muted mb-1">
                <i className="bi bi-calendar-event me-1"></i> Select Date
              </Form.Label>
              <Form.Control
                type="date"
                size="sm"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="fw-bold"
              />
            </Col>
            <Col xs={12} sm={6} md={4}>
              <Form.Label className="fw-semibold small text-muted mb-1">
                <i className="bi bi-clock me-1"></i> Time Slot
              </Form.Label>
              <Form.Select
                size="sm"
                value={selectedTimeSlot}
                onChange={(e) => setSelectedTimeSlot(e.target.value)}
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot.start} value={slot.start}>
                    {slot.label}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={12} md={4} className="d-flex align-items-end">
              <div className="text-muted small">
                Showing live status for: <strong className="text-primary">{dayjs(selectedDate).format('D MMM YYYY')}</strong> at <strong className="text-dark">{selectedTimeSlot}</strong>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Loading live sports center data...</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Facilities Cards Grid */}
          <div className="mb-5">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h3 className="fw-bold mb-0">Sports Facilities</h3>
              <Badge bg="secondary" className="px-3 py-2">
                Total Disciplines: {facilities.length}
              </Badge>
            </div>

            <Row xs={1} md={2} lg={3} className="g-4">
              {facilities.map((fac) => {
                const hasAvailable = fac.availableCount > 0;
                return (
                  <Col key={fac.typeId}>
                    <Card
                      className={`h-100 shadow-sm border-${hasAvailable ? 'primary' : 'secondary'}`}
                      style={{ borderWidth: '2px' }}
                    >
                      <Card.Body className="d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <Card.Title className="fw-bold fs-5 mb-0">{fac.typeName}</Card.Title>
                          <Badge
                            bg={hasAvailable ? 'success' : 'danger'}
                            className="fs-6 px-2 py-1"
                          >
                            {fac.availableCount} / {fac.totalCount} Free
                          </Badge>
                        </div>

                        <p className="text-muted small mb-3">
                          {hasAvailable
                            ? `${fac.availableCount} court(s) available for booking on this slot.`
                            : 'All courts are currently booked for this time slot.'}
                        </p>

                        <div className="mt-auto pt-2 border-top">
                          <small className="fw-semibold text-secondary d-block mb-2">
                            Court Identifiers:
                          </small>
                          <div className="d-flex flex-wrap gap-1">
                            {fac.facilityCodes.map((fc) => (
                              <Badge
                                key={fc.code}
                                bg={fc.isBooked ? 'danger' : 'success'}
                                className="px-2 py-1"
                                title={fc.isBooked ? 'Booked' : 'Available'}
                              >
                                {fc.code} {fc.isBooked ? '✕' : '✓'}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>

          {/* Rental Equipment Inventory Table */}
          <div>
            <div className="mb-3">
              <h3 className="fw-bold mb-0">Rental Equipment Stock</h3>
            </div>

            <Card className="shadow-sm border-0">
              <Card.Body className="p-0">
                <Table responsive hover className="align-middle mb-0">
                  <thead className="table-dark">
                    <tr>
                      <th className="ps-4">Equipment Item</th>
                      <th className="text-center">Total Inventory</th>
                      <th className="text-center">Available in Slot</th>
                      <th className="text-center">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipment.map((eq) => {
                      const isOutOfStock = eq.availableQuantity <= 0;
                      const isLowAvailability =
                        eq.availableQuantity > 0 &&
                        eq.totalQuantity > 0 &&
                        (eq.availableQuantity / eq.totalQuantity) <= 0.3;

                      let badgeVariant = 'success';
                      let statusText = 'Available';

                      if (isOutOfStock) {
                        badgeVariant = 'danger';
                        statusText = 'Out of Stock';
                      } else if (isLowAvailability) {
                        badgeVariant = 'warning';
                        statusText = 'Low Stock';
                      }

                      return (
                        <tr key={eq.id}>
                          <td className="ps-4 fw-semibold">{eq.name}</td>
                          <td className="text-center">{eq.totalQuantity}</td>
                          <td className="text-center fw-bold fs-6">
                            <span
                              className={
                                isOutOfStock
                                  ? 'text-danger'
                                  : isLowAvailability
                                  ? 'text-warning'
                                  : 'text-success'
                              }
                            >
                              {eq.availableQuantity}
                            </span>
                          </td>
                          <td className="text-center">
                            <Badge
                              bg={badgeVariant}
                              text={badgeVariant === 'warning' ? 'dark' : 'white'}
                              className="px-3 py-1"
                            >
                              {statusText}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </div>
        </>
      )}
    </Container>
  );
}

export default PublicView;