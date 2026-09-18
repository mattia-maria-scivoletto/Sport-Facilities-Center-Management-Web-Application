import React from 'react';
import { Outlet } from 'react-router-dom';
import Navigation from './Navigation';

function GenericLayout({ user, loggedIn, logout }) {
  return (
    <>
      <Navigation user={user} loggedIn={loggedIn} logout={logout} />
      <Outlet />
    </>
  );
}

export { GenericLayout };