import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Button, Spinner, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import API from '../services/API';

function PublicView({ loggedIn }) {
  const [facilities, setFacilities] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAvailability = () => {
    setLoading(true);
    setError(null);
    API.getPublicAvailability()
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
    API.getPublicAvailability()
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
  }, []);

  return (
    <Container className="pb-5">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3 bg-light p-4 rounded shadow-sm">
        <div>
          <h2 className="mb-1 fw-bold">Sports Center Availability</h2>
          <p className="text-muted mb-0">
            View currently available sports courts, fields, tracks, and rental equipment inventory
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={fetchAvailability} disabled={loading}>
            {loading ? <Spinner animation="border" size="sm" /> : 'Refresh Status'}
          </Button>
          <Button
            as={Link}
            to={loggedIn ? '/new-reservation' : '/login'}
            variant="primary"
            className="fw-semibold"
          >
            + Reserve a Facility
          </Button>
        </div>
      </div>

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
          {/* facilities section */}
          <div className="mb-5">
            <h4 className="fw-bold mb-3">Sports Facilities Status</h4>
            <Row xs={1} md={2} lg={3} className="g-4">
              {facilities.map((fac) => {
                const isFullyBooked = fac.availableCount === 0;

                return (
                  <Col key={fac.typeId}>
                    <Card
                      className={`h-100 shadow-sm border-${
                        isFullyBooked ? 'secondary' : 'success'
                      }`}
                      style={{ borderWidth: '2px', overflow: 'hidden' }}
                    >
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <Card.Title className="fw-bold mb-0">
                            {fac.typeName}
                          </Card.Title>
                          <Badge bg={isFullyBooked ? 'secondary' : 'success'}>
                            {fac.availableCount} / {fac.totalCount} Available
                          </Badge>
                        </div>

                        <Card.Text className="text-muted small mb-3">
                          Total capacity: {fac.totalCount} {fac.totalCount === 1 ? 'facility' : 'facilities'}
                        </Card.Text>

                        <div>
                          <div className="small fw-semibold text-secondary mb-1">Courts / Fields:</div>
                          <div className="d-flex flex-wrap gap-1">
                            {fac.facilityCodes &&
                              fac.facilityCodes.map((f) => (
                                <Badge
                                  key={f.code}
                                  bg={f.isBooked ? 'light' : 'success'}
                                  text={f.isBooked ? 'muted' : 'light'}
                                  className="border"
                                  style={{
                                    textDecoration: f.isBooked ? 'line-through' : 'none',
                                    fontSize: '0.85rem',
                                    padding: '5px 8px'
                                  }}
                                  title={f.isBooked ? `${f.code}: Currently Reserved` : `${f.code}: Available`}
                                >
                                  {f.code} {f.isBooked ? '(Booked)' : '(Free)'}
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

          {/* equipment section */}
          <div>
            <h4 className="fw-bold mb-3">Equipment Availabilities</h4>
            <Card className="shadow-sm">
              <Table responsive hover className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Equipment</th>
                    <th className="text-center">Available Quantity</th>
                    <th className="text-center">Total Quantity</th>
                    <th className="text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {equipment.map((item) => {
                    const isOut = item.availableQuantity === 0;
                    const isLow = item.availableQuantity > 0 && item.availableQuantity <= 2;

                    return (
                      <tr key={item.id}>
                        <td className="fw-semibold">{item.name}</td>
                        <td className="text-center">
                          <strong
                            className={
                              isOut ? 'text-danger' : isLow ? 'text-warning' : 'text-success'
                            }
                          >
                            {item.availableQuantity}
                          </strong>
                        </td>
                        <td className="text-center text-muted">{item.totalQuantity}</td>
                        <td className="text-center">
                          <Badge bg={isOut ? 'danger' : isLow ? 'warning' : 'success'} text={isLow ? 'dark' : 'light'}>
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'Available'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
          </div>
        </>
      )}
    </Container>
  );
}

export default PublicView;