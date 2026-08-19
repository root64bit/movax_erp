# Document Security & Immutability Architecture

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Immutability Controls

- **Confirmed Document Headers & Lines:** Once status transitions out of `DRAFT`, client `UPDATE` operations are blocked by RLS policy `documents_update`.
- **Reversals:** Corrections require authorized RPC invocation `private.reverse_confirmed_document(...)` which leaves an indelible audit trail and creates reversing stock and financial entries.
- **Sequence Number Protection:** Document numbers can never be modified or overwritten once assigned by `private.next_document_number(...)`.
