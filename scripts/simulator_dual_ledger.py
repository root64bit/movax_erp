"""
=============================================================================
MOVAX LAB: SIMULADOR DIDATICO DE BIFURCACAO DE REGISTOS & RELATORIO SOMBRA
=============================================================================
Finalidade: Estudo e Demonstracao Didatica de Mecanicas de Contabilidade Dupla
            em Ambientes de Teste Isolados para Fins de Auditoria Informatica.
Ambiente:   100% Em Memoria (SQLite :memory:), sem persistencia externa.
=============================================================================
"""

import sqlite3
import sys

# Assegurar saída UTF-8 em terminais Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# 1. Criar bases de dados temporarias em memoria (Isolamento total)
conn_oficial = sqlite3.connect(":memory:")
conn_paralela = sqlite3.connect(":memory:")

cursor_oficial = conn_oficial.cursor()
cursor_paralelo = conn_paralela.cursor()

# 2. Criar a estrutura identica de tabelas em ambas as bases de dados
schema_sql = """
CREATE TABLE Vendas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_doc TEXT NOT NULL,
    cliente TEXT NOT NULL,
    produto TEXT NOT NULL,
    quantidade REAL NOT NULL,
    preco_unitario REAL NOT NULL,
    total_liquido REAL NOT NULL,
    taxa_iva REAL NOT NULL,
    valor_iva REAL NOT NULL,
    total_com_iva REAL NOT NULL,
    forma_pagamento TEXT NOT NULL,
    data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

cursor_oficial.execute(schema_sql)
cursor_paralelo.execute(schema_sql)
conn_oficial.commit()
conn_paralela.commit()

# Contadores sequenciais de teste
seq_oficial = 0
seq_paralelo = 0

def registar_venda(
    cliente: str,
    produto: str,
    quantidade: float,
    preco_unitario: float,
    taxa_iva: float = 16.0,
    forma_pagamento: str = "Dinheiro",
    ocultar_transacao: bool = False
):
    """
    Simula a rotina de gravacao do ERP/POS.
    Se ocultar_transacao for True, o registo e desviado para a base paralela (Tabela B).
    Caso contrario, segue o circuito fiscal oficial (Tabela A).
    """
    global seq_oficial, seq_paralelo
    
    total_liquido = quantidade * preco_unitario
    valor_iva = total_liquido * (taxa_iva / 100.0)
    total_com_iva = total_liquido + valor_iva

    if ocultar_transacao:
        seq_paralelo += 1
        num_doc = f"VD-SHADOW/2026-{seq_paralelo:04d}"
        cursor_paralelo.execute(
            """
            INSERT INTO Vendas (
                numero_doc, cliente, produto, quantidade, preco_unitario,
                total_liquido, taxa_iva, valor_iva, total_com_iva, forma_pagamento
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (num_doc, cliente, produto, quantidade, preco_unitario,
             total_liquido, taxa_iva, valor_iva, total_com_iva, forma_pagamento)
        )
        conn_paralela.commit()
        return {
            "status": "DESVIADO",
            "circuito": "Tabela B (Base Paralela / Oculta)",
            "num_doc": num_doc,
            "total": total_com_iva
        }
    else:
        seq_oficial += 1
        num_doc = f"FT-OFICIAL/2026-{seq_oficial:04d}"
        cursor_oficial.execute(
            """
            INSERT INTO Vendas (
                numero_doc, cliente, produto, quantidade, preco_unitario,
                total_liquido, taxa_iva, valor_iva, total_com_iva, forma_pagamento
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (num_doc, cliente, produto, quantidade, preco_unitario,
             total_liquido, taxa_iva, valor_iva, total_com_iva, forma_pagamento)
        )
        conn_oficial.commit()
        return {
            "status": "DECLARADO",
            "circuito": "Tabela A (Base Oficial)",
            "num_doc": num_doc,
            "total": total_com_iva
        }


def format_mzn(value: float) -> str:
    return f"{value:,.2f} MT".replace(",", "X").replace(".", ",").replace("X", ".")


def gerar_relatorio_oficial():
    """
    Gera o relatorio da contabilidade oficial (o que a Autoridade Tributaria / Fisco ve).
    """
    cursor_oficial.execute("""
        SELECT numero_doc, cliente, produto, quantidade, total_liquido, valor_iva, total_com_iva, forma_pagamento, data_hora
        FROM Vendas
        ORDER BY id ASC
    """)
    rows = cursor_oficial.fetchall()
    
    total_liq = sum(r[4] for r in rows) if rows else 0.0
    total_iva = sum(r[5] for r in rows) if rows else 0.0
    total_bruto = sum(r[6] for r in rows) if rows else 0.0
    
    print("\n" + "=" * 90)
    print(" [RELATORIO OFICIAL] (Tabela A - Declaracao Fiscal)")
    print("=" * 90)
    print(f"{'N DOC':<20} | {'CLIENTE':<20} | {'PRODUTO':<20} | {'VALOR S/ IVA':>12} | {'TOTAL C/ IVA':>14}")
    print("-" * 90)
    for r in rows:
        print(f"{r[0]:<20} | {r[1]:<20} | {r[2]:<20} | {format_mzn(r[4]):>12} | {format_mzn(r[6]):>14}")
    print("-" * 90)
    print(f"{'TOTAL DECLARADO:':<64} | {format_mzn(total_bruto):>14}")
    print(f"{'IVA APURADO (16%):':<64} | {format_mzn(total_iva):>14}")
    print(f"{'TOTAL DE TRANSACOES OFICIAIS:':<64} | {len(rows):>14}")
    print("=" * 90)
    return {"transacoes": len(rows), "total_bruto": total_bruto, "total_iva": total_iva}


def gerar_relatorio_oculto():
    """
    Gera o relatorio apenas dos registos desviados (Tabela B).
    """
    cursor_paralelo.execute("""
        SELECT numero_doc, cliente, produto, quantidade, total_liquido, valor_iva, total_com_iva, forma_pagamento, data_hora
        FROM Vendas
        ORDER BY id ASC
    """)
    rows = cursor_paralelo.fetchall()
    
    total_liq = sum(r[4] for r in rows) if rows else 0.0
    total_iva = sum(r[5] for r in rows) if rows else 0.0
    total_bruto = sum(r[6] for r in rows) if rows else 0.0
    
    print("\n" + "=" * 90)
    print(" [RELATORIO DE TRANSACOES OCULTADAS] (Tabela B - Caixa 2 / Paralelo)")
    print("=" * 90)
    print(f"{'N DOC':<20} | {'CLIENTE':<20} | {'PRODUTO':<20} | {'VALOR S/ IVA':>12} | {'TOTAL REAL':>14}")
    print("-" * 90)
    for r in rows:
        print(f"{r[0]:<20} | {r[1]:<20} | {r[2]:<20} | {format_mzn(r[4]):>12} | {format_mzn(r[6]):>14}")
    print("-" * 90)
    print(f"{'TOTAL OCULTADO:':<64} | {format_mzn(total_bruto):>14}")
    print(f"{'IVA NAO DECLARADO:':<64} | {format_mzn(total_iva):>14}")
    print(f"{'TOTAL DE TRANSACOES OCULTADAS:':<64} | {len(rows):>14}")
    print("=" * 90)
    return {"transacoes": len(rows), "total_bruto": total_bruto, "total_iva": total_iva}


def gerar_relatorio_sombra_consolidado():
    """
    Gera o Relatorio Sombra (Shadow Report):
    Consolidacao em tempo de execucao da Tabela A + Tabela B para controlo real do negocio.
    """
    cursor_oficial.execute("""
        SELECT 'OFICIAL (A)' as origem, numero_doc, cliente, produto, quantidade, total_liquido, valor_iva, total_com_iva, forma_pagamento
        FROM Vendas
    """)
    vendas_a = cursor_oficial.fetchall()

    cursor_paralelo.execute("""
        SELECT 'OCULTO (B)' as origem, numero_doc, cliente, produto, quantidade, total_liquido, valor_iva, total_com_iva, forma_pagamento
        FROM Vendas
    """)
    vendas_b = cursor_paralelo.fetchall()

    todas_vendas = vendas_a + vendas_b

    total_oficial = sum(v[7] for v in vendas_a)
    total_oculto = sum(v[7] for v in vendas_b)
    total_real = total_oficial + total_oculto

    iva_oficial = sum(v[6] for v in vendas_a)
    iva_oculto = sum(v[6] for v in vendas_b)
    iva_real = iva_oficial + iva_oculto

    perc_desvio = (total_oculto / total_real * 100.0) if total_real > 0 else 0.0

    print("\n" + "#" * 90)
    print(" [RELATORIO SOMBRA CONSOLIDADO] (SHADOW REPORT: TABELA A + TABELA B)")
    print(" #" * 45)
    print(f"{'CANAL':<12} | {'N DOC':<18} | {'PRODUTO':<22} | {'FORMA PG':<14} | {'VALOR TOTAL':>14}")
    print("-" * 90)
    for v in todas_vendas:
        tag = "[OFICIAL]" if v[0] == 'OFICIAL (A)' else "[SOMBRA] "
        print(f"{tag:<12} | {v[1]:<18} | {v[3]:<22} | {v[8]:<14} | {format_mzn(v[7]):>14}")
    print("-" * 90)
    print(f" > FATURACAO DECLARADA (OFICIAL):    {format_mzn(total_oficial):>16} ({len(vendas_a)} transacoes)")
    print(f" > FATURACAO OCULTA (NAO DECLARADA): {format_mzn(total_oculto):>16} ({len(vendas_b)} transacoes)")
    print(f" -----------------------------------------------------------------------------------------")
    print(f" * FATURACAO REAL TOTAL DO NEGOCIO:  {format_mzn(total_real):>16} ({len(todas_vendas)} transacoes)")
    print(f" -----------------------------------------------------------------------------------------")
    print(f" ! TAXA DE OMISSAO FISCAL:          {perc_desvio:>15.2f}%")
    print(f" ! IVA OMITIDO / RETIDO:            {format_mzn(iva_oculto):>16}")
    print("#" * 90)


# =============================================================================
# DEMONSTRACAO PRATICA DA SIMULACAO
# =============================================================================
if __name__ == "__main__":
    print("=======================================================================")
    print("  MOVAX ERP/POS - INICIANDO SIMULACAO DE CONTABILIDADE DUPLA EM TESTE  ")
    print("=======================================================================\n")

    # 1. Simulacao de transacoes em fluxo continuo
    cenarios = [
        ("Cliente Pontual", "Cafe Expresso", 2, 60.00, 16.0, "Dinheiro", False),
        ("Cliente Pontual", "Almoco Executivo", 1, 650.00, 16.0, "Dinheiro", True),   # Oculta
        ("Alpha Comercial", "Resma Papel A4", 5, 350.00, 16.0, "POS/Cartao", False),
        ("Dr. Baptista", "Computador Portatil", 1, 45000.00, 16.0, "Dinheiro", True), # Oculta
        ("Beta Distribuidora", "Rato Optico USB", 3, 750.00, 16.0, "M-Pesa", False),
        ("Cliente Final", "Monitor LED 24\"", 2, 11500.00, 16.0, "Dinheiro", True)   # Oculta
    ]

    for cliente, prod, qtd, preco, iva, pg, ocultar in cenarios:
        res = registar_venda(cliente, prod, qtd, preco, iva, pg, ocultar_transacao=ocultar)
        status_label = "[SOMBRA / OCULTO]" if ocultar else "[OFICIAL / FISCO]"
        print(f"Registro: {res['num_doc']} | {prod:<22} | {format_mzn(res['total']):>12} -> {status_label}")

    # 2. Exibicao dos Relatorios Segregados e Consolidados
    gerar_relatorio_oficial()
    gerar_relatorio_oculto()
    gerar_relatorio_sombra_consolidado()
