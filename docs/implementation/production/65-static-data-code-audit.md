# Static data code audit

`src/data/mockData.ts` and all production mock imports/fallback-success paths were removed. Fabricated sale numbers, stock references, operators, entities, default quantities/prices, sample city/address, and sample purchase references were removed. Company identity is loaded from Supabase. Official codes remain in TypeScript only where required for API typing and permission contracts.
