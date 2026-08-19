# Dashboard live-data verification

Dashboard monetary and count metrics come from `get_dashboard_metrics` using server date, company scope, branch scope, and warehouse access. Recent rows come from bounded RLS queries. Empty database results show explicit empty messages rather than examples or fabricated positive totals.
