import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate('/');
  };

  return (
    <div className="login-page">
      <LoginForm onSuccess={handleSuccess} />
    </div>
  );
};

export default LoginPage;
