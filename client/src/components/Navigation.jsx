import React from 'react';
import { Navbar, Nav, Container, Button, Dropdown } from 'react-bootstrap';
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

                <Dropdown align="end">
                  <Dropdown.Toggle variant="outline-light" size="sm" id="user-menu-dropdown">
                    <i className="bi bi-gear me-1"></i> Account
                  </Dropdown.Toggle>

                  <Dropdown.Menu>
                    {!user.isTotp && (
                      <Dropdown.Item onClick={() => navigate('/login-totp')}>
                        <i className="bi bi-shield-lock text-info me-2"></i> Enable 2FA
                      </Dropdown.Item>
                    )}
                    <Dropdown.Item onClick={() => navigate('/change-password')}>
                      <i className="bi bi-key text-secondary me-2"></i> Change Password
                    </Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={logout} className="text-danger">
                      <i className="bi bi-box-arrow-right text-danger me-2"></i> Logout
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </>
            ) : (
              <div className="d-flex gap-2">
                <Button variant="outline-light" size="sm" onClick={() => navigate('/register')}>
                  Register
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/login')}>
                  Login
                </Button>
              </div>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Navigation;