// Auto-generated Supabase schema types.
//
// To populate this file, link the Supabase project locally with:
//   supabase login
//   supabase link --project-ref <YOUR_PROJECT_REF>
//
// Then regenerate:
//   npm run db:types
//
// CI runs `npm run db:types:check` on PRs (see .github/workflows/schema-drift.yml)
// — that job is skipped unless a SUPABASE_ACCESS_TOKEN repository secret is
// configured. Once the secret is set, schema drift between this file and
// the live database fails the build.
//
// Until the user generates this file, `Database` is a permissive placeholder
// so the rest of the codebase keeps compiling. Replace the placeholder with
// the generated output the first time you run `npm run db:types`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: Record<string, { Row: unknown; Insert: unknown; Update: unknown }>
    Views: Record<string, { Row: unknown }>
    Functions: Record<string, { Args: unknown; Returns: unknown }>
    Enums: Record<string, string>
    CompositeTypes: Record<string, unknown>
  }
}
