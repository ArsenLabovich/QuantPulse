import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            // Don't attempt to refresh token if the error came from login or register endpoints
            const url = originalRequest.url || '';
            if (url.includes('/auth/token') || url.includes('/auth/register')) {
                return Promise.reject(error);
            }
            console.warn('Attempting token refresh for:', url);
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken) {
                    // Gracefully handle missing refresh token
                    localStorage.removeItem('token');
                    localStorage.removeItem('refreshToken');
                    window.location.href = '/login';
                    return Promise.reject(error);
                }

                const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/refresh`, {
                    refresh_token: refreshToken
                });

                const { access_token, refresh_token } = response.data;

                localStorage.setItem('token', access_token);
                localStorage.setItem('refreshToken', refresh_token);

                api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                originalRequest.headers['Authorization'] = `Bearer ${access_token}`;

                return api(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
