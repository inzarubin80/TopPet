import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { devLoginAsync } from '../../store/slices/authSlice';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { ErrorMessage } from '../common/ErrorMessage';
import { LoadingSpinner } from '../common/LoadingSpinner';
import './LoginForm.css';

interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.auth);
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }

    const result = await dispatch(devLoginAsync(name.trim()));
    if (devLoginAsync.fulfilled.match(result)) {
      if (onSuccess) {
        onSuccess();
      }
    }
  };

  return (
    <div className="login-form">
      <h2>Вход</h2>
      <form onSubmit={handleSubmit}>
        <Input
          label="Имя"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Введите ваше имя"
          required
          disabled={loading}
        />
        {error && <ErrorMessage message={error} />}
        <Button type="submit" fullWidth disabled={loading || !name.trim()}>
          {loading ? <LoadingSpinner size="small" /> : 'Войти'}
        </Button>
      </form>
    </div>
  );
};
