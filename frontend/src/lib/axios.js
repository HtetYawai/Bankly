import axios from "axios";

// Relative baseURL: Vite's dev proxy (see vite.config.js) forwards /api to
// the backend in development, and the same origin serves both in production.
// Using this instead of a hardcoded http://localhost:5001 keeps the app
// working outside of local dev.
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});
