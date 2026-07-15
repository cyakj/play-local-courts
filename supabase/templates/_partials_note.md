# TenisX Auth Email Templates

These HTML files are wired into `supabase/config.toml` under `[auth.email.template.*]`
and pushed to the hosted project via `supabase config push`. They use Supabase's
built-in Go-template variables (`{{ .ConfirmationURL }}`, etc.) — never hardcoded URLs.

Do not reference `lovable.app` or any non-TenisX domain in these files.
