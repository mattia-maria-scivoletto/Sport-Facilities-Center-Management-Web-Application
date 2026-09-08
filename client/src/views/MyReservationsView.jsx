import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Badge, Spinner, Alert, Modal } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import API from '../services/API';
import EditReservationModal from '../components/EditReservationModal';

function MyReservationsView({ user, setUser, setFeedback }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const [reservationToCancel, setReservationToCancel] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchReservations = () => {
    setLoading(true);
    setError(null);
    API.getUserReservations()
      .then((data) => {
        setReservations(data || []);
      })
      .catch((err) => {
        setError(err.error || 'Failed to load your reservations.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let ignore = false;
    API.getUserReservations()
      .then((data) => {
        if (!ignore) {
          setReservations(data || []);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.error || 'Failed to load your reservations.');
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
  }, []);

  const handleOpenEdit = (res) => {
    setSelectedReservation(res);
    setShowEditModal(true);
  };

  const handleSavedEdit = (msg) => {
    if (setFeedback) {
      setFeedback({ type: 'success', message: msg });
    }
    fetchReservations();
  };

  const handleOpenCancel = (res) => {
    setReservationToCancel(res);
  };

  const handleConfirmCancel = async () => {
    if (!reservationToCancel) return;

    try {
      setCancelling(true);
      const res = await API.deleteReservation(reservationToCancel.reservationId);

      if (setUser && res.newScore !== undefined) {
        setUser((prev) => ({ ...prev, score: res.newScore }));
      }

      if (setFeedback) {
        setFeedback({
          type: 'warning',
          message: `Booking cancelled. Your score was reduced by 1 (Current score: ${res.newScore}). 30-second cooldown active on ${reservationToCancel.typeName}.`
        });
      }

      setReservationToCancel(null);
      fetchReservations();
    } catch (err) {
      setError(err.error || 'Failed to cancel reservation.');
      setReservationToCancel(null);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Container className="pb-5">
      {/* header banner */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3 bg-light p-4 rounded shadow-sm">
        <div>
          <h2 className="mb-1 fw-bold">My Reservations</h2>
          <p className="text-muted mb-0">
            Manage your booked facilities and adjust rental sports equipment
          </p>
        </div>
        <div>
          <Button as={Link} to="/new-reservation" variant="primary" className="fw-semibold">
            + Book Another Facility
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Loading your bookings...</p>
        </div>
      ) : reservations.length === 0 ? (
        <Card className="text-center py-5 shadow-sm border-0">
          <Card.Body>
            <h4 className="text-muted mb-3">You have no active facility bookings</h4>
            <p className="text-muted mb-4">
              Explore available sports facilities and reserve one with your required rental equipment
            </p>
            <Button as={Link} to="/new-reservation" variant="primary" size="lg">
              + Make Your First Reservation
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Row xs={1} md={2} className="g-4">
          {reservations.map((r) => {
            return (
              <Col key={r.reservationId}>
                <Card className="h-100 shadow-sm border-primary" style={{ borderWidth: '2px' }}>
                  <Card.Header className="bg-primary text-white d-flex justify-content-between align-items-center py-3">
                    <h5 className="mb-0 fw-bold">
                      {r.facilityName}
                    </h5>
                    <Badge bg="light" text="dark" className="fs-6">
                      Code: {r.facilityId}
                    </Badge>
                  </Card.Header>

                  <Card.Body>
                    <div className="mb-3">
                      <span className="text-muted small">Facility Type: </span>
                      <strong>{r.typeName}</strong>
                      <span className="text-muted small ms-3">Booking ID: </span>
                      <code>#{r.reservationId}</code>
                    </div>

                    <h6 className="fw-bold mb-2 text-secondary">Reserved Equipment:</h6>
                    {r.equipments && r.equipments.length > 0 ? (
                      <div className="d-flex flex-column gap-2 mb-3">
                        {r.equipments.map((eq) => (
                          <div
                            key={eq.equipmentTypeId}
                            className="d-flex justify-content-between align-items-center bg-light p-2 rounded border"
                          >
                            <div>
                              <strong>{eq.equipmentName}</strong>
                              {eq.isMandatory && (
                                <Badge bg="danger" className="ms-2 small">
                                  Mandatory (min {eq.minQuantity})
                                </Badge>
                              )}
                            </div>
                            <Badge bg="primary" className="fs-6">
                              Qty: {eq.quantity}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted small">No equipment allocated.</p>
                    )}
                  </Card.Body>

                  <Card.Footer className="bg-white border-top-0 d-flex justify-content-between gap-2 pb-3">
                    <Button variant="outline-primary" onClick={() => handleOpenEdit(r)}>
                      Edit Equipment
                    </Button>
                    <Button variant="outline-danger" onClick={() => handleOpenCancel(r)}>
                      Cancel Booking
                    </Button>
                  </Card.Footer>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}

      {/* edit equipment modal */}
      {selectedReservation && (
        <EditReservationModal
          show={showEditModal}
          handleClose={() => setShowEditModal(false)}
          reservation={selectedReservation}
          user={user}
          onSaved={handleSavedEdit}
        />
      )}

      {/* cancel confirmation modal */}
      <Modal
        show={!!reservationToCancel}
        onHide={() => setReservationToCancel(null)}
        centered
      >
        <Modal.Header closeButton className="bg-danger text-white">
          <Modal.Title className="fw-bold">
            Confirm Reservation Cancellation
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            Are you sure you want to cancel your booking for{' '}
            <strong>{reservationToCancel?.facilityName} ({reservationToCancel?.facilityId})</strong>?
          </p>
          <Alert variant="warning" className="small mb-0">
            <strong>Consequences of cancellation:</strong>
            <ul className="ps-3 mb-0 mt-1">
              <li>
                Your personal score will be <strong>reduced by 1</strong> (Penalty for cancelling).
              </li>
              <li>
                You will NOT be allowed to re-book any <strong>{reservationToCancel?.typeName}</strong> facility for <strong>30 seconds</strong>.
              </li>
              <li>Facility and equipment will be immediately returned to the public pool.</li>
            </ul>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setReservationToCancel(null)} disabled={cancelling}>
            Keep Reservation
          </Button>
          <Button variant="danger" onClick={handleConfirmCancel} disabled={cancelling}>
            {cancelling ? 'Cancelling...' : 'Confirm & Cancel Booking'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}

export default MyReservationsView;