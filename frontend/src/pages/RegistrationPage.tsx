import { registration } from "@/store/authSlice";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store";
import { useNavigate } from "react-router-dom";

const RegistrationPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { isLoading, error, registered } = useSelector((state: RootState) => state.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validatePassword = (password: string): boolean => {
    const re = /^(?=.*[A-Z])(?=.*[\W_]).{8,}$/;
    return re.test(password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      setValidationError("Введите корректный email");
      return;
    }

    if (!validatePassword(password)) {
      setValidationError(
        "Пароль должен содержать минимум 8 символов, 1 заглавную букву и 1 спецсимвол"
      );
      return;
    }

    setValidationError(null);

    try {
      await dispatch(registration({ email, password })).unwrap();
      navigate("/activation-notice");
    } catch (err) {
      console.error("Registration error:", err);
    }
  };

  useEffect(() => {
    if (registered) {
      navigate("/activation-notice");
    }
  }, [registered, navigate]);

  return (
    <div className="flex justify-center mt-20">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col w-80 gap-4 bg-white shadow-md rounded-xl p-6"
      >
        <h2 className="text-xl font-bold text-center">Регистрация</h2>

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
          placeholder="Пароль"
          className="border rounded-md px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition"
        >
          {isLoading ? "Регистрация..." : "Зарегистрироваться"}
        </button>

        {validationError && <p className="text-red-500 text-sm">{validationError}</p>}
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>
    </div>
  );
};

export default RegistrationPage;
