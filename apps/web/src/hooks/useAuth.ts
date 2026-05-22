import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

export function useAuth() {
  const navigate = useNavigate();

  const login = (accessToken: string, refreshToken: string) => {
    authService.setTokens(accessToken, refreshToken);
    navigate('/');
  };

  const logout = () => {
    authService.clearTokens();
    navigate('/login');
  };

  return {
    login,
    logout,
    isAuthenticated: authService.isAuthenticated(),
  };
}