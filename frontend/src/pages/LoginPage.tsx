import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store/index";
import { login } from "../store/authSlice";
import { useNavigate } from "react-router-dom";

const LoginPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { isLoading, error, user } = useSelector((state: RootState) => state.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(login({ email, password }));
  };

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "50px" }}>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col w-80 gap-4 bg-white shadow-md rounded-xl p-6"

      >
        <h2>Login</h2>

        <input
          type="email"
          placeholder="Email"
          className="border rounded-md px-3 py-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="border rounded-md px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit"
          disabled={isLoading}
          className="bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition">
          {isLoading ? "Logging in..." : "Login"}
        </button>

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {user && <p className="text-red-500 text-sm">Welcome, {user.email}!</p>}
      </form>
    </div>
  );
};

export default LoginPage;
