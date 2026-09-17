import React from 'react';
import { Navigate } from 'react-router-dom';

function AdminRoute({ user, loggedIn, children }) {
  if (!loggedIn) {
    return <Navigate to="/login" replace />;
  }

  if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default AdminRoute;
