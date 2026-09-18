import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Table,
  Badge,
  Alert,
  Spinner,
  Row,
  Col,
  Form
} from 'react-bootstrap';
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

function EditReservationModal({ show, handleClose, reservation, user, onSaved }) {
  const [bookingDate, setBookingDate] = useState(
    reservation?.bookingDate || dayjs().format('YYYY-MM-DD')
  );
  const [timeSlot, setTimeSlot] = useState(reservation?.startTime || '10:00');
  const [facilityId, setFacilityId] = useState(reservation?.facilityId || '');
  const [availableFacilities, setAvailableFacilities] = useState([]);
  const [rules, setRules] = useState([]);
  const [equipmentQuantities, setEquipmentQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load facilities and equipment rules whenever date or time slot changes
  useEffect(() => {
    if (!reservation || !bookingDate || !timeSlot) return;

    let ignore = false;

    Promise.all([
      API.getAllFacilities(bookingDate, timeSlot),
      API.getFacilityRules(reservation.facilityTypeId, bookingDate, timeSlot)
    ])
      .then(([facilitiesData, rulesData]) => {
        if (!ignore) {
          const courts = (facilitiesData || []).filter(
            (f) => f.facilityTypeId === reservation.facilityTypeId
          );
          setAvailableFacilities(courts);

          // Determine selected facility
          const isSameSlot =
            bookingDate === reservation.bookingDate && timeSlot === reservation.startTime;

          const currentCourtAvailable = courts.some(
            (c) =>
              c.id === reservation.facilityId &&
              (c.isAvailable === 1 || isSameSlot) &&
              c.isMaintenance !== 1
          );

          setFacilityId((prev) => {
            if (
              prev &&
              courts.some(
                (c) =>
                  c.id === prev &&
                  (c.isAvailable === 1 || (isSameSlot && c.id === reservation.facilityId)) &&
                  c.isMaintenance !== 1
              )
            ) {
              return prev;
            }
            if (currentCourtAvailable) {
              return reservation.facilityId;
            }
            const firstFree = courts.find((c) => c.isAvailable === 1 && c.isMaintenance !== 1);
            return firstFree ? firstFree.id : '';
          });

          // Setup rules and initialize equipment quantities
          setRules(rulesData || []);
          setEquipmentQuantities((prev) => {
            const nextQty = {};
            for (const r of rulesData || []) {
              const prevHeld =
                prev[r.equipmentTypeId] !== undefined
                  ? prev[r.equipmentTypeId]
                  : reservation.equipments?.find((e) => e.equipmentTypeId === r.equipmentTypeId)?.quantity;

              nextQty[r.equipmentTypeId] =
                prevHeld !== undefined ? Math.max(prevHeld, r.minQuantity) : r.minQuantity;
            }
            return nextQty;
          });

          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMessage(err.error || 'Failed to load availability for the selected schedule.');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [reservation, bookingDate, timeSlot]);

  const handleQuantityChange = (equipmentTypeId, newQty, minQty, maxQty) => {
    let val = parseInt(newQty, 10);
    if (isNaN(val)) val = minQty;
    if (val < minQty) val = minQty;
    if (val > maxQty) val = maxQty;

    setEquipmentQuantities((prev) => ({
      ...prev,
      [equipmentTypeId]: val
    }));
  };

  const handleSave = async () => {
    if (!facilityId) {
      setErrorMessage('Please select an available court or field for this time slot.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage('');

      const equipmentsPayload = Object.entries(equipmentQuantities).map(([equipmentTypeId, quantity]) => ({
        equipmentTypeId,
        quantity: parseInt(quantity, 10) || 0
      }));

      const payload = {
        bookingDate,
        startTime: timeSlot,
        facilityId,
        equipments: equipmentsPayload
      };

      const res = await API.updateReservation(reservation.reservationId, payload);
      let successMsg = 'Reservation schedule and equipment updated successfully.';
      if (res.costDelta > 0) {
        successMsg += ` (Additional ${res.costDelta} credits deducted).`;
      } else if (res.costDelta < 0) {
        successMsg += ` (${Math.abs(res.costDelta)} credits refunded).`;
      }
      onSaved(successMsg, res);
      handleClose();
    } catch (err) {
      setErrorMessage(err.error || 'Failed to update reservation.');
    } finally {
      setSubmitting(false);
    }
  };

  const isNegativeScore = user && user.score < 0;
  const isSameSlot =
    reservation &&
    bookingDate === reservation.bookingDate &&
    timeSlot === reservation.startTime;

  const originalCost = reservation?.totalCost ?? 0;
  const baseCourtFee = reservation?.basePrice ?? 10;
  let equipmentRentalFee = 0;
  for (const r of rules) {
    const qty = equipmentQuantities[r.equipmentTypeId] || 0;
    const unitPrice = r.unitPrice ?? 2;
    equipmentRentalFee += qty * unitPrice;
  }
  const newTotalCost = baseCourtFee + equipmentRentalFee;
  const costDelta = newTotalCost - originalCost;
  const userBalance = user?.walletBalance ?? 0;
  const hasEnoughForDelta = costDelta <= 0 || userBalance >= costDelta;

  // Filter available time slots if date is today
  const isToday = dayjs(bookingDate).isSame(dayjs(), 'day');
  const availableTimeSlots = TIME_SLOTS.map((slot) => {
    if (!isToday) return { ...slot, disabled: false };
    const slotDateTime = dayjs(`${bookingDate}T${slot.start}`);
    const isPast = slotDateTime.isBefore(dayjs());
    const isOriginalSlot = isSameSlot && slot.start === reservation?.startTime;
    return { ...slot, disabled: isPast && !isOriginalSlot };
  });

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton className="bg-light">
        <Modal.Title className="fw-bold">
          Edit Reservation - Booking #{reservation?.reservationId}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-4">
        {reservation && (
          <div className="mb-3 p-3 bg-light rounded border d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <span className="text-muted small d-block">Sport Discipline</span>
              <strong className="fs-6">{reservation.typeName}</strong>
            </div>
            <div>
              <span className="text-muted small d-block">Original Booking</span>
              <span>
                <i className="bi bi-calendar3 me-1"></i> {reservation.bookingDate} at {reservation.startTime} - {reservation.endTime} ({reservation.facilityName})
              </span>
            </div>
          </div>
        )}

        {isNegativeScore && (
          <Alert variant="warning" className="small mb-3">
            <strong>Negative Score ({user.score}):</strong> You may keep or decrease equipment, but adding extra items or optional equipment is not allowed.
          </Alert>
        )}

        {errorMessage && (
          <Alert variant="danger" dismissible onClose={() => setErrorMessage('')} className="mb-3">
            {errorMessage}
          </Alert>
        )}

        {/* Section 1: Date, Time Slot & Court Selection */}
        <h6 className="fw-bold text-primary mb-3">
          <i className="bi bi-calendar-event me-2"></i>Schedule & Court Assignment
        </h6>
        <Row className="g-3 mb-4">
          <Col xs={12} sm={4}>
            <Form.Group controlId="editBookingDate">
              <Form.Label className="fw-semibold small">Booking Date</Form.Label>
              <Form.Control
                type="date"
                min={dayjs().format('YYYY-MM-DD')}
                max={dayjs().add(14, 'day').format('YYYY-MM-DD')}
                value={bookingDate}
                onChange={(e) => {
                  setLoading(true);
                  setBookingDate(e.target.value);
                }}
                required
              />
            </Form.Group>
          </Col>
          <Col xs={12} sm={4}>
            <Form.Group controlId="editTimeSlot">
              <Form.Label className="fw-semibold small">Time Slot</Form.Label>
              <Form.Select
                value={timeSlot}
                onChange={(e) => {
                  setLoading(true);
                  setTimeSlot(e.target.value);
                }}
              >
                {availableTimeSlots.map((slot) => (
                  <option key={slot.start} value={slot.start} disabled={slot.disabled}>
                    {slot.label} {slot.disabled ? '(Past)' : ''}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col xs={12} sm={4}>
            <Form.Group controlId="editFacilitySelect">
              <Form.Label className="fw-semibold small">Court / Field</Form.Label>
              <Form.Select
                value={facilityId}
                disabled={loading || availableFacilities.length === 0}
                onChange={(e) => setFacilityId(e.target.value)}
              >
                {availableFacilities.map((court) => {
                  const isOriginal = isSameSlot && court.id === reservation?.facilityId;
                  const isAvailable = court.isAvailable === 1 || isOriginal;
                  const isMaint = court.isMaintenance === 1;

                  let label = court.name;
                  if (isOriginal) label += ' (Current Court)';
                  else if (isMaint) label += ' (Under Maintenance)';
                  else if (!isAvailable) label += ' (Booked)';
                  else label += ' (Available)';

                  return (
                    <option key={court.id} value={court.id} disabled={!isAvailable || isMaint}>
                      {label}
                    </option>
                  );
                })}
              </Form.Select>
              {availableFacilities.length === 0 && !loading && (
                <Form.Text className="text-danger small">
                  No courts available for this slot.
                </Form.Text>
              )}
            </Form.Group>
          </Col>
        </Row>

        {/* Section 2: Equipment Rental Configuration */}
        <h6 className="fw-bold text-primary mb-3">
          <i className="bi bi-box-seam me-2"></i>Equipment Rental Stock & Quantities
        </h6>

        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="text-muted mt-2 small">Loading court and equipment inventory...</p>
          </div>
        ) : (
          <Table responsive bordered hover className="align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Equipment Item</th>
                <th className="text-center">Required Min</th>
                <th className="text-center">Available Stock</th>
                <th className="text-center" style={{ width: '180px' }}>
                  Your Quantity
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const isMandatory = rule.minQuantity > 0;
                const currentHold =
                  reservation?.equipments?.find((e) => e.equipmentTypeId === rule.equipmentTypeId)?.quantity || 0;
                const maxAvailable = isSameSlot
                  ? currentHold + rule.availableQuantity
                  : rule.availableQuantity;
                const selectedQty = equipmentQuantities[rule.equipmentTypeId] ?? rule.minQuantity;

                return (
                  <tr key={rule.equipmentTypeId}>
                    <td>
                      <strong>{rule.equipmentName}</strong>{' '}
                      {isMandatory ? (
                        <Badge bg="danger" className="ms-1">
                          mandatory
                        </Badge>
                      ) : (
                        <Badge bg="secondary" className="ms-1">
                          optional
                        </Badge>
                      )}
                    </td>
                    <td className="text-center">{rule.minQuantity}</td>
                    <td className="text-center">
                      <span className="text-success fw-bold">{rule.availableQuantity}</span> in center
                    </td>
                    <td className="text-center">
                      <div className="d-flex justify-content-center align-items-center gap-1">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          disabled={selectedQty <= rule.minQuantity}
                          onClick={() =>
                            handleQuantityChange(
                              rule.equipmentTypeId,
                              selectedQty - 1,
                              rule.minQuantity,
                              maxAvailable
                            )
                          }
                        >
                          -
                        </Button>
                        <span className="px-2 fw-bold fs-6" style={{ minWidth: '35px' }}>
                          {selectedQty}
                        </span>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          disabled={
                            selectedQty >= maxAvailable ||
                            (isNegativeScore && selectedQty >= currentHold)
                          }
                          onClick={() =>
                            handleQuantityChange(
                              rule.equipmentTypeId,
                              selectedQty + 1,
                              rule.minQuantity,
                              maxAvailable
                            )
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

        {/* Cost Adjustment Summary */}
        <div className="mt-3 p-3 bg-light rounded border">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span className="small text-muted">Original Booking Fee:</span>
            <span className="fw-semibold">{originalCost} credits</span>
          </div>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="small text-muted">New Booking Fee:</span>
            <span className="fw-semibold">{newTotalCost} credits</span>
          </div>
          <hr className="my-2" />
          <div className="d-flex justify-content-between align-items-center">
            <span className="fw-bold small">Cost Adjustment:</span>
            {costDelta > 0 ? (
              <span className="fw-bold text-danger">+{costDelta} credits (will be deducted)</span>
            ) : costDelta < 0 ? (
              <span className="fw-bold text-success">{costDelta} credits (will be refunded)</span>
            ) : (
              <span className="fw-bold text-muted">No difference (0 credits)</span>
            )}
          </div>
          {!hasEnoughForDelta && (
            <Alert variant="danger" className="mt-2 mb-0 py-1 small">
              Insufficient credits: You need {costDelta} additional credits, but only have {userBalance} credits.
            </Alert>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={submitting || loading || !facilityId || !hasEnoughForDelta}
        >
          {submitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default EditReservationModal;