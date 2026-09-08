import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Table, Badge, Alert, Spinner } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import API from '../services/API';

function NewReservationView({ user, setFeedback }) {
  const [facilityTypes, setFacilityTypes] = useState([]);
  const [allFacilities, setAllFacilities] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [assignmentMode, setAssignmentMode] = useState('auto'); // 'auto' | 'manual'
  const [selectedFacilityId, setSelectedFacilityId] = useState('');

  // equipment rules and chosen quantities
  const [rules, setRules] = useState([]);
  const [equipmentQuantities, setEquipmentQuantities] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadingRules, setLoadingRules] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    let ignore = false;
    Promise.all([API.getFacilityTypes(), API.getAllFacilities()])
      .then(([types, facilities]) => {
        if (!ignore) {
          setFacilityTypes(types || []);
          setAllFacilities(facilities || []);
          if (types && types.length > 0) {
            setSelectedType(types[0].id);
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
  }, []);

  useEffect(() => {
    if (!selectedType) return;
    let ignore = false;

    API.getFacilityRules(selectedType)
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
            setSelectedFacilityId(availableOfThisType[0].id);
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
  }, [selectedType, allFacilities]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!selectedType) {
      setErrorMessage('Please select a facility type.');
      return;
    }

    if (assignmentMode === 'manual' && !selectedFacilityId) {
      setErrorMessage('Please select an available court/field from the list.');
      return;
    }

    const equipmentsPayload = Object.entries(equipmentQuantities).map(([equipmentTypeId, quantity]) => ({
      equipmentTypeId,
      quantity: parseInt(quantity, 10) || 0
    }));

    const payload = {
      facilityTypeId: selectedType,
      facilityId: assignmentMode === 'manual' ? selectedFacilityId : 'auto',
      automaticFacilitySelection: assignmentMode === 'auto' ? 1 : 0,
      equipments: equipmentsPayload
    };

    try {
      setSubmitting(true);
      const res = await API.createReservation(payload);
      if (setFeedback) {
        setFeedback({
          type: 'success',
          message: `Facility reserved successfully: ${res.facilityName || res.facilityId} (Booking #${res.reservationId}).`
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

  const isNegativeScore = user && user.score < 0;

  return (
    <Container className="pb-5">
      <div className="mb-4 bg-light p-4 rounded shadow-sm">
        <h2 className="mb-1 fw-bold">New Facility & Equipment Reservation</h2>
        <p className="text-muted mb-0">
          Book sports facilities and configure your mandatory and optional equipment rental
        </p>
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
            {/* facility selection */}
            <Col xs={12} lg={5}>
              <Card className="shadow-sm border-0 h-100">
                <Card.Header className="bg-primary text-white py-3">
                  <h5 className="mb-0 fw-bold">Step 1: Choose Facility</h5>
                </Card.Header>
                <Card.Body className="p-4">
                  {/* facility type */}
                  <Form.Group className="mb-4" controlId="facilityTypeSelect">
                    <Form.Label className="fw-semibold">Sports Facility Type</Form.Label>
                    <Form.Select
                      size="lg"
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                    >
                      {facilityTypes.map((ft) => (
                        <option key={ft.id} value={ft.id}>
                          {ft.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>

                  {/* assignment mode */}
                  <Form.Group className="mb-4">
                    <Form.Label className="fw-semibold">Facility Assignment Mode</Form.Label>
                    <div className="d-flex flex-column gap-2 border p-3 rounded bg-light">
                      <Form.Check
                        type="radio"
                        id="mode-auto"
                        name="assignmentMode"
                        label="Automatic assignment (system picks first available facility)"
                        checked={assignmentMode === 'auto'}
                        onChange={() => setAssignmentMode('auto')}
                      />
                      <Form.Check
                        type="radio"
                        id="mode-manual"
                        name="assignmentMode"
                        label="Manual selection (choose specific facility from list)"
                        checked={assignmentMode === 'manual'}
                        onChange={() => setAssignmentMode('manual')}
                      />
                    </div>
                  </Form.Group>

                  {/* specific court selection */}
                  {assignmentMode === 'manual' && (
                    <Form.Group className="mb-3" controlId="specificCourtSelect">
                      <Form.Label className="fw-semibold">Select Specific Court/Field</Form.Label>
                      {availableCourtsOfSelectedType.length === 0 ? (
                        <Alert variant="danger" className="py-2 small">
                          No courts are currently available for this facility type.
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

            {/* equipment selection */}
            <Col xs={12} lg={7}>
              <Card className="shadow-sm border-0 h-100">
                <Card.Header className="bg-primary text-white py-3">
                  <h5 className="mb-0 fw-bold">Step 2: Equipment Rental Configuration</h5>
                </Card.Header>
                <Card.Body className="p-4">
                  <p className="text-muted small mb-3">
                    Renting mandatory equipment is required. Additional and optional units can be selected according to availability and user score
                  </p>

                  {loadingRules ? (
                    <div className="text-center py-4">
                      <Spinner animation="border" size="sm" />
                      <span className="ms-2 text-muted">Loading equipment requirements...</span>
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
                          const selectedQty = equipmentQuantities[rule.equipmentTypeId] ?? rule.minQuantity;
                          const maxAvailable = rule.availableQuantity;

                          return (
                            <tr key={rule.equipmentTypeId}>
                              <td>
                                <strong>{rule.equipmentName}</strong>{' '}
                                {isMandatory ? (
                                  <Badge bg="danger" className="ms-1">
                                    Mandatory (min {rule.minQuantity})
                                  </Badge>
                                ) : (
                                  <Badge bg="secondary" className="ms-1">
                                    Optional
                                  </Badge>
                                )}
                              </td>
                              <td className="text-center">{rule.minQuantity}</td>
                              <td className="text-center">
                                <span
                                  className={
                                    rule.availableQuantity < rule.minQuantity
                                      ? 'text-danger fw-bold'
                                      : 'text-success fw-bold'
                                  }
                                >
                                  {rule.availableQuantity}
                                </span>{' '}
                                in center
                              </td>
                              <td className="text-center">
                                <div className="d-flex justify-content-center align-items-center gap-1">
                                  <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    disabled={selectedQty <= rule.minQuantity || isNegativeScore}
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
                                      (isNegativeScore && selectedQty >= rule.minQuantity)
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

                  <div className="d-grid gap-2">
                    <Button
                      variant="success"
                      type="submit"
                      size="lg"
                      className="fw-bold"
                      disabled={submitting || loadingRules}
                    >
                      Complete & Confirm Booking
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