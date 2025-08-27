import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { RootState, AppDispatch } from "../store";
import { logout } from "../store/authSlice";
import MaxWidthWrapper from "./MaxWidthWrapper";

const Header: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await dispatch(logout());
    navigate("/login");
  };

  return (
    <header className="bg-white shadow-md py-4">
      <MaxWidthWrapper className="flex justify-between items-center">
        {/* Логотип */}
        <Link to="/dashboard" className="text-2xl font-bold text-gray-800 hover:text-blue-600 transition-colors">
          MyApp
        </Link>

        {/* Навигация */}
        <nav className="flex items-center space-x-4">
          {user ? (
            <>
              <span className="text-gray-600 text-sm md:text-base">
                Welcome, {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm md:text-base"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm md:text-base">
                  Login
                </button>
              </Link>
              <Link to="/registration">
                <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm md:text-base">
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