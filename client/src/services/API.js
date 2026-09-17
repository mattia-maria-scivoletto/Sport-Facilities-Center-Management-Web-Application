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

const getPublicAvailability = async (date, timeSlot) => {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (timeSlot) params.append('timeSlot', timeSlot);
  const query = params.toString() ? `?${params.toString()}` : '';
  return getJson(
    fetch(SERVER_URL + 'public/availability' + query, {
      credentials: 'include'
    })
  );
};

const getScheduleCalendar = async ({ startDate, endDate, facilityTypeId } = {}) => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  if (facilityTypeId) params.append('facilityTypeId', facilityTypeId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return getJson(
    fetch(SERVER_URL + 'schedule/calendar' + query, {
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

const getAllFacilities = async (date, timeSlot) => {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (timeSlot) params.append('timeSlot', timeSlot);
  const query = params.toString() ? `?${params.toString()}` : '';
  return getJson(
    fetch(SERVER_URL + 'facilities' + query, {
      credentials: 'include'
    })
  );
};

const getFacilityRules = async (facilityTypeId, date, timeSlot) => {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  if (timeSlot) params.append('timeSlot', timeSlot);
  const query = params.toString() ? `?${params.toString()}` : '';
  return getJson(
    fetch(SERVER_URL + `facility-types/${facilityTypeId}/rules${query}`, {
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

const register = async (userData) => {
  return getJson(
    fetch(SERVER_URL + 'users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(userData)
    })
  );
};

const changePassword = async ({ oldPassword, newPassword }) => {
  return getJson(
    fetch(SERVER_URL + 'users/current/password', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ oldPassword, newPassword })
    })
  );
};

const getAdminAnalytics = async () => {
  return getJson(
    fetch(SERVER_URL + 'admin/analytics', {
      credentials: 'include'
    })
  );
};

const getAdminFacilities = async () => {
  return getJson(
    fetch(SERVER_URL + 'admin/facilities', {
      credentials: 'include'
    })
  );
};

const toggleFacilityMaintenance = async (facilityId, isMaintenance, maintenanceReason = '') => {
  return getJson(
    fetch(SERVER_URL + `admin/facilities/${facilityId}/maintenance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isMaintenance, maintenanceReason })
    })
  );
};

const getAdminEquipment = async () => {
  return getJson(
    fetch(SERVER_URL + 'admin/equipment', {
      credentials: 'include'
    })
  );
};

const updateEquipmentStock = async (equipmentTypeId, totalQuantity) => {
  return getJson(
    fetch(SERVER_URL + `admin/equipment/${equipmentTypeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ totalQuantity })
    })
  );
};

const getAdminUsers = async () => {
  return getJson(
    fetch(SERVER_URL + 'admin/users', {
      credentials: 'include'
    })
  );
};

const updateUserRole = async (userId, role) => {
  return getJson(
    fetch(SERVER_URL + `admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role })
    })
  );
};

const API = {
  getPublicAvailability,
  getScheduleCalendar,
  getFacilityTypes,
  getAllFacilities,
  getFacilityRules,
  getUserReservations,
  createReservation,
  updateReservationEquipment,
  deleteReservation,
  logIn,
  register,
  changePassword,
  totpVerify,
  getUserInfo,
  logOut,
  getAdminAnalytics,
  getAdminFacilities,
  toggleFacilityMaintenance,
  getAdminEquipment,
  updateEquipmentStock,
  getAdminUsers,
  updateUserRole
};

export default API;