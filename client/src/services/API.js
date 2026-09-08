const SERVER_URL = '/api/';

function getJson(httpResponsePromise) {
  return new Promise((resolve, reject) => {
    httpResponsePromise
      .then((response) => {
        if (response.ok) {
          response
            .json()
            .then((json) => resolve(json))
            .catch(() => resolve({}));
        } else {
          response
            .json()
            .then((obj) => reject(obj))
            .catch(() => reject({ error: `Server error: status ${response.status}` }));
        }
      })
      .catch(() => reject({ error: 'Cannot communicate with the server. Please check your connection.' }));
  });
}

const getPublicAvailability = async () => {
  return getJson(
    fetch(SERVER_URL + 'public/availability', {
      credentials: 'include'
    })
  );
};

const getFacilityTypes = async () => {
  return getJson(
    fetch(SERVER_URL + 'facility-types', {
      credentials: 'include'
    })
  );
};

const getAllFacilities = async () => {
  return getJson(
    fetch(SERVER_URL + 'facilities', {
      credentials: 'include'
    })
  );
};

const getFacilityRules = async (facilityTypeId) => {
  return getJson(
    fetch(SERVER_URL + `facility-types/${facilityTypeId}/rules`, {
      credentials: 'include'
    })
  );
};

const getUserReservations = async () => {
  return getJson(
    fetch(SERVER_URL + 'reservations', {
      credentials: 'include'
    })
  );
};

const createReservation = async (reservationData) => {
  return getJson(
    fetch(SERVER_URL + 'reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(reservationData)
    })
  );
};

const updateReservationEquipment = async (reservationId, equipments) => {
  return getJson(
    fetch(SERVER_URL + `reservations/${reservationId}/equipment`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ equipments })
    })
  );
};

const deleteReservation = async (reservationId) => {
  return getJson(
    fetch(SERVER_URL + `reservations/${reservationId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
  );
};

const logIn = async (credentials) => {
  return getJson(
    fetch(SERVER_URL + 'sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credentials)
    })
  );
};

const totpVerify = async (totpCode) => {
  return getJson(
    fetch(SERVER_URL + 'login-totp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code: totpCode })
    })
  );
};

const getUserInfo = async () => {
  return getJson(
    fetch(SERVER_URL + 'sessions/current', {
      credentials: 'include'
    })
  );
};

const logOut = async () => {
  return getJson(
    fetch(SERVER_URL + 'sessions/current', {
      method: 'DELETE',
      credentials: 'include'
    })
  );
};

const API = {
  getPublicAvailability,
  getFacilityTypes,
  getAllFacilities,
  getFacilityRules,
  getUserReservations,
  createReservation,
  updateReservationEquipment,
  deleteReservation,
  logIn,
  totpVerify,
  getUserInfo,
  logOut
};

export default API;