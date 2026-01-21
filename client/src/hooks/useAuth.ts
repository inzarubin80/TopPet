import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState, AppDispatch } from '../store';
import { logout, devLoginAsync } from '../store/slices/authSlice';

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading, error } = useSelector((state: RootState) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  const handleLogin = async (name: string) => {
    const result = await dispatch(devLoginAsync(name));
    return devLoginAsync.fulfilled.match(result);
  };

  return {
    user,
    isAuthenticated,
    loading,
    error,
    logout: handleLogout,
    login: handleLogin,
  };
};
