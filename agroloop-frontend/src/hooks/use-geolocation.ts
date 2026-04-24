import { useState, useCallback } from "react";

export type GeoCoords = { lat: number; lng: number };

const STORAGE_KEY = "agroloop:geolocation";

function readCached(): GeoCoords | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.lat === "number" &&
      typeof parsed.lng === "number"
    ) {
      return parsed;
    }
  } catch {}
  return null;
}

export function useGeolocation() {
  const [coords, setCoords] = useState<GeoCoords | null>(() => readCached());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback((): Promise<GeoCoords | null> => {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) {
        setError("Géolocalisation non supportée");
        resolve(null);
        return;
      }
      setLoading(true);
      setError(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(c));
          } catch {}
          setCoords(c);
          setLoading(false);
          resolve(c);
        },
        (err) => {
          setError(err.message || "Impossible d'obtenir la position");
          setLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
      );
    });
  }, []);

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    setCoords(null);
  }, []);

  return { coords, loading, error, request, clear };
}
