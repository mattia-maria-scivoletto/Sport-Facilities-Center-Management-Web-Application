import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import API from '../services/API';

function RegisterView({ setFeedback }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setErrorMessage('Username must be between 3 and 20 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setErrorMessage('Username can only contain alphanumeric characters and underscores.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await API.register({ username: cleanUsername, password });
      if (setFeedback) {
        setFeedback({
          type: 'success',
          message: `Account for ${res.name || res.username} created successfully! You can now sign in.`
        });
      }
      navigate('/login');
    } catch (err) {
      setErrorMessage(err.error || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col xs={12} md={8} lg={6}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-success text-white py-3">
              <h4 className="mb-0 text-center fw-bold">
                Create New Sports Center Account
              </h4>
            </Card.Header>
            <Card.Body className="p-4">
              {errorMessage && (
                <Alert variant="danger" dismissible onClose={() => setErrorMessage('')}>
                  {errorMessage}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3" controlId="registerUsername">
                  <Form.Label className="fw-semibold">Username</Form.Label>
                  <Form.Control
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username (3-20 characters)"
                    autoFocus
                    required
                  />
                  <Form.Text className="text-muted">
                    Letters, numbers, and underscores only.
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3" controlId="registerPassword">
                  <Form.Label className="fw-semibold">Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a password (min. 6 characters)"
                      required
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowPassword((prev) => !prev)}
                      type="button"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <i className={showPassword ? 'bi bi-eye-slash-fill' : 'bi bi-eye-fill'}></i>
                    </Button>
                  </InputGroup>
                </Form.Group>

                <Form.Group className="mb-4" controlId="registerConfirmPassword">
                  <Form.Label className="fw-semibold">Confirm Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
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
                  <Button variant="success" type="submit" size="lg" disabled={submitting}>
                    {submitting ? 'Registering...' : 'Register Account'}
                  </Button>
                  <div className="text-center my-2 text-muted small">
                    Already have an account?{' '}
                    <Link to="/login" className="fw-semibold text-decoration-none">
                      Sign In here
                    </Link>
                  </div>
                  <Button as={Link} to="/" variant="outline-secondary">
                    Cancel & Back to Public View
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

export default RegisterView;
