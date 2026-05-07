# Microsoft SSO setup

Phase 1 Microsoft SSO uses Supabase Auth with the Microsoft Entra ID (Azure AD) provider. Microsoft handles identity, passwords, and MFA; Panorama stores/uses the internal user record, roles, and permissions.

## Required environment

Frontend (Vercel):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_OAUTH_REDIRECT_URL` (optional; defaults to `{app-origin}/auth/callback`)

Backend (FastAPI):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)
- `SECRET_KEY` and existing API/JWT settings

## Azure app registration

1. In Microsoft Entra ID, create or open an app registration for Panorama.
2. Add a Web redirect URI for the Supabase callback URL:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
3. Create a client secret.
4. Ensure the app can read the signed-in user's basic profile and email. No Graph integrations are required for Phase 1.

## Supabase provider setup

1. In Supabase, open **Authentication > Providers > Azure**.
2. Enable the provider.
3. Enter the Azure app registration client ID and client secret.
4. Add the app callback URL to **Authentication > URL Configuration > Redirect URLs**:
   - Production example: `https://panorama.helixsystems.ca/auth/callback`
   - Local example: `http://localhost:3000/auth/callback`
5. Set the site URL to the deployed app origin.

## Application behavior

- The login page starts `supabase.auth.signInWithOAuth({ provider: "azure" })`.
- The `/auth/callback` page exchanges the Supabase Microsoft session with FastAPI.
- FastAPI verifies the Supabase user through `/auth/v1/user`, requires the Microsoft/Azure provider, then looks up the internal user by normalized email.
- If no internal user exists, FastAPI creates a standard `worker` profile with `auth_provider = "microsoft"`.
- Existing roles, permissions, protected routes, and Pulse JWT middleware continue to authorize the user.

Do not configure Microsoft groups, tenant restrictions, SharePoint, Teams, Outlook, or Graph API permissions for this phase.
