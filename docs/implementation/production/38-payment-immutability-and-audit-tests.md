# Payment Immutability & Audit Test Evidence

> **Target Project:** `bkbcgndzsfylwsinxwbb.supabase.co`  

---

## 1. Immutability Enforcements

- Confirmed payment headers, payment method entries, and confirmed receipt numbers are immutable.
- Attempting to update `total_amount` or `payment_number` on a `CONFIRMED` payment via direct UPDATE throws RLS / permission violation.
- Modifications require explicit reversal via `private.reverse_payment(...)`.
