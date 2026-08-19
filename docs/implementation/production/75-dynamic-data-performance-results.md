# Dynamic-data performance results

Shared list queries use explicit projections and limits (250–1,000 according to data class). Reports use server filters, totals, limit, and offset. Dashboard aggregates remain on the server. The production bundle contains no mock collection. Further per-screen cursor pagination and route lazy loading are tracked as optimisation work before high-volume rollout.
