export async function listJobs(params) {
  return request("/jobs/", params);
}

export async function getJob(id) {
  return request(`/jobs/${encodeURIComponent(id)}`);
}

export async function getStats(params) {
  return request("/stats/", params);
}

export async function getFilterOptions() {
  return request("/filters/", null );
}

async function request(path, params ) {
  const url = new URL(path, window.location.origin);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== "" && value !== null && value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url);

  if (!response.ok) {
    const error = new Error(`A API respondeu ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}
