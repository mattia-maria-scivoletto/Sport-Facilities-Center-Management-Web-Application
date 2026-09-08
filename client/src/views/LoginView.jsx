import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';

function LoginView({ login, setFeedback }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!username.trim() || !password.trim()) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    try {
      setSubmitting(true);
      const user = await login({ username: username.trim(), password: password.trim() });
      if (setFeedback) {
        setFeedback({ type: 'success', message: `Welcome back, ${user.name || user.username}!` });
      }

      if (user && user.score < 0) {
        navigate('/login-totp');
      } else {
        navigate('/reservations');
      }
    } catch (err) {
      setErrorMessage(err.error || 'Login failed. Please check your credentials.');
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
                Sports Center User Login
              </h4>
            </Card.Header>
            <Card.Body className="p-4">
              {errorMessage && (
                <Alert variant="danger" dismissible onClose={() => setErrorMessage('')}>
                  {errorMessage}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3" controlId="loginUsername">
                  <Form.Label className="fw-semibold">Username</Form.Label>
                  <Form.Control
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    autoFocus
                    required
                  />
                </Form.Group>

                <Form.Group className="mb-4" controlId="loginPassword">
                  <Form.Label className="fw-semibold">Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
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

                <div className="d-grid gap-2">
                  <Button variant="primary" type="submit" size="lg" disabled={submitting}>
                    {submitting ? 'Logging in...' : 'Sign In'}
                  </Button>
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

export default LoginView;