import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store";
import { logout, resetAuthState } from "../store/authSlice";
import { useNavigate } from "react-router-dom";

const LogoutButton: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);

  const handleLogout = async () => {
    console.log('LogoutButton: Initiating logout');
    dispatch(resetAuthState()); 
    try {
      await dispatch(logout()).unwrap();
      console.log('LogoutButton: Logout successful');
    } catch (error) {
      console.error('LogoutButton: Logout failed:', error);
    }
    console.log('LogoutButton: Navigating to /');
    navigate("/");
  };

  if (!user) return null; 

  return (
    <button onClick={handleLogout} style={{ margin: "20px", padding: "10px" }}>
      Выйти
    </button>
  );
};

export default LogoutButton;