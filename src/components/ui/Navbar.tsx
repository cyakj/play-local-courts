
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Navbar = () => {
  const { currentUser, logout, isAdmin } = useAuth();
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path ? "bg-primary text-white" : "hover:bg-gray-100";
  };

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-primary">HOA Court Reservation</h1>
            <button className="md:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4 mt-4 md:mt-0">
            <Link 
              to="/dashboard" 
              className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/dashboard')}`}
            >
              Dashboard
            </Link>
            <Link 
              to="/reserve" 
              className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/reserve')}`}
            >
              Reserve Court
            </Link>
            <Link 
              to="/my-reservations" 
              className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/my-reservations')}`}
            >
              My Reservations
            </Link>
            
            {isAdmin && (
              <>
                <Link 
                  to="/pending-requests" 
                  className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/pending-requests')}`}
                >
                  Pending Requests
                </Link>
                <Link 
                  to="/manage-courts" 
                  className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/manage-courts')}`}
                >
                  Manage Courts
                </Link>
              </>
            )}
          </nav>

          <div className="flex items-center mt-4 md:mt-0">
            <span className="text-sm mr-4">
              Welcome, <span className="font-medium">{currentUser?.fullName}</span>
            </span>
            <button 
              onClick={logout}
              className="px-3 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
