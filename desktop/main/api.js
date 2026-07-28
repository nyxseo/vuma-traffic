const axios = require('axios');
const http = require('http');
const https = require('https');

class VumaApi {
  constructor() {
    this.baseURL = process.env.VUMA_API_URL || 'http://localhost:3080';
    this.token = null;
    this.client = this._createClient();
  }

  _createClient(token = null) {
    const config = {
      baseURL: this.baseURL,
      timeout: 15000,
      httpAgent: new http.Agent({ keepAlive: false }),
      httpsAgent: new https.Agent({ keepAlive: false }),
    };
    if (token) {
      config.headers = { Authorization: `Bearer ${token}` };
    }
    const instance = axios.create(config);

    // Response interceptor: transform errors
    instance.interceptors.response.use(
      (res) => res,
      (error) => {
        const msg = error.response?.data?.error || error.message || 'Unknown error';
        const err = new Error(msg);
        err.code = error.code;
        err.status = error.response?.status;
        err.data = error.response?.data;
        return Promise.reject(err);
      }
    );

    return instance;
  }

  setToken(token) {
    this.token = token;
    this.client = this._createClient(token);
  }

  // ── AUTH ──
  async login(email, password) {
    const { data } = await this.client.post('/api/auth/login', { email, password });
    this.setToken(data.token);
    return data;
  }

  async register(name, email, password) {
    const { data } = await this.client.post('/api/auth/register', { name, email, password });
    this.setToken(data.token);
    return data;
  }

  async refreshToken(refreshToken) {
    const { data } = await this.client.post('/api/auth/refresh', { refreshToken });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    const { data } = await this.client.get('/api/auth/me');
    return data;
  }

  // ── STATS ──
  async getStats() {
    const { data } = await this.client.get('/api/stats');
    return data;
  }

  // ── TRAFFIC ──
  async getTrafficSources(limit = 50, category = null) {
    const payload = { limit };
    if (category) payload.category = category;
    const { data } = await this.client.post('/api/traffic-source', payload);
    return data;
  }

  // ── FINGERPRINT ──
  async createFingerprint(fp, device = 'desktop', os = 'windows', browser = 'chrome') {
    const { data } = await this.client.post('/api/fingerprint', { fp, device, os, browser });
    return data;
  }

  async listFingerprints() {
    const { data } = await this.client.get('/api/fingerprint/list');
    return data;
  }

  async deleteFingerprint(id) {
    const { data } = await this.client.delete(`/api/fingerprint/${id}`);
    return data;
  }

  // ── ADMIN ──
  async adminGetStats() {
    const { data } = await this.client.get('/api/admin/stats');
    return data;
  }

  async adminGetUsers(params = {}) {
    const { data } = await this.client.get('/api/admin/users', { params });
    return data;
  }

  async adminGetUser(id) {
    const { data } = await this.client.get(`/api/admin/users/${id}`);
    return data;
  }

  async adminCreateUser(body) {
    const { data } = await this.client.post('/api/admin/users', body);
    return data;
  }

  async adminUpdateUser(id, body) {
    const { data } = await this.client.put(`/api/admin/users/${id}`, body);
    return data;
  }

  async adminChangePlan(userId, planId) {
    const { data } = await this.client.put(`/api/admin/users/${userId}/plan`, { planId });
    return data;
  }

  async adminGetPlans() {
    const { data } = await this.client.get('/api/admin/plans');
    return data;
  }

  async adminCreatePlan(body) {
    const { data } = await this.client.post('/api/admin/plans', body);
    return data;
  }

  async adminUpdatePlan(id, body) {
    const { data } = await this.client.put(`/api/admin/plans/${id}`, body);
    return data;
  }

  async adminGetTransactions(params = {}) {
    const { data } = await this.client.get('/api/admin/transactions', { params });
    return data;
  }

  async adminCreateTransaction(body) {
    const { data } = await this.client.post('/api/admin/transactions', body);
    return data;
  }
}

module.exports = new VumaApi();
