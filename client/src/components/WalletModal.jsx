import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Card,
  Row,
  Col,
  Badge,
  ProgressBar,
  Form,
  InputGroup,
  Alert,
  Spinner,
  Table,
  Nav
} from 'react-bootstrap';
import dayjs from 'dayjs';
import API from '../services/API';

function WalletModal({ show, handleClose, user, onWalletUpdated }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('50');
  const [recharging, setRecharging] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  const fetchWallet = () => {
    setLoading(true);
    API.getWallet()
      .then((data) => {
        setWalletData(data);
        setLoading(false);
      })
      .catch((err) => {
        setActionFeedback({
          type: 'danger',
          message: err.error || 'Failed to load wallet information.'
        });
        setLoading(false);
      });
  };

  useEffect(() => {
    if (show) {
      let ignore = false;
      API.getWallet()
        .then((data) => {
          if (!ignore) {
            setWalletData(data);
          }
        })
        .catch((err) => {
          if (!ignore) {
            setActionFeedback({
              type: 'danger',
              message: err.error || 'Failed to load wallet data.'
            });
          }
        });
      return () => {
        ignore = true;
      };
    }
  }, [show]);

  const handleRecharge = async (amountToRecharge) => {
    const amt = parseInt(amountToRecharge, 10);
    if (isNaN(amt) || amt <= 0) {
      setActionFeedback({ type: 'danger', message: 'Please enter a valid positive credit amount.' });
      return;
    }

    try {
      setRecharging(true);
      setActionFeedback(null);
      const res = await API.rechargeWallet(amt);
      setActionFeedback({
        type: 'success',
        message: `Successfully added ${amt} credits! New balance: ${res.newBalance} credits.`
      });
      if (onWalletUpdated) {
        onWalletUpdated(res.newBalance);
      }
      fetchWallet();
    } catch (err) {
      setActionFeedback({
        type: 'danger',
        message: err.error || 'Recharge failed. Please try again.'
      });
    } finally {
      setRecharging(false);
    }
  };

  const currentBalance =
    walletData?.walletBalance !== undefined ? walletData.walletBalance : (user?.walletBalance ?? 0);
  const currentStreak =
    walletData?.bookingStreak !== undefined ? walletData.bookingStreak : (user?.bookingStreak ?? 0);
  const streakProgress = (currentStreak % 3) / 3 * 100;
  const bookingsUntilBonus = 3 - (currentStreak % 3);

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton className="bg-light">
        <Modal.Title className="fw-bold d-flex align-items-center gap-2">
          <span>💰</span> Virtual Wallet & Gamification
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-4">
        {actionFeedback && (
          <Alert
            variant={actionFeedback.type}
            dismissible
            onClose={() => setActionFeedback(null)}
            className="mb-3"
          >
            {actionFeedback.message}
          </Alert>
        )}

        <Nav variant="pills" activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4">
          <Nav.Item>
            <Nav.Link eventKey="overview" className="fw-semibold">
              <i className="bi bi-wallet2 me-1"></i> Balance & Recharge
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="badges" className="fw-semibold">
              <i className="bi bi-trophy me-1"></i> Badges & Rewards
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="history" className="fw-semibold">
              <i className="bi bi-clock-history me-1"></i> Transaction Log
            </Nav.Link>
          </Nav.Item>
        </Nav>

        {loading && !walletData ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="text-muted mt-2">Loading wallet details...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW & RECHARGE */}
            {activeTab === 'overview' && (
              <div>
                <Row className="g-3 mb-4">
                  <Col md={6}>
                    <Card className="bg-primary text-white shadow-sm h-100 border-0">
                      <Card.Body className="d-flex flex-column justify-content-between p-4">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <span className="text-white-50 text-uppercase fw-semibold small">
                              Current Balance
                            </span>
                            <h1 className="fw-bold my-2 display-5">{currentBalance}</h1>
                            <span className="text-white-50">Virtual Credits</span>
                          </div>
                          <div className="fs-1">💰</div>
                        </div>
                        <div className="mt-3 pt-3 border-top border-white-50 small text-white-70">
                          Used to book courts and rent sports gear.
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>

                  <Col md={6}>
                    <Card className="bg-light border-0 shadow-sm h-100">
                      <Card.Body className="d-flex flex-column justify-content-between p-4">
                        <div>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <span className="text-muted text-uppercase fw-semibold small">
                              Reliable Player Streak
                            </span>
                            <span className="fs-3">🔥</span>
                          </div>
                          <h2 className="fw-bold mb-1 text-danger">
                            {currentStreak}{' '}
                            <span className="fs-6 text-muted fw-normal">
                              {currentStreak === 1 ? 'booking' : 'bookings'}
                            </span>
                          </h2>
                          <p className="text-muted small mb-3">
                            Consecutive bookings completed without cancellation.
                          </p>
                        </div>

                        <div>
                          <div className="d-flex justify-content-between small text-muted mb-1">
                            <span>Next bonus milestone (+15 credits):</span>
                            <strong>
                              {bookingsUntilBonus === 3 ? '3 bookings to go' : `${bookingsUntilBonus} more needed`}
                            </strong>
                          </div>
                          <ProgressBar
                            variant="warning"
                            now={currentStreak > 0 && currentStreak % 3 === 0 ? 100 : streakProgress}
                            style={{ height: '8px' }}
                          />
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                <Card className="border-0 shadow-sm mb-3">
                  <Card.Header className="bg-white fw-bold py-3">
                    <i className="bi bi-plus-circle-fill text-success me-2"></i> Recharge Mock Credits
                  </Card.Header>
                  <Card.Body className="p-4">
                    <p className="text-muted small mb-3">
                      Select a preset amount or type any custom amount to recharge your account instantly:
                    </p>

                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {[20, 50, 100, 200].map((amt) => (
                        <Button
                          key={amt}
                          variant="outline-primary"
                          className="fw-semibold px-3 py-2"
                          disabled={recharging}
                          onClick={() => handleRecharge(amt)}
                        >
                          +{amt} Credits
                        </Button>
                      ))}
                    </div>

                    <Form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRecharge(rechargeAmount);
                      }}
                    >
                      <Form.Label className="fw-semibold small text-muted">
                        Custom Recharge Amount
                      </Form.Label>
                      <InputGroup className="mb-2" style={{ maxWidth: '300px' }}>
                        <InputGroup.Text>💰</InputGroup.Text>
                        <Form.Control
                          type="number"
                          min="1"
                          max="2000"
                          value={rechargeAmount}
                          onChange={(e) => setRechargeAmount(e.target.value)}
                          placeholder="Amount"
                          disabled={recharging}
                        />
                        <Button
                          variant="success"
                          type="submit"
                          disabled={recharging || !rechargeAmount || parseInt(rechargeAmount, 10) <= 0}
                        >
                          {recharging ? <Spinner animation="border" size="sm" /> : 'Recharge'}
                        </Button>
                      </InputGroup>
                    </Form>
                  </Card.Body>
                </Card>
              </div>
            )}

            {/* TAB 2: GAMIFICATION BADGES */}
            {activeTab === 'badges' && (
              <div>
                <p className="text-muted small mb-3">
                  Earn prestigious badges and positive reinforcement rewards by maintaining reliable bookings, clean sportsmanship, and wallet health:
                </p>

                <Row className="g-3">
                  {(walletData?.badges || []).map((badge) => (
                    <Col xs={12} md={6} key={badge.id}>
                      <Card
                        className={`h-100 border ${
                          badge.unlocked
                            ? 'border-success bg-success-subtle shadow-sm'
                            : 'border-secondary-subtle bg-light opacity-75'
                        }`}
                      >
                        <Card.Body className="p-3 d-flex align-items-start gap-3">
                          <div
                            className="fs-1 d-flex align-items-center justify-content-center rounded-circle"
                            style={{
                              width: '54px',
                              height: '54px',
                              backgroundColor: badge.unlocked ? '#d1e7dd' : '#e9ecef'
                            }}
                          >
                            {badge.icon}
                          </div>
                          <div className="flex-grow-1">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <h6 className="fw-bold mb-0">{badge.title}</h6>
                              {badge.unlocked ? (
                                <Badge bg="success">Unlocked</Badge>
                              ) : (
                                <Badge bg="secondary">In Progress</Badge>
                              )}
                            </div>
                            <p className="text-muted small mb-1">{badge.criteria}</p>
                            <div className="small fw-semibold text-secondary">
                              Progress: {badge.progress}
                            </div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {/* TAB 3: TRANSACTION HISTORY */}
            {activeTab === 'history' && (
              <div>
                {!walletData?.transactions || walletData.transactions.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <i className="bi bi-receipt fs-1 mb-2"></i>
                    <p>No wallet transactions found.</p>
                  </div>
                ) : (
                  <Table responsive hover className="align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Date & Time</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th className="text-end">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {walletData.transactions.map((tx) => {
                        const isPositive = tx.amount > 0;
                        const badgeBg =
                          tx.type === 'recharge'
                            ? 'success'
                            : tx.type === 'streak_bonus'
                            ? 'warning'
                            : tx.type === 'booking_refund'
                            ? 'info'
                            : tx.type === 'booking_adjustment'
                            ? 'secondary'
                            : 'primary';

                        return (
                          <tr key={tx.id}>
                            <td className="small text-muted" style={{ whiteSpace: 'nowrap' }}>
                              {dayjs(tx.createdAt).format('YYYY-MM-DD HH:mm')}
                            </td>
                            <td>
                              <Badge bg={badgeBg} text={tx.type === 'streak_bonus' ? 'dark' : 'light'}>
                                {tx.type.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="small">{tx.description}</td>
                            <td
                              className={`text-end fw-bold ${
                                isPositive ? 'text-success' : 'text-danger'
                              }`}
                              style={{ whiteSpace: 'nowrap' }}
                            >
                              {isPositive ? `+${tx.amount}` : tx.amount} credits
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </div>
            )}
          </>
        )}
      </Modal.Body>

      <Modal.Footer className="bg-light">
        <Button variant="secondary" onClick={handleClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default WalletModal;
