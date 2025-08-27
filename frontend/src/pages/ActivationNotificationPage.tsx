import React from "react";
import { Link } from "react-router-dom";

const ActivationNotice: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg w-full bg-white shadow-lg rounded-2xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.072 1.916l-7.5 4.615a2.25 2.25 0 01-2.356 0l-7.5-4.615a2.25 2.25 0 01-1.072-1.916V6.75"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Подтверждение аккаунта
        </h1>
        <p className="text-gray-600 mb-6">
          На вашу почту было выслано письмо со ссылкой для активации аккаунта.
          <br /> Проверьте папку <span className="font-semibold">«Входящие»</span> или{" "}
          <span className="font-semibold">«Спам»</span>.
        </p>

        <Link
          to="/login"
          className="inline-block px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
        >
          Вернуться на страницу входа
        </Link>
      </div>
    </div>
  );
};

export default ActivationNotice;
