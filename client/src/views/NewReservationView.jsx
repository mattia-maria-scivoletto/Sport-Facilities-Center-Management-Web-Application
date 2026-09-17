import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Table, Badge, Alert, Spinner } from 'react-bootstrap';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
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

const getAvailableTimeSlots = (dateStr) => {
  if (!dateStr) return [];
  const isToday = dayjs(dateStr).isSame(dayjs(), 'day');
  if (!isToday) {
    if (dayjs(dateStr).isBefore(dayjs(), 'day')) {
      return [];
    }
    return TIME_SLOTS;
  }
  const now = dayjs();
  return TIME_SLOTS.filter((slot) => {
    const slotDateTime = dayjs(`${dateStr}T${slot.start}`);
    return slotDateTime.isAfter(now);
  });
};

function NewReservationView({ user, setFeedback }) {
  const [searchParams] = useSearchParams();

  const initialBookingDate = searchParams.get('date') || dayjs().format('YYYY-MM-DD');
  const initialAvailableSlots = getAvailableTimeSlots(initialBookingDate);
  const paramSlot = searchParams.get('timeSlot');
  const initialTimeSlot =
    paramSlot && initialAvailableSlots.some((s) => s.start === paramSlot)
      ? paramSlot
      : initialAvailableSlots.length > 0
      ? initialAvailableSlots[0].start
      : '';

  const [bookingDate, setBookingDate] = useState(initialBookingDate);
  const [timeSlot, setTimeSlot] = useState(initialTimeSlot);

  const [facilityTypes, setFacilityTypes] = useState([]);
  const [allFacilities, setAllFacilities] = useState([]);
  const [selectedType, setSelectedType] = useState(searchParams.get('facilityTypeId') || '');
  const [assignmentMode, setAssignmentMode] = useState(
    searchParams.get('facilityId') ? 'manual' : 'auto'
  );
  const [selectedFacilityId, setSelectedFacilityId] = useState(
    searchParams.get('facilityId') || ''
  );

  // equipment rules and chosen quantities
  const [rules, setRules] = useState([]);
  const [equipmentQuantities, setEquipmentQuantities] = useState({});

  const [loading, setLoading] = useState(Boolean(initialTimeSlot));
  const [loadingRules, setLoadingRules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();

  // Load facility types and court availability for selected date & slot
  useEffect(() => {
    if (!bookingDate || !timeSlot) {
      return;
    }
    let ignore = false;
    Promise.all([API.getFacilityTypes(), API.getAllFacilities(bookingDate, timeSlot)])
      .then(([types, facilities]) => {
        if (!ignore) {
          setFacilityTypes(types || []);
          setAllFacilities(facilities || []);
          if (types && types.length > 0) {
            setSelectedType((prev) => prev || types[0].id);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMessage(err.error || 'Failed to load sports center facility data.');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [bookingDate, timeSlot]);

  // Load rules and inventory for selected type, date & slot
  useEffect(() => {
    if (!selectedType || !bookingDate || !timeSlot) {
      return;
    }
    let ignore = false;

    API.getFacilityRules(selectedType, bookingDate, timeSlot)
      .then((typeRules) => {
        if (!ignore) {
          setRules(typeRules || []);
          const initialQty = {};
          for (const r of typeRules || []) {
            initialQty[r.equipmentTypeId] = r.minQuantity;
          }
          setEquipmentQuantities(initialQty);

          const availableOfThisType = allFacilities.filter(
            (f) => f.facilityTypeId === selectedType && f.isAvailable === 1
          );
          if (availableOfThisType.length > 0) {
            setSelectedFacilityId((prev) => {
              if (!prev || !availableOfThisType.some((f) => f.id === prev)) {
                return availableOfThisType[0].id;
              }
              return prev;
            });
          } else {
            setSelectedFacilityId('');
          }
          setLoadingRules(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMessage(err.error || 'Failed to load equipment rules.');
          setLoadingRules(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedType, allFacilities, bookingDate, timeSlot]);

  const handleQuantityChange = (equipmentTypeId, newQuantity) => {
    setEquipmentQuantities((prev) => ({
      ...prev,
      [equipmentTypeId]: Math.max(0, newQuantity)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!timeSlot || availableTimeSlots.length === 0) {
      setErrorMessage('Please select a valid future time slot.');
      return;
    }

    if (assignmentMode === 'manual' && !selectedFacilityId) {
      setErrorMessage('Please select a specific court or switch to automatic assignment.');
      return;
    }

    // Validate quantities against min requirements and stock
    for (const rule of rules) {
      const chosen = equipmentQuantities[rule.equipmentTypeId] || 0;
      if (chosen < rule.minQuantity) {
        setErrorMessage(
          `Mandatory minimum not reached: ${rule.equipmentName} requires at least ${rule.minQuantity} unit(s).`
        );
        return;
      }
      if (chosen > rule.availableQuantity) {
        setErrorMessage(
          `Not enough stock for ${rule.equipmentName}: ${chosen} requested, but only ${rule.availableQuantity} available for this slot.`
        );
        return;
      }
      if (user && user.score < 0 && chosen > rule.minQuantity) {
        setErrorMessage(
          `Negative score restriction: You cannot rent more than the mandatory minimum (${rule.minQuantity}) for ${rule.equipmentName}.`
        );
        return;
      }
    }

    const formattedEquipments = rules
      .map((rule) => ({
        equipmentTypeId: rule.equipmentTypeId,
        quantity: equipmentQuantities[rule.equipmentTypeId] || 0
      }))
      .filter((item) => item.quantity > 0);

    const calcEndTime = (sTime) => {
      const [h, m] = sTime.split(':').map(Number);
      const endH = String(h + 1).padStart(2, '0');
      return `${endH}:${String(m).padStart(2, '0')}`;
    };

    const reservationPayload = {
      facilityTypeId: selectedType,
      facilityId: assignmentMode === 'auto' ? 'auto' : selectedFacilityId,
      automaticFacilitySelection: assignmentMode === 'auto',
      bookingDate: bookingDate,
      startTime: timeSlot,
      endTime: calcEndTime(timeSlot),
      equipments: formattedEquipments
    };

    try {
      setSubmitting(true);
      const res = await API.createReservation(reservationPayload);
      if (setFeedback) {
        setFeedback({
          type: 'success',
          message: `Facility reserved successfully: ${res.facilityName || res.facilityId} on ${res.bookingDate} at ${res.startTime}-${res.endTime} (Booking #${res.reservationId}).`
        });
      }
      navigate('/reservations');
    } catch (err) {
      setErrorMessage(err.error || 'Reservation failed. Please check requirements.');
    } finally {
      setSubmitting(false);
    }
  };

  const availableCourtsOfSelectedType = allFacilities.filter(
    (f) => f.facilityTypeId === selectedType && f.isAvailable === 1
  );

  const availableTimeSlots = getAvailableTimeSlots(bookingDate);

  const isNegativeScore = user && user.score < 0;

  return (
    <Container className="pb-5">
      <div className="mb-4 bg-light p-4 rounded shadow-sm d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <h2 className="mb-1 fw-bold">New Facility & Equipment Reservation</h2>
          <p className="text-muted mb-0">
            Book sports facilities for a specific date and time slot with equipment rental
          </p>
        </div>
        <Button as={Link} to="/calendar" variant="outline-primary">
          <i className="bi bi-calendar3 me-1"></i> View Schedule Calendar
        </Button>
      </div>

      {errorMessage && (
        <Alert variant="danger" dismissible onClose={() => setErrorMessage('')}>
          {errorMessage}
        </Alert>
      )}

      {isNegativeScore && (
        <Alert variant="warning">
          <strong>Negative Score Restriction ({user.score}):</strong>
          <br />
          Because your personal score is negative, you can <strong>only book mandatory minimum equipment</strong>. Optional or extra equipment cannot be requested (users with negative score may still edit reservations, only to remove equipment, not to add them). You can reset your score back to 0 at any time by logging in with 2FA TOTP.
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Loading sports center options...</p>
        </div>
      ) : (
        <Form onSubmit={handleSubmit}>
          <Row className="g-4">
            {/* Step 1: Schedule & Facility Selection */}
            <Col xs={12} lg={5}>
              <Card className="shadow-sm border-0 h-100">
                <Card.Header className="bg-primary text-white py-3">
                  <h5 className="mb-0 fw-bold">Step 1: Date, Time & Facility</h5>
                </Card.Header>
                <Card.Body className="p-4">
                  {/* Date & Time Slot Row */}
                  <Row className="mb-4 g-2">
                    <Col xs={12} sm={6}>
                      <Form.Group controlId="bookingDateInput">
                        <Form.Label className="fw-semibold">Booking Date</Form.Label>
                        <Form.Control
                          type="date"
                          min={dayjs().format('YYYY-MM-DD')}
                          max={dayjs().add(14, 'day').format('YYYY-MM-DD')}
                          value={bookingDate}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            setLoadingRules(true);
                            setBookingDate(newDate);
                            const validSlots = getAvailableTimeSlots(newDate);
                            setTimeSlot((prevSlot) => {
                              if (validSlots.some((s) => s.start === prevSlot)) {
                                return prevSlot;
                              }
                              return validSlots.length > 0 ? validSlots[0].start : '';
                            });
                          }}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Form.Group controlId="timeSlotSelect">
                        <Form.Label className="fw-semibold">Time Slot</Form.Label>
                        <Form.Select
                          value={timeSlot}
                          disabled={availableTimeSlots.length === 0}
                          onChange={(e) => {
                            setLoadingRules(true);
                            setTimeSlot(e.target.value);
                          }}
                        >
                          {availableTimeSlots.length === 0 ? (
                            <option value="">No future slots available today</option>
                          ) : (
                            availableTimeSlots.map((slot) => (
                              <option key={slot.start} value={slot.start}>
                                {slot.label}
                              </option>
                            ))
                          )}
                        </Form.Select>
                        {availableTimeSlots.length === 0 && (
                          <Form.Text className="text-danger small">
                            All time slots for today have already started. Please select a future date.
                          </Form.Text>
                        )}
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Sports facility type */}
                  <Form.Group className="mb-4" controlId="facilityTypeSelect">
                    <Form.Label className="fw-semibold">Sports Facility Type</Form.Label>
                    <Form.Select
                      size="lg"
                      value={selectedType}
                      onChange={(e) => {
                        setLoadingRules(true);
                        setSelectedType(e.target.value);
                      }}
                    >
                      {facilityTypes.map((ft) => (
                        <option key={ft.id} value={ft.id}>
                          {ft.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>

                  {/* Assignment mode */}
                  <Form.Group className="mb-4">
                    <Form.Label className="fw-semibold">Facility Assignment Mode</Form.Label>
                    <div className="d-flex flex-column gap-2 border p-3 rounded bg-light">
                      <Form.Check
                        type="radio"
                        id="mode-auto"
                        name="assignmentMode"
                        label="Automatic assignment (system picks first free court)"
                        checked={assignmentMode === 'auto'}
                        onChange={() => setAssignmentMode('auto')}
                      />
                      <Form.Check
                        type="radio"
                        id="mode-manual"
                        name="assignmentMode"
                        label="Manual selection (choose specific court from list)"
                        checked={assignmentMode === 'manual'}
                        onChange={() => setAssignmentMode('manual')}
                      />
                    </div>
                  </Form.Group>

                  {/* Specific court selection */}
                  {assignmentMode === 'manual' && (
                    <Form.Group className="mb-3" controlId="specificCourtSelect">
                      <Form.Label className="fw-semibold">Select Specific Court/Field</Form.Label>
                      {availableCourtsOfSelectedType.length === 0 ? (
                        <Alert variant="danger" className="py-2 small">
                          No courts are available for this slot ({bookingDate} at {timeSlot}). Please choose another slot or sport.
                        </Alert>
                      ) : (
                        <Form.Select
                          value={selectedFacilityId}
                          onChange={(e) => setSelectedFacilityId(e.target.value)}
                        >
                          {availableCourtsOfSelectedType.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name} (Code: {f.id})
                            </option>
                          ))}
                        </Form.Select>
                      )}
                    </Form.Group>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* Step 2: Equipment Rental Configuration */}
            <Col xs={12} lg={7}>
              <Card className="shadow-sm border-0 h-100">
                <Card.Header className="bg-primary text-white py-3">
                  <h5 className="mb-0 fw-bold">Step 2: Equipment Rental Configuration</h5>
                </Card.Header>
                <Card.Body className="p-4">
                  <p className="text-muted small mb-3">
                    Renting mandatory equipment is required. Stock availability is calculated dynamically for <strong>{bookingDate} at {timeSlot}</strong>.
                  </p>

                  {loadingRules ? (
                    <div className="text-center py-4">
                      <Spinner animation="border" size="sm" />
                      <span className="ms-2 text-muted">Loading equipment availability...</span>
                    </div>
                  ) : (
                    <Table responsive bordered hover className="align-middle mb-4">
                      <thead className="table-light">
                        <tr>
                          <th>Equipment</th>
                          <th className="text-center">Required Min</th>
                          <th className="text-center">Available Stock</th>
                          <th className="text-center" style={{ width: '170px' }}>
                            Quantity to Rent
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rules.map((rule) => {
                          const isMandatory = rule.minQuantity > 0;
                          const currentQty = equipmentQuantities[rule.equipmentTypeId] || 0;
                          const canIncrease =
                            currentQty < rule.availableQuantity &&
                            (!isNegativeScore || (isMandatory && currentQty < rule.minQuantity));
                          const canDecrease = currentQty > rule.minQuantity;

                          return (
                            <tr key={rule.equipmentTypeId}>
                              <td>
                                <div className="fw-semibold">{rule.equipmentName}</div>
                                <div>
                                  {isMandatory ? (
                                    <Badge bg="danger" className="me-1">
                                      Mandatory
                                    </Badge>
                                  ) : (
                                    <Badge bg="secondary" className="me-1">
                                      Optional
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td className="text-center fw-bold">{rule.minQuantity}</td>
                              <td className="text-center">
                                <Badge
                                  bg={rule.availableQuantity > 0 ? 'success' : 'danger'}
                                  className="fs-6 px-2"
                                >
                                  {rule.availableQuantity} / {rule.totalQuantity}
                                </Badge>
                              </td>
                              <td>
                                <div className="d-flex justify-content-center align-items-center gap-2">
                                  <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    disabled={!canDecrease || submitting}
                                    onClick={() =>
                                      handleQuantityChange(rule.equipmentTypeId, currentQty - 1)
                                    }
                                  >
                                    -
                                  </Button>
                                  <span className="fw-bold px-2 fs-5" style={{ minWidth: '35px', textAlign: 'center' }}>
                                    {currentQty}
                                  </span>
                                  <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    disabled={!canIncrease || submitting}
                                    onClick={() =>
                                      handleQuantityChange(rule.equipmentTypeId, currentQty + 1)
                                    }
                                  >
                                    +
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  )}

                  <div className="d-grid gap-2 mt-auto">
                    <Button
                      variant="primary"
                      type="submit"
                      size="lg"
                      disabled={
                        submitting ||
                        !timeSlot ||
                        availableTimeSlots.length === 0 ||
                        (assignmentMode === 'manual' && !selectedFacilityId)
                      }
                    >
                      {submitting ? 'Confirming Reservation...' : 'Confirm & Reserve Facility'}
                    </Button>
                    <Button as={Link} to="/reservations" variant="outline-secondary">
                      Cancel
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Form>
      )}
    </Container>
  );
}

export default NewReservationView;