"use client";

import { Loader2 } from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { QrGuestView } from "@/components/qr/QrGuestView";
import { isLoggedIn } from "@/lib/pulse-session";
import { loginHrefWithReturnTo, storeLoginReturnTo } from "@/lib/qr/qr-return-path";
import {
  resolveQrTokenAuthenticated,
  resolveQrTokenPublic,
  type QrResolveResult,
} from "@/lib/qr/qrResourceService";
import { parseClientApiError } from "@/lib/parse-client-api-error";

export default function QrResolvePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = String(params.token ?? "").trim().toUpperCase();
  const guestQuery = searchParams.get("guest") === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolve, setResolve] = useState<QrResolveResult | null>(null);
  const [showGuest, setShowGuest] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid QR code.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const authed = isLoggedIn();
        const result = authed
          ? await resolveQrTokenAuthenticated(token, guestQuery)
          : await resolveQrTokenPublic(token, guestQuery);

        if (cancelled) return;

        const guestAllowed =
          result.guest_access_enabled && result.guest_access_level === "read_only";

        if (!authed && guestAllowed && (guestQuery || result.requires_auth)) {
          setResolve(result);
          setShowGuest(true);
          setLoading(false);
          return;
        }

        if (!authed && result.requires_auth) {
          const returnPath = `/qr/${token}`;
          storeLoginReturnTo(returnPath);
          window.location.replace(loginHrefWithReturnTo(returnPath));
          return;
        }

        if (guestQuery && guestAllowed) {
          setResolve(result);
          setShowGuest(true);
          setLoading(false);
          return;
        }

        router.replace(result.destination_path);
      } catch (e) {
        if (!cancelled) {
          const parsed = parseClientApiError(e);
          if (parsed.status === 404) {
            setError("QR code not found. It may have been deleted or the label needs reprinting after a token change.");
          } else {
            setError(parsed.message);
          }
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, guestQuery, router]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-pulse-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Opening resource…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <p className="text-sm text-rose-600">{error}</p>
      </div>
    );
  }

  if (showGuest && resolve) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4 sm:p-8">
        <QrGuestView resolve={resolve} />
      </div>
    );
  }

  return null;
}
