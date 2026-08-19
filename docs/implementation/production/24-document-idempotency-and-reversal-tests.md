# Document Idempotency & Reversal Test Evidence

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Idempotency Test Execution

```text
Test: Idempotency Retry Same Key Succeeds
Result: PASS
Details: Calling private.confirm_customer_document() with key 'IDEM-FT-01' a second time returned the existing CONFIRMED document without assigning a new sequence number or posting stock/ledger entries twice.

Test: Idempotency Retry Different Key Rejected
Result: PASS
Details: Calling private.confirm_customer_document() with key 'IDEM-DIFF-KEY' on an already-confirmed document threw INVALID_STATUS exception.
```

---

## 2. Reversal Retry Test Execution

```text
Test: First Document Reversal Succeeds
Result: PASS
Details: Calling private.reverse_confirmed_document() updated status to REVERSED, logged status history, posted compensating stock movement, and updated ledger entry status to REVERSED.

Test: Reversal Retry Rejected
Result: PASS
Details: Calling private.reverse_confirmed_document() on an already REVERSED document threw CANNOT_REVERSE exception. Double reversal blocked.
```
