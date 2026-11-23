import { useEffect, useRef } from 'react';
import { notificationsApi } from '../api/index';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export function usePushSubscription(isAuthenticated) {
  const synced = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || synced.current) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    let cancelled = false;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        let sub = await reg.pushManager.getSubscription();

        if (!sub && VAPID_PUBLIC_KEY) {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted' || cancelled) return;

          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        if (sub && !cancelled) {
          await notificationsApi.subscribe(sub.toJSON());
          synced.current = true;
        }
      } catch {
        /* push subscription is non-critical */
      }
    })();

    return () => { cancelled = true; };
  }, [isAuthenticated]);
}
