import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const ML_BASE_URL = import.meta.env.VITE_ML_BASE_URL || 'http://127.0.0.1:5000/api';

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Add JWT to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Lightweight In-Memory GET Cache & Request Deduplication
const cache = new Map<string, { data: any; timestamp: number }>();
const pendingRequests = new Map<string, Promise<any>>();
const CACHE_TTL = 30000; // 30 seconds TTL

export const clearApiCache = () => {
    cache.clear();
};

if (typeof window !== 'undefined') {
    window.addEventListener('ratingUpdated', clearApiCache);
    window.addEventListener('recommendationsUpdated', clearApiCache);
}

const cachedGet = async (url: string, config?: any) => {
    const key = `API:${url}:${JSON.stringify(config?.params || {})}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    if (pendingRequests.has(key)) {
        return pendingRequests.get(key);
    }

    const promise = api.get(url, config).then((res) => {
        cache.set(key, { data: res, timestamp: Date.now() });
        pendingRequests.delete(key);
        return res;
    }).catch((err) => {
        pendingRequests.delete(key);
        throw err;
    });

    pendingRequests.set(key, promise);
    return promise;
};

const cachedAxiosGet = async (url: string, config?: any) => {
    const key = `ML:${url}:${JSON.stringify(config?.params || {})}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    if (pendingRequests.has(key)) {
        return pendingRequests.get(key);
    }

    const promise = axios.get(url, config).then((res) => {
        cache.set(key, { data: res, timestamp: Date.now() });
        pendingRequests.delete(key);
        return res;
    }).catch((err) => {
        pendingRequests.delete(key);
        throw err;
    });

    pendingRequests.set(key, promise);
    return promise;
};

export const authApi = {
    register: (data: any) => api.post('/auth/register', data),
    login: (data: any) => api.post('/auth/login', data),
};

export const bookApi = {
    getAll: (params: any) => cachedGet('/books', { params }),
    getById: (id: string) => cachedGet(`/books/${id}`),
    getRecommendedSection: () => cachedGet('/recommended/section'),
    getPersonalizedRecommendations: () => cachedGet('/books/personalized-recommendations'),
    generateCover: (id: string) => api.post(`/books/${id}/generate-cover`),
    create: (data: any) => api.post('/books', data),
    update: (id: string, data: any) => api.put(`/books/${id}`, data),
    delete: (id: string) => api.delete(`/books/${id}`),
    search: (query: string) => cachedGet(`/books/search?query=${encodeURIComponent(query)}`),
};

export const ratingApi = {
    submit: (bookId: string, value: number) => {
        clearApiCache();
        return api.post('/ratings', { bookId, value });
    },
    getUserRating: (bookId: string) => cachedGet(`/ratings/${bookId}`),
};

export const userApi = {
    getProfile: () => cachedGet('/users/profile'),
    updateProfile: (data: any) => api.put('/users/profile', data),
    requestEmailChangeOtp: (data: { newEmail: string }) => api.post('/users/request-email-change-otp', data),
    verifyEmailChangeOtp: (data: { otp: string; newName?: string }) => api.post('/users/verify-email-change-otp', data),
    updateFavoriteGenres: (genres: string[]) => api.put('/users/favorite-genres', { genres }),
    getBookStatus: (bookId: string) => cachedGet(`/users/book-status/${bookId}`),
    toggleBookmark: (bookId: string) => {
        clearApiCache();
        return api.post('/users/toggle-bookmark', { bookId });
    },
    toggleFavorite: (bookId: string) => {
        clearApiCache();
        return api.post('/users/toggle-favorite', { bookId });
    },
    toggleFinished: (bookId: string) => {
        clearApiCache();
        return api.post('/users/toggle-finished', { bookId });
    },
    toggleNotInterested: (bookId: string) => {
        clearApiCache();
        return api.post('/users/toggle-not-interested', { bookId });
    },
    getBookshelf: () => cachedGet('/users/bookshelf'),
};

export const adminApi = {
    getStats: () => cachedGet('/admin/stats'),
    getUsers: () => cachedGet('/admin/users'),
    getUserAnalytics: (userId: string) => cachedGet(`/admin/users/${userId}/analytics`),
    exportAnalytics: () => api.get('/admin/export-analytics', { responseType: 'blob' }),
    deleteRating: (id: string) => {
        clearApiCache();
        return api.delete(`/admin/ratings/${id}`);
    },
};

export const rankingApi = {
    getTopRated: (params?: any) => cachedGet('/rankings/top-rated', { params }),
};

export const notificationApi = {
    getNotifications: () => cachedGet('/notifications'),
    getUnreadCount: () => cachedGet('/notifications/unread-count'),
    markAsRead: (id: string) => api.patch(`/notifications/me/${id}/mark-read`),
    markAllAsRead: () => api.patch('/notifications/me/mark-all-read'),
};

export const mlApi = {
    getPopular: (limit = 10, params = {}) => cachedAxiosGet(`${ML_BASE_URL}/recommend/popularity`, { params: { limit, ...params } }),
    getSimilar: (bookId: string, params = {}) => cachedAxiosGet(`${ML_BASE_URL}/recommend/content`, { params: { bookId, ...params } }),
    getCollaborative: (userId: string, params = {}) => cachedAxiosGet(`${ML_BASE_URL}/recommend/collaborative`, { params: { userId, ...params } }),
    getPersonalized: (userId: string) => cachedAxiosGet(`${ML_BASE_URL}/recommend/user/${userId}`),
    getRecommendations: (userId?: string) => cachedAxiosGet(`${ML_BASE_URL}/recommendations`, { params: { userId } }),
};

export default api;
