import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import ScoreBadge from './ScoreBadge';

function Navigation({ user, loggedIn, logout }) {
  const navigate = useNavigate();

  return (
    <Navbar bg="dark" variant="dark" expand="lg" className="mb-4 shadow-sm py-2">
      <Container>
        <Navbar.Brand as={Link} to="/" className="fw-bold">
          Sports Center Portal
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="sports-navbar-nav" />

        <Navbar.Collapse id="sports-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/">
              Public Availability
            </Nav.Link>
            {loggedIn && (
              <>
                <Nav.Link as={Link} to="/reservations">
                  My Reservations
                </Nav.Link>
                <Nav.Link as={Link} to="/new-reservation" className="text-warning fw-semibold">
                  + New Reservation
                </Nav.Link>
              </>
            )}
          </Nav>

          <Nav className="align-items-center gap-3">
            {loggedIn && user ? (
              <>
                <div className="text-light d-flex align-items-center gap-2">
                  <span>Welcome, <strong>{user.name || user.username}</strong></span>
                  <ScoreBadge score={user.score} isTotp={user.isTotp} />
                </div>
                {!user.isTotp && (
                  <Button
                    variant="outline-info"
                    size="sm"
                    onClick={() => navigate('/login-totp')}
                    title="Authenticate with TOTP to reset negative score"
                  >
                    Enable 2FA
                  </Button>
                )}
                <Button variant="outline-danger" size="sm" onClick={logout}>
                  Logout
                </Button>
              </>
            ) : (
              <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
                Login
              </Button>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Navigation;