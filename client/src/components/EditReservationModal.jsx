import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Badge, Alert, Spinner } from 'react-bootstrap';
import API from '../services/API';

function EditReservationModal({ show, handleClose, reservation, user, onSaved }) {
  const [rules, setRules] = useState([]);
  const [equipmentQuantities, setEquipmentQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!show || !reservation) return;
    let ignore = false;

    API.getFacilityRules(reservation.facilityTypeId)
      .then((facilityRules) => {
        if (!ignore) {
          setRules(facilityRules || []);
          const initialQty = {};
          for (const r of facilityRules || []) {
            const existing = reservation.equipments?.find((e) => e.equipmentTypeId === r.equipmentTypeId);
            initialQty[r.equipmentTypeId] = existing ? existing.quantity : r.minQuantity;
          }
          setEquipmentQuantities(initialQty);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMessage(err.error || 'Failed to load equipment rules for this reservation.');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [show, reservation]);

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
    try {
      setSubmitting(true);
      setErrorMessage('');

      const equipmentsPayload = Object.entries(equipmentQuantities).map(([equipmentTypeId, quantity]) => ({
        equipmentTypeId,
        quantity: parseInt(quantity, 10) || 0
      }));

      await API.updateReservationEquipment(reservation.reservationId, equipmentsPayload);
      onSaved('Reservation equipment updated successfully.');
      handleClose();
    } catch (err) {
      setErrorMessage(err.error || 'Failed to update equipment quantities.');
    } finally {
      setSubmitting(false);
    }
  };

  const isNegativeScore = user && user.score < 0;

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton className="bg-light">
        <Modal.Title className="fw-bold">
          Modify Equipment - Booking #{reservation?.reservationId}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {reservation && (
          <div className="mb-3 text-muted small">
            <strong>Facility:</strong> {reservation.facilityName} ({reservation.facilityId}) |{' '}
            <strong>Type:</strong> {reservation.typeName}
          </div>
        )}

        {isNegativeScore && (
          <Alert variant="warning" className="small">
            <strong>Negative Score ({user.score}):</strong> You may edit this reservation to remove or decrease equipment, but adding extra items is not allowed.
          </Alert>
        )}

        {errorMessage && (
          <Alert variant="danger" dismissible onClose={() => setErrorMessage('')}>
            {errorMessage}
          </Alert>
        )}

        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="text-muted mt-2">Loading equipment inventory...</p>
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
                const maxAvailable = currentHold + rule.availableQuantity;
                const selectedQty = equipmentQuantities[rule.equipmentTypeId] ?? rule.minQuantity;

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
                      <span className="text-success fw-bold">+{rule.availableQuantity}</span> in center
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
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={submitting || loading}>
          {submitting ? 'Saving...' : 'Save Equipment Changes'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default EditReservationModal;