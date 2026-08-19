# Legacy Relationship Analysis — PROD-WP10

> **System Name:** XT-POS  

---

## 1. Relationship Mapping

- `FATURAS.DBF` -> `FATURAS_LINHAS.DBF` (1:N via `NUMERO` + `TIPO`)
- `FATURAS.DBF` -> `CLIENTES.DBF` (N:1 via `CODCLI` = `CLIENTES.CODIGO`)
- `FATURAS.DBF` -> `FORNEC.DBF` (N:1 via `CODFOR` = `FORNEC.CODIGO`)
- `RECIBOS.DBF` -> `RECIBOS_ALOC.DBF` (1:N via `NUMERO`)
- `RECIBOS_ALOC.DBF` -> `FATURAS.DBF` (N:1 via `NUMDOC` = `FATURAS.NUMERO`)
