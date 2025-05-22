
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  
  // Redirect to login page
  useEffect(() => {
    navigate('/login');
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">HOA Court Reservation System</h1>
        <p className="text-xl text-gray-600">Redirecting to login page...</p>
      </div>
    </div>
  );
};

export default Index;
