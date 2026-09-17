import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Badge, Spinner, Alert, Table } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
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

function ScheduleCalendarView({ loggedIn }) {
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [selectedType, setSelectedType] = useState('ALL');
  const [facilities, setFacilities] = useState([]);
  const [facilityTypes, setFacilityTypes] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    let ignore = false;

    API.getScheduleCalendar({
      startDate: selectedDate,
      endDate: selectedDate,
      facilityTypeId: selectedType === 'ALL' ? null : selectedType
    })
      .then((data) => {
        if (!ignore) {
          setFacilities(data.facilities || []);
          setFacilityTypes(data.facilityTypes || []);
          setReservations(data.reservations || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMessage(err.error || 'Failed to load schedule calendar.');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedDate, selectedType]);

  const handlePrevDay = () => {
    setLoading(true);
    setSelectedDate((prev) => dayjs(prev).subtract(1, 'day').format('YYYY-MM-DD'));
  };

  const handleNextDay = () => {
    setLoading(true);
    setSelectedDate((prev) => dayjs(prev).add(1, 'day').format('YYYY-MM-DD'));
  };

  const handleToday = () => {
    setLoading(true);
    setSelectedDate(dayjs().format('YYYY-MM-DD'));
  };

  const filteredFacilities =
    selectedType === 'ALL'
      ? facilities
      : facilities.filter((f) => f.facilityTypeId === selectedType);

  const getSlotReservation = (facilityId, startTime) => {
    return reservations.find(
      (r) =>
        r.facilityId === facilityId &&
        r.bookingDate === selectedDate &&
        r.startTime === startTime
    );
  };

  const handleSlotClick = (facility, slot) => {
    if (facility.isMaintenance === 1) {
      return;
    }
    const existing = getSlotReservation(facility.id, slot.start);
    if (existing) {
      if (existing.isMine) {
        navigate('/reservations');
      }
      return;
    }

    if (!loggedIn) {
      navigate('/login');
      return;
    }

    navigate(
      `/new-reservation?facilityId=${facility.id}&facilityTypeId=${facility.facilityTypeId}&date=${selectedDate}&timeSlot=${slot.start}`
    );
  };

  return (
    <Container fluid="lg" className="py-4">
      {/* Header Section */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h2 className="fw-bold mb-0">
            <i className="bi bi-calendar3 me-2 text-primary"></i> Interactive Schedule Calendar
          </h2>
        </div>
        <div className="d-flex gap-2">
          <Button as={Link} to="/" variant="outline-secondary">
            <i className="bi bi-grid-fill me-1"></i> Public Availability
          </Button>
          <Button
            as={Link}
            to={loggedIn ? '/new-reservation' : '/login'}
            variant="warning"
            className="fw-bold"
          >
            <i className="bi bi-plus-circle me-1"></i> Reserve Facility
          </Button>
        </div>
      </div>

      {/* Control Bar: Date Selector & Sport Filter */}
      <Card className="shadow-sm border-0 mb-4 bg-white">
        <Card.Body className="p-3">
          <Row className="g-3 align-items-center mb-3">
            <Col xs={12} sm={6} md={5} lg={4}>
              <Form.Label className="fw-semibold small text-muted mb-1">Select Date</Form.Label>
              <div className="input-group">
                <Button variant="outline-primary" size="sm" onClick={handlePrevDay} title="Previous Day">
                  <i className="bi bi-chevron-left"></i>
                </Button>
                <Form.Control
                  type="date"
                  size="sm"
                  value={selectedDate}
                  onChange={(e) => {
                    setLoading(true);
                    setSelectedDate(e.target.value);
                  }}
                  className="text-center fw-bold"
                />
                <Button variant="outline-primary" size="sm" onClick={handleNextDay} title="Next Day">
                  <i className="bi bi-chevron-right"></i>
                </Button>
                <Button variant="primary" size="sm" onClick={handleToday}>
                  Today
                </Button>
              </div>
            </Col>

            <Col xs={12} sm={6} md={4} lg={3}>
              <Form.Label className="fw-semibold small text-muted mb-1">Filter by Sport</Form.Label>
              <Form.Select
                size="sm"
                value={selectedType}
                onChange={(e) => {
                  setLoading(true);
                  setSelectedType(e.target.value);
                }}
              >
                <option value="ALL">All Sports Facilities</option>
                {facilityTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.name}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>

          {/* Status Legend below */}
          <div className="pt-2 border-top">
            <Form.Label className="fw-semibold small text-muted mb-1 d-block">Status Legend</Form.Label>
            <div className="d-flex flex-wrap align-items-center gap-2">
              <Badge bg="success" className="p-2 fw-normal d-inline-flex align-items-center text-nowrap">
                <i className="bi bi-check-circle me-1"></i> Available (Click to book)
              </Badge>
              <Badge bg="danger" className="p-2 fw-normal d-inline-flex align-items-center text-nowrap">
                <i className="bi bi-lock-fill me-1"></i> Booked
              </Badge>
              <Badge bg="warning" text="dark" className="p-2 fw-normal d-inline-flex align-items-center text-nowrap">
                <i className="bi bi-star-fill me-1"></i> My Reservation
              </Badge>
              <Badge bg="secondary" className="p-2 fw-normal d-inline-flex align-items-center text-nowrap">
                <i className="bi bi-tools me-1"></i> Maintenance
              </Badge>
            </div>
          </div>
        </Card.Body>
      </Card>

      {errorMessage && (
        <Alert variant="danger" dismissible onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2 text-muted">Loading schedule matrix...</p>
        </div>
      ) : (
        <Card className="shadow-sm border-0">
          <Card.Header className="bg-light py-3">
            <h5 className="mb-0 fw-bold">
              Timeline for {dayjs(selectedDate).format('dddd, MMMM D, YYYY')}
            </h5>
          </Card.Header>
          <Card.Body className="p-0">
            <div className="table-responsive" style={{ maxHeight: '650px' }}>
              <Table bordered hover className="mb-0 text-center align-middle" style={{ fontSize: '0.85rem' }}>
                <thead className="table-dark sticky-top" style={{ zIndex: 10 }}>
                  <tr>
                    <th style={{ minWidth: '160px', width: '180px' }} className="text-start ps-3">
                      Facility / Court
                    </th>
                    {TIME_SLOTS.map((slot) => (
                      <th key={slot.start} style={{ minWidth: '95px' }} className="fw-semibold">
                        {slot.start}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredFacilities.length === 0 ? (
                    <tr>
                      <td colSpan={TIME_SLOTS.length + 1} className="py-4 text-muted">
                        No facilities found for this filter.
                      </td>
                    </tr>
                  ) : (
                    filteredFacilities.map((facility) => {
                      const isCourtMaint = facility.isMaintenance === 1;
                      return (
                        <tr key={facility.id} className={isCourtMaint ? 'table-secondary' : ''}>
                          <td className="text-start ps-3 fw-bold bg-light">
                            <div className="d-flex align-items-center justify-content-between">
                              <span>{facility.name}</span>
                              {isCourtMaint && (
                                <Badge bg="warning" text="dark" className="ms-1" style={{ fontSize: '0.75rem' }}>
                                  <i className="bi bi-tools me-1"></i> Maint.
                                </Badge>
                              )}
                            </div>
                            <small className="text-muted fw-normal">{facility.typeName} ({facility.id})</small>
                            {isCourtMaint && facility.maintenanceReason && (
                              <div className="text-warning-emphasis small mt-1 font-monospace" style={{ fontSize: '0.72rem' }}>
                                {facility.maintenanceReason}
                              </div>
                            )}
                          </td>

                          {TIME_SLOTS.map((slot) => {
                            if (isCourtMaint) {
                              return (
                                <td
                                  key={slot.start}
                                  className="bg-secondary-subtle text-muted p-1"
                                  title={`Court under maintenance: ${facility.maintenanceReason || 'Scheduled service'}`}
                                >
                                  <Badge bg="secondary" className="w-100 py-2 d-block text-nowrap">
                                    <i className="bi bi-tools me-1"></i> Maint.
                                  </Badge>
                                </td>
                              );
                            }

                            const res = getSlotReservation(facility.id, slot.start);

                            if (res) {
                              if (res.isMine) {
                                return (
                                  <td
                                    key={slot.start}
                                    className="bg-warning-subtle text-dark p-1"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => handleSlotClick(facility, slot)}
                                    title={`Your booking! Click to view in My Reservations`}
                                  >
                                    <Badge bg="warning" text="dark" className="w-100 py-2 d-block">
                                      <i className="bi bi-star-fill me-1"></i> Mine
                                    </Badge>
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={slot.start}
                                  className="bg-danger-subtle text-danger p-1"
                                  title={`Booked: ${slot.start}-${slot.end}`}
                                >
                                  <Badge bg="danger" className="w-100 py-2 d-block">
                                    <i className="bi bi-lock-fill me-1"></i> Booked
                                  </Badge>
                                </td>
                              );
                            }

                            return (
                              <td
                                key={slot.start}
                                className="p-1"
                                style={{ cursor: 'pointer', transition: 'background-color 0.15s' }}
                                onClick={() => handleSlotClick(facility, slot)}
                                title={`Free slot: ${slot.start}-${slot.end}. Click to book!`}
                              >
                                <Button
                                  variant="outline-success"
                                  size="sm"
                                  className="w-100 py-1 px-1 border-0 bg-success-subtle text-success fw-semibold"
                                  style={{ fontSize: '0.8rem' }}
                                >
                                  Free
                                </Button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}

export default ScheduleCalendarView;
