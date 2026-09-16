import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import API from '../services/API';

function ChangePasswordView({ setFeedback }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!oldPassword) {
      setErrorMessage('Please enter your current password.');
      return;
    }

    if (!newPassword) {
      setErrorMessage('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword === oldPassword) {
      setErrorMessage('New password must be different from your current password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match. Please verify.');
      return;
    }

    try {
      setSubmitting(true);
      await API.changePassword({ oldPassword, newPassword });
      if (setFeedback) {
        setFeedback({
          type: 'success',
          message: 'Password updated successfully!'
        });
      }
      navigate('/reservations');
    } catch (err) {
      setErrorMessage(err.error || 'Failed to update password. Please check your current password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col xs={12} md={8} lg={6}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-primary text-white py-3">
              <h4 className="mb-0 text-center fw-bold">
                Change Account Password
              </h4>
            </Card.Header>
            <Card.Body className="p-4">
              {errorMessage && (
                <Alert variant="danger" dismissible onClose={() => setErrorMessage('')}>
                  {errorMessage}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3" controlId="currentPassword">
                  <Form.Label className="fw-semibold">Current Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showOldPassword ? 'text' : 'password'}
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Enter your current password"
                      autoFocus
                      required
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowOldPassword((prev) => !prev)}
                      type="button"
                      title={showOldPassword ? 'Hide password' : 'Show password'}
                    >
                      <i className={showOldPassword ? 'bi bi-eye-slash-fill' : 'bi bi-eye-fill'}></i>
                    </Button>
                  </InputGroup>
                </Form.Group>

                <Form.Group className="mb-3" controlId="newPassword">
                  <Form.Label className="fw-semibold">New Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min. 6 characters)"
                      required
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      type="button"
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      <i className={showNewPassword ? 'bi bi-eye-slash-fill' : 'bi bi-eye-fill'}></i>
                    </Button>
                  </InputGroup>
                </Form.Group>

                <Form.Group className="mb-4" controlId="confirmNewPassword">
                  <Form.Label className="fw-semibold">Confirm New Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your new password"
                      required
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      type="button"
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      <i className={showConfirmPassword ? 'bi bi-eye-slash-fill' : 'bi bi-eye-fill'}></i>
                    </Button>
                  </InputGroup>
                </Form.Group>

                <div className="d-grid gap-2">
                  <Button variant="primary" type="submit" size="lg" disabled={submitting}>
                    {submitting ? 'Updating...' : 'Update Password'}
                  </Button>
                  <Button as={Link} to="/reservations" variant="outline-secondary">
                    Cancel & Back to Reservations
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

export default ChangePasswordView;
