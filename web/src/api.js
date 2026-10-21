const TOKEN_KEY = 'proposal-agent-token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage blocked: the token just won't persist */
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['x-access-token'] = token;

  let res;
  try {
    res = await fetch(`/api${path}`, { ...options, headers });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  if (res.status === 401) {
    onUnauthorized();
    throw new ApiError('Access token required.', 401);
  }
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, res.status);
  }
  return res;
}

const json = async (path, options) => (await request(path, options)).json();

export const api = {
  config: () => json('/config'),
  listJobs: () => json('/jobs'),
  getJob: (id) => json(`/jobs/${id}`),
  createJob: (formData) => json('/jobs', { method: 'POST', body: formData }),
  getProfile: () => json('/company-profile'),
  saveProfile: (text) =>
    json('/company-profile', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
  async downloadJob(id) {
    const res = await request(`/jobs/${id}/download`);
    const blob = await res.blob();
    const match = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = match ? match[1] : 'proposal-strategy.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
