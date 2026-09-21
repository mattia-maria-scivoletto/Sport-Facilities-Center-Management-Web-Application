import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import API from '../services/API';

function TotpView({ user, setUser, setFeedback }) {
  const [totpCode, setTotpCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleValidate = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanCode = totpCode.trim();
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setErrorMessage('Please enter a valid 6-digit numerical TOTP code.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await API.totpVerify(cleanCode);
      if (setUser && res.user) {
        setUser(res.user);
      }
      if (setFeedback) {
        setFeedback({
          type: 'success',
          message: '2FA authentication successful. Your personal score has been reset to 0.'
        });
      }
      navigate('/reservations');
    } catch (err) {
      setErrorMessage(err.error || 'Invalid or expired TOTP code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (setFeedback) {
      setFeedback({
        type: 'info',
        message: 'Proceeding with standard 1-Factor session. Score remains unchanged.'
      });
    }
    navigate('/reservations');
  };

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col xs={12} md={8} lg={6}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-info text-dark py-3">
              <h4 className="mb-0 text-center fw-bold">
                Second-Factor Authentication (2FA)
              </h4>
            </Card.Header>
            <Card.Body className="p-4">
              {errorMessage && (
                <Alert variant="danger" dismissible onClose={() => setErrorMessage('')}>
                  {errorMessage}
                </Alert>
              )}

              <div className="text-center mb-4">
                <p className="text-muted mb-2">
                  Please enter the 6-digit verification code from your Authenticator app for account{' '}
                  <strong>{user ? user.username : 'current user'}</strong>
                </p>
                {user && user.score < 0 && (
                  <Alert variant="warning" className="text-start small">
                    <strong>Current Score: {user.score}</strong>
                    <br />
                    Verifying with TOTP will immediately <strong>reset your score to 0</strong>, unlocking full booking privileges.
                  </Alert>
                )}
              </div>

              <Form onSubmit={handleValidate}>
                <Form.Group className="mb-4 text-center" controlId="totpInput">
                  <Form.Label className="fw-bold">6-Digit TOTP Code</Form.Label>
                  <Form.Control
                    type="text"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="text-center fw-bold fs-3"
                    style={{ letterSpacing: '8px' }}
                    autoFocus
                    required
                  />
                </Form.Group>

                <div className="d-grid gap-2">
                  <Button variant="primary" type="submit" size="lg" disabled={submitting}>
                    {submitting ? 'Verifying...' : 'Validate Code & Reset Score'}
                  </Button>
                  <Button variant="outline-secondary" onClick={handleSkip}>
                    Skip (Continue with 1-Factor)
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default TotpView;