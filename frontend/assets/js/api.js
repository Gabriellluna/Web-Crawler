import { localFilters, localJobs, localStats } from "./fallback.js";

export const MISSING_ENDPOINTS = [];

export async function listJobs(params, signal) {
  const data = await request("/jobs/", params, signal);
  if (!Array.isArray(data)) return data;

  noteMissing("/jobs/ com filtros");
  return localJobs(data, params);
}

export async function getJob(id, signal) {
  return request(`/jobs/${encodeURIComponent(id)}`, null, signal);
}

export async function getStats(params, signal) {
  try {
    return await request("/stats/", params, signal);
  } catch (error) {
    if (error.status !== 404) throw error;
    noteMissing("/stats/");
    return localStats(await allJobs(signal), params);
  }
}

export async function getFilterOptions(signal) {
  try {
    return await request("/filters/", null, signal);
  } catch (error) {
    if (error.status !== 404) throw error;
    noteMissing("/filters/");
    return localFilters(await allJobs(signal));
  }
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

async function allJobs(signal) {
  const data = await request("/jobs/", null, signal);
  return Array.isArray(data) ? data : data.items;
}

function noteMissing(name) {
  if (!MISSING_ENDPOINTS.includes(name)) MISSING_ENDPOINTS.push(name);
}
