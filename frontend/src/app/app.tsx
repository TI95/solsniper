import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppDispatch, RootState } from "../store";
import { checkAuth } from "../store/authSlice"; // <-- поправил импорт
import LoginPage from "../pages/LoginPage";
import Dashboard from "../pages/DashboardPage";
import Header from "@/components/Navbar";
import RegistrationPage from "@/pages/RegistrationPage";
import ActivationNotice from "@/pages/ActivationNotificationPage";
import Skeleton from "react-loading-skeleton";
import 'react-loading-skeleton/dist/skeleton.css'

 

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, isLoading,registered } = useSelector((state: RootState) => state.auth);
    const location = useLocation();


useEffect(() => {
  const protectedRoutes = ["/dashboard"];
  const shouldCheckAuth = protectedRoutes.some((path) => 
    location.pathname.startsWith(path)
  );
  
  if (shouldCheckAuth && !user && !isLoading) {
    dispatch(checkAuth());
  }
}, [dispatch, location.pathname, user, isLoading]);
  

  if (isLoading) {
   return <Skeleton count={5}/>
  }

  return (
    <>
      <Header />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/login" />} />
        <Route path="/registration" element={<RegistrationPage />} />
        <Route
          path="/activation-notice"
          element={registered ? <ActivationNotice /> : <Navigate to="/login" />}
        />

      </Routes>

    </>
  );
};

export default App;
