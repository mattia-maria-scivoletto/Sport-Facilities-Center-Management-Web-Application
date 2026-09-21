import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Container, Alert } from 'react-bootstrap';

import Navigation from './components/Navigation';
import PublicView from './views/PublicView';
import LoginView from './views/LoginView';
import TotpView from './views/TotpView';
import MyReservationsView from './views/MyReservationsView';
import NewReservationView from './views/NewReservationView';
import RegisterView from './views/RegisterView';
import ChangePasswordView from './views/ChangePasswordView';
import ScheduleCalendarView from './views/ScheduleCalendarView';
import AdminDashboardView from './views/AdminDashboardView';
import AdminRoute from './components/AdminRoute';

import API from './services/API';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [feedback, setFeedback] = useState(null);

  // check active session
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userInfo = await API.getUserInfo();
        setUser(userInfo);
        setLoggedIn(true);
      } catch {
        setUser(null);
        setLoggedIn(false);
      } finally {
        setLoadingSession(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = async (credentials) => {
    const userInfo = await API.logIn(credentials);
    setUser(userInfo);
    setLoggedIn(true);
    return userInfo;
  };

  const handleLogout = async () => {
    try {
      await API.logOut();
    } finally {
      setUser(null);
      setLoggedIn(false);
      setFeedback({ type: 'info', message: 'You have logged out successfully.' });
    }
  };

  if (loadingSession) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading session...</span>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-vh-100 d-flex flex-column bg-light">
        {/* navigation bar */}
        <Navigation user={user} setUser={setUser} loggedIn={loggedIn} logout={handleLogout} />

        {/* Feedback alert message */}
        {feedback && (
          <Container className="mb-3">
            <Alert
              variant={feedback.type || 'info'}
              dismissible
              onClose={() => setFeedback(null)}
            >
              {feedback.message}
            </Alert>
          </Container>
        )}

        {/* main routed content */}
        <main className="flex-grow-1">
          <Routes>
            {/* public availability route */}
            <Route path="/" element={<PublicView loggedIn={loggedIn} />} />

            {/* schedule calendar route */}
            <Route path="/calendar" element={<ScheduleCalendarView loggedIn={loggedIn} />} />

            {/* login route */}
            <Route
              path="/login"
              element={
                loggedIn ? (
                  <Navigate
                    to={user && user.score < 0 && !user.isTotp ? '/login-totp' : '/reservations'}
                    replace
                  />
                ) : (
                  <LoginView login={handleLogin} setFeedback={setFeedback} />
                )
              }
            />

            {/* register route */}
            <Route
              path="/register"
              element={
                loggedIn ? (
                  <Navigate to="/reservations" replace />
                ) : (
                  <RegisterView setFeedback={setFeedback} />
                )
              }
            />

            {/* 2FA TOTP route */}
            <Route
              path="/login-totp"
              element={
                loggedIn ? (
                  <TotpView user={user} setUser={setUser} setFeedback={setFeedback} />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* user reservations */}
            <Route
              path="/reservations"
              element={
                loggedIn ? (
                  <MyReservationsView
                    user={user}
                    setUser={setUser}
                    setFeedback={setFeedback}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* new reservation */}
            <Route
              path="/new-reservation"
              element={
                loggedIn ? (
                  <NewReservationView user={user} setUser={setUser} setFeedback={setFeedback} />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* change password route */}
            <Route
              path="/change-password"
              element={
                loggedIn ? (
                  <ChangePasswordView setFeedback={setFeedback} />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* admin dashboard route */}
            <Route
              path="/admin"
              element={
                <AdminRoute user={user} loggedIn={loggedIn}>
                  <AdminDashboardView user={user} />
                </AdminRoute>
              }
            />

            {/* fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* footer */}
        <footer className="bg-dark text-white-50 text-center py-3 mt-auto">
          <Container>
            <small>
              Sports Center Reservation System
            </small>
          </Container>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;