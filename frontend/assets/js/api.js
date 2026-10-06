export async function listJobs(params, signal) {
  return request("/jobs/", params, signal);
}

export async function getJob(id, signal) {
  return request(`/jobs/${encodeURIComponent(id)}`, null, signal);
}

export async function getStats(params, signal) {
  return request("/stats/", params, signal);
}

export async function getFilterOptions(signal) {
  return request("/filters/", null, signal);
}

async function request(path, params, signal) {
  const url = new URL(path, window.location.origin);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== "" && value !== null && value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, { signal });

  if (!response.ok) {
    const error = new Error(`A API respondeu ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}
