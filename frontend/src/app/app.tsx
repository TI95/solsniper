import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AppDispatch, RootState } from "../store";
import { checkAuth } from "../store/authSlice";
import LoginPage from "../pages/LoginPage";
import Dashboard from "../pages/DashboardPage";
import Header from "@/components/Navbar";
import RegistrationPage from "@/pages/RegistrationPage";
import ActivationNotice from "@/pages/ActivationNotificationPage";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import AccountSettingsPage from "@/pages/AccountSettingsPage";

const App: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, isLoading, isLoggingOut } = useSelector((state: RootState) => state.auth);
  const location = useLocation();
  const [initialAuthCheckDone, setInitialAuthCheckDone] = useState(false);

useEffect(() => {
  const publicRoutes = ["/login", "/registration", "/activation-notice"];
  const isPublicRoute = publicRoutes.some((path) =>
    location.pathname.startsWith(path)
  );

  if (isLoggingOut || user || isLoading || isPublicRoute) {
    setInitialAuthCheckDone(true);
    return;
  }

  if (!isPublicRoute && !initialAuthCheckDone) {
    dispatch(checkAuth()).finally(() => {
      setInitialAuthCheckDone(true);
    });
  }
}, [dispatch, location.pathname, user, isLoading, isLoggingOut, initialAuthCheckDone]);


  if ((isLoading || !initialAuthCheckDone) && location.pathname.startsWith('/dashboard')) {
    return <Skeleton count={10} />;
  }


  return (
    <>
      <Header />
      <Routes>
        <Route path="/login" element={
          user ? (
            user.isActivated ? <Navigate to="/dashboard" /> : <LoginPage />
          ) : (
            <LoginPage />
          )
        } />
        <Route
          path="/dashboard"
          element={
            user && user.isActivated ? (
              <Dashboard />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route path="*" element={<Navigate to="/login" />} />
        <Route path="/registration" element={<RegistrationPage />} />
        <Route
          path="/activation-notice"
          element={user ? <ActivationNotice /> : <Navigate to="/login" />}
        />
        <Route
          path="/settings"
          element={
            user && user.isActivated ? (
              <AccountSettingsPage />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </>
  );
};

export default App;