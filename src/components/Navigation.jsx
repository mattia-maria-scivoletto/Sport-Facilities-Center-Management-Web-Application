import React, { useState } from 'react';
import { Navbar, Nav, Container, Button, Dropdown, NavDropdown, Badge } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import ScoreBadge from './ScoreBadge';
import WalletModal from './WalletModal';

function Navigation({ user, setUser, loggedIn, logout }) {
  const navigate = useNavigate();
  const [showWalletModal, setShowWalletModal] = useState(false);

  const handleWalletUpdated = (newBalance) => {
    if (setUser) {
      setUser((prev) => ({ ...prev, walletBalance: newBalance }));
    }
  };

  return (
    <>
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-4 shadow-sm py-2">
        <Container>
          <Navbar.Brand as={Link} to="/" className="fw-bold">
            Sports Center Portal
          </Navbar.Brand>

          <Navbar.Toggle aria-controls="sports-navbar-nav" />

          <Navbar.Collapse id="sports-navbar-nav">
            <Nav className="me-auto">
              <NavDropdown title="Manage My Reservations" id="manage-reservations-dropdown">
                <NavDropdown.Item as={Link} to="/">
                  <i className="bi bi-grid-fill me-2"></i> Public Availability
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/calendar">
                  <i className="bi bi-calendar3 me-2"></i> Schedule Calendar
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/reservations">
                  <i className="bi bi-calendar-check me-2"></i> My Reservations
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to={loggedIn ? '/new-reservation' : '/login'}>
                  <i className="bi bi-plus-circle me-2"></i> New Reservation
                </NavDropdown.Item>
              </NavDropdown>
            </Nav>

            <Nav className="align-items-center gap-3">
              {loggedIn && user ? (
                <>
                  <div className="text-light d-flex align-items-center gap-2">
                    <span>Welcome, <strong>{user.name || user.username}</strong></span>
                    {(user.role === 'admin' || user.role === 'staff') && (
                      <Badge
                        bg={user.role === 'admin' ? 'danger' : 'info'}
                        className="text-lowercase"
                        style={{ fontSize: '0.85rem', padding: '6px 10px' }}
                      >
                        {user.role}
                      </Badge>
                    )}
                    <ScoreBadge score={user.score} isTotp={user.isTotp} />
                    <Badge
                      bg="warning"
                      text="dark"
                      role="button"
                      tabIndex={0}
                      className="d-inline-flex align-items-center gap-1 text-decoration-none"
                      style={{ fontSize: '0.85rem', padding: '6px 10px', cursor: 'pointer', lineHeight: 1 }}
                      onClick={() => setShowWalletModal(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setShowWalletModal(true);
                        }
                      }}
                      title="Click to view virtual wallet, recharge credits, and check rewards"
                    >
                      {user.walletBalance ?? 0} credits
                    </Badge>
                  </div>

                  <Dropdown align="end">
                    <Dropdown.Toggle
                      variant="outline-light"
                      size="sm"
                      id="user-menu-dropdown"
                      className="d-inline-flex align-items-center"
                      style={{ fontSize: '0.85rem', padding: '6px 10px', lineHeight: 1 }}
                    >
                      Account Settings
                    </Dropdown.Toggle>

                    <Dropdown.Menu>
                      {(user.role === 'admin' || user.role === 'staff') && (
                        <Dropdown.Item onClick={() => navigate('/admin')}>
                          <i className="bi bi-speedometer2 text-info me-2"></i> Admin Dashboard
                        </Dropdown.Item>
                      )}
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

      {loggedIn && user && (
        <WalletModal
          show={showWalletModal}
          handleClose={() => setShowWalletModal(false)}
          user={user}
          onWalletUpdated={handleWalletUpdated}
        />
      )}
    </>
  );
}

export default Navigation;