import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { RootState, AppDispatch } from "../store";
import { logout, resetAuthState } from "../store/authSlice";
import MaxWidthWrapper from "./MaxWidthWrapper";

const Header: React.FC = () => {
  const { user, isLoggingOut } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const handleLogout = async () => {
    console.log('Header: Initiating logout');
    
    navigate("/login");
    
    try {
      await dispatch(logout()).unwrap();
    } catch (error) {
      console.error('Header: Logout failed:', error);
      // Все равно сбрасываем состояние даже при ошибке
      dispatch(resetAuthState());
    }
  };

  return (
    <header className="bg-white shadow-md py-4">
      <MaxWidthWrapper className="flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-gray-800 hover:text-blue-600 transition-colors">
          <img src="../logo.png" alt="logo" className="w-auto h-20 cursor-pointer" />
        </Link>

        <nav className="flex items-center space-x-4">
          {user && user.isActivated ? (
            <>
              <span className="text-gray-600 text-sm md:text-base">
                Welcome, {user.email}
              </span>
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors text-sm md:text-base cursor-pointer"
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm md:text-base cursor-pointer">
                  Login
                </button>
              </Link>
              <Link to="/registration">
                <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm md:text-base cursor-pointer">
                  Registration
                </button>
              </Link>
            </>
          )}
        </nav>
      </MaxWidthWrapper>
    </header>
  );
};

export default Header;
