import { Navigate } from 'react-router-dom';

// ReserveFacilities now redirects to ReserveCourt for HOA amenity reservations
const ReserveFacilities = () => {
  return <Navigate to="/reserve-court" replace />;
};

export default ReserveFacilities;