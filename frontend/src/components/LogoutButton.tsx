import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store";
import { logout } from "../store/authSlice";
import { useNavigate } from "react-router-dom";

const LogoutButton: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);

  const handleLogout = async () => {
    await dispatch(logout());
    navigate("/"); // после выхода перенаправляем на страницу логина
  };

  if (!user) return null; // кнопку показываем только если есть user

  return (
    <button onClick={handleLogout} style={{ margin: "20px", padding: "10px" }}>
      Выйти
    </button>
  );
};

export default LogoutButton;
