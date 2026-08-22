"""
====================================================================================
SIMULADOR DIDÁTICO DE AUDITORIA INFORMÁTICA E INTEGRIDADE DE ERP / POS
====================================================================================
Objetivo:
Demonstrar computacionalmente a diferença estrutural entre:
 1. Um ERP com Arquitetura Legítima (Fluxo Linear, Integridade Referencial e Rastreabilidade).
 2. Um ERP com Arquitetura Anómala (Bifurcação de Fluxo, Tabela Paralela e Baixa Cega de Stock).
 3. Um Motor de Auditoria Forense que deteta matematicamente desvios e quebras de inventário.
====================================================================================
"""

import sqlite3
import hashlib
import json
from datetime import datetime


# ==================================================================================
# 1. ARQUITETURA LEGÍTIMA (FLUXO LINEAR UNIFICADO)
# ==================================================================================
class ERPLegitimo:
    def __init__(self):
        # Base de dados única em memória
        self.conn = sqlite3.connect(":memory:")
        self.conn.execute("PRAGMA foreign_keys = ON;")
        self.cursor = self.conn.cursor()
        self._criar_schema()
        self.ultimo_hash = "GENESIS"

    def _criar_schema(self):
        self.cursor.executescript("""
            CREATE TABLE produtos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                preco REAL NOT NULL,
                stock_atual INTEGER NOT NULL
            );

            CREATE TABLE faturas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_fatura TEXT UNIQUE NOT NULL,
                produto_id INTEGER NOT NULL,
                quantidade INTEGER NOT NULL,
                valor_total REAL NOT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                hash_assinatura TEXT NOT NULL,
                FOREIGN KEY (produto_id) REFERENCES produtos(id)
            );

            CREATE TABLE movimentos_stock (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                produto_id INTEGER NOT NULL,
                fatura_id INTEGER NOT NULL,
                quantidade_saida INTEGER NOT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (produto_id) REFERENCES produtos(id),
                FOREIGN KEY (fatura_id) REFERENCES faturas(id)
            );
        """)
        # Inserir stock inicial
        self.cursor.executemany(
            "INSERT INTO produtos (nome, preco, stock_atual) VALUES (?, ?, ?)",
            [("Café", 1.50, 100), ("Almoço Executivo", 15.00, 50), ("Água Mineral", 1.00, 80)]
        )
        self.conn.commit()

    def _gerar_hash_fiscal(self, num_doc, total):
        payload = f"{self.ultimo_hash};{num_doc};{total:.2f};{datetime.utcnow().isoformat()}"
        novo_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        self.ultimo_hash = novo_hash
        return novo_hash

    def registar_venda(self, produto_id: int, quantidade: int):
        self.cursor.execute("SELECT nome, preco, stock_atual FROM produtos WHERE id = ?", (produto_id,))
        produto = self.cursor.fetchone()
        if not produto:
            raise ValueError("Produto inexistente.")

        nome, preco, stock = produto
        if stock < quantidade:
            raise ValueError(f"Stock insuficiente para {nome}.")

        valor_total = preco * quantidade
        num_fatura = f"FT 2026/{self.cursor.execute('SELECT COUNT(*) FROM faturas').fetchone()[0] + 1}"
        hash_doc = self._gerar_hash_fiscal(num_fatura, valor_total)

        # Transação atómica: Fatura + Baixa de Stock + Registo de Movimento
        self.cursor.execute(
            "INSERT INTO faturas (numero_fatura, produto_id, quantidade, valor_total, hash_assinatura) VALUES (?, ?, ?, ?, ?)",
            (num_fatura, produto_id, quantidade, valor_total, hash_doc)
        )
        fatura_id = self.cursor.lastrowid

        self.cursor.execute(
            "INSERT INTO movimentos_stock (produto_id, fatura_id, quantidade_saida) VALUES (?, ?, ?)",
            (produto_id, fatura_id, quantidade)
        )

        self.cursor.execute(
            "UPDATE produtos SET stock_atual = stock_atual - ? WHERE id = ?",
            (quantidade, produto_id)
        )
        self.conn.commit()
        return f"[LEGÍTIMO] Venda emitida: {num_fatura} | {nome} x{quantidade} = {valor_total:.2f}€"

    def obter_relatorio_oficial(self):
        self.cursor.execute("SELECT numero_fatura, valor_total, data_hora FROM faturas")
        return self.cursor.fetchall()

    def obter_relatorio_gestao(self):
        # Numa arquitetura legítima, o relatório de gestão consulta exatamente as mesmas faturas
        return self.obter_relatorio_oficial()


# ==================================================================================
# 2. ARQUITETURA ANÓMALA / BIFURCADA (SISTEMA COM FLUXO OCULTO / PARALELO)
# ==================================================================================
class ERPAnomalo:
    def __init__(self):
        # Base de dados A (Oficial) e Base de dados B (Paralela / Oculta)
        self.conn_oficial = sqlite3.connect(":memory:")
        self.conn_paralela = sqlite3.connect(":memory:")
        self._criar_schema()

    def _criar_schema(self):
        # Tabela Oficial A
        self.conn_oficial.executescript("""
            CREATE TABLE produtos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                preco REAL NOT NULL,
                stock_atual INTEGER NOT NULL
            );

            CREATE TABLE faturas_oficiais (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_fatura TEXT UNIQUE NOT NULL,
                produto_id INTEGER NOT NULL,
                quantidade INTEGER NOT NULL,
                valor_total REAL NOT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        # Stock inicial
        self.conn_oficial.executemany(
            "INSERT INTO produtos (nome, preco, stock_atual) VALUES (?, ?, ?)",
            [("Café", 1.50, 100), ("Almoço Executivo", 15.00, 50), ("Água Mineral", 1.00, 80)]
        )
        self.conn_oficial.commit()

        # Tabela B (Sombra / Paralela)
        self.conn_paralela.executescript("""
            CREATE TABLE vendas_ocultas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                produto_id INTEGER NOT NULL,
                quantidade INTEGER NOT NULL,
                valor_total REAL NOT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                payload_encriptado TEXT
            );
        """)
        self.conn_paralela.commit()

    def registar_venda(self, produto_id: int, quantidade: int, ocultar_transacao: bool = False):
        """
        BIFURCAÇÃO ANÓMALA:
        Se 'ocultar_transacao' for True:
          - A venda NÃO gera fatura fiscal oficial.
          - É gravada na tabela oculta B.
          - O stock físico na Tabela Oficial A É DEPRECIADO na mesma (para que o stock real bata certo no balcão).
        """
        cursor_of = self.conn_oficial.cursor()
        cursor_of.execute("SELECT nome, preco, stock_atual FROM produtos WHERE id = ?", (produto_id,))
        produto = cursor_of.fetchone()
        if not produto:
            raise ValueError("Produto inexistente.")

        nome, preco, stock = produto
        if stock < quantidade:
            raise ValueError(f"Stock insuficiente para {nome}.")

        valor_total = preco * quantidade

        if ocultar_transacao:
            # 1. Grava na base paralela B
            cursor_par = self.conn_paralela.cursor()
            payload = json.dumps({"produto": nome, "valor": valor_total, "tipo": "OFF_THE_BOOKS"})
            cursor_par.execute(
                "INSERT INTO vendas_ocultas (produto_id, quantidade, valor_total, payload_encriptado) VALUES (?, ?, ?, ?)",
                (produto_id, quantidade, valor_total, payload)
            )
            self.conn_paralela.commit()

            # 2. Desvio crítico: O stock físico é baixado sem documento oficial de suporte
            cursor_of.execute(
                "UPDATE produtos SET stock_atual = stock_atual - ? WHERE id = ?",
                (quantidade, produto_id)
            )
            self.conn_oficial.commit()

            return f"[ANÓMALO - BIFURCAÇÃO] 🔴 Venda Oculta Registada (Tabela B): {nome} x{quantidade} = {valor_total:.2f}€ (Stock baixado sem fatura)"
        else:
            # Fluxo Oficial (Tabela A)
            num_fatura = f"FT 2026/{cursor_of.execute('SELECT COUNT(*) FROM faturas_oficiais').fetchone()[0] + 1}"
            cursor_of.execute(
                "INSERT INTO faturas_oficiais (numero_fatura, produto_id, quantidade, valor_total) VALUES (?, ?, ?, ?)",
                (num_fatura, produto_id, quantidade, valor_total)
            )
            cursor_of.execute(
                "UPDATE produtos SET stock_atual = stock_atual - ? WHERE id = ?",
                (quantidade, produto_id)
            )
            self.conn_oficial.commit()
            return f"[ANÓMALO - OFICIAL] 🟢 Venda Oficial (Tabela A): {num_fatura} | {nome} x{quantidade} = {valor_total:.2f}€"

    def obter_relatorio_oficial(self):
        """O que o Auditor Fiscal / Autoridade Tributária visualiza."""
        cursor = self.conn_oficial.cursor()
        cursor.execute("SELECT numero_fatura, valor_total, data_hora FROM faturas_oficiais")
        return cursor.fetchall()

    def obter_relatorio_gestao_sombra(self):
        """O que o Administrador visualiza (Consolidação A + B)."""
        cursor_of = self.conn_oficial.cursor()
        cursor_of.execute("SELECT numero_fatura, valor_total FROM faturas_oficiais")
        oficiais = [(r[0], r[1], "OFICIAL") for r in cursor_of.fetchall()]

        cursor_par = self.conn_paralela.cursor()
        cursor_par.execute("SELECT id, valor_total FROM vendas_ocultas")
        ocultas = [(f"SHADOW-{r[0]}", r[1], "OCULTO") for r in cursor_par.fetchall()]

        return oficiais + ocultas


# ==================================================================================
# 3. MOTOR DE AUDITORIA FORENSE (MÉTODOS DE DETEÇÃO INFORMÁTICA)
# ==================================================================================
class MotorAuditoriaForense:
    @staticmethod
    def auditar_reconciliacao_stock(conn, stock_inicial_dict, nome_tabela_faturas="faturas"):
        """
        Técnica Forense 1: Reconciliação Matemática de Fluxos de Inventário
        Equação de Integridade: Stock_Atual_Esperado = Stock_Inicial - Total_Vendas_Faturadas
        Se Stock_Real < Stock_Atual_Esperado sem justificação de quebra documental, há desvio.
        """
        cursor = conn.cursor()
        cursor.execute("SELECT id, nome, stock_atual FROM produtos")
        produtos = cursor.fetchall()

        relatorio_auditoria = []
        ha_anomalia = False

        for prod_id, nome, stock_atual in produtos:
            stock_ini = stock_inicial_dict.get(prod_id, 0)
            
            # Consultar total de unidades faturadas oficialmente
            cursor.execute(
                f"SELECT COALESCE(SUM(quantidade), 0) FROM {nome_tabela_faturas} WHERE produto_id = ?",
                (prod_id,)
            )
            unidades_faturadas = cursor.fetchone()[0]

            stock_esperado = stock_ini - unidades_faturadas
            discrepancia = stock_atual - stock_esperado

            status = "CONFORME" if discrepancia == 0 else "ANOMALIA DETETADA"
            if discrepancia != 0:
                ha_anomalia = True

            relatorio_auditoria.append({
                "produto": nome,
                "stock_inicial": stock_ini,
                "unidades_faturadas": unidades_faturadas,
                "stock_esperado_contabilistico": stock_esperado,
                "stock_fisico_real": stock_atual,
                "discrepancia_unidades": discrepancia,
                "status": status
            })

        return ha_anomalia, relatorio_auditoria


# ==================================================================================
# 4. EXECUÇÃO COMPARATIVA E SIMULAÇÃO DE CENÁRIOS
# ==================================================================================
def executar_simulacao():
    print("=" * 80)
    print("DEMONSTRAÇÃO DE AUDITORIA: ARQUITETURA LEGÍTIMA VS ARQUITETURA ANÓMALA")
    print("=" * 80)

    stock_inicial = {1: 100, 2: 50, 3: 80} # 100 Cafés, 50 Almoços, 80 Águas

    # ------------------------------------------------------------------------------
    # CENÁRIO 1: ERP LEGÍTIMO
    # ------------------------------------------------------------------------------
    print("\n" + "#" * 30 + " CENÁRIO 1: ERP LEGÍTIMO " + "#" * 30)
    erp_legitimo = ERPLegitimo()
    
    print("\n--- Registo de Transações ---")
    print(erp_legitimo.registar_venda(produto_id=1, quantidade=2)) # 2 Cafés
    print(erp_legitimo.registar_venda(produto_id=2, quantidade=1)) # 1 Almoço
    print(erp_legitimo.registar_venda(produto_id=3, quantidade=5)) # 5 Águas

    # Auditoria no ERP Legítimo
    anomalia_1, resultados_1 = MotorAuditoriaForense.auditar_reconciliacao_stock(
        erp_legitimo.conn, stock_inicial, nome_tabela_faturas="faturas"
    )

    print("\n--- Relatório de Auditoria de Inventário (ERP Legítimo) ---")
    for r in resultados_1:
        print(f"Produto: {r['produto']:<18} | Stock Ini: {r['stock_inicial']:>3} | Faturado: {r['unidades_faturadas']:>2} | Esperado: {r['stock_esperado_contabilistico']:>3} | Real: {r['stock_fisico_real']:>3} | [{r['status']}]")
    print(f"Conclusão Auditoria: {'🚨 FRAUDE/ANOMALIA' if anomalia_1 else '✅ SISTEMA 100% AUDITÁVEL E CONFORME'}")

    # ------------------------------------------------------------------------------
    # CENÁRIO 2: ERP ANÓMALO (COM BIFURCAÇÃO DE CÓDIGO E TABELA B)
    # ------------------------------------------------------------------------------
    print("\n" + "#" * 30 + " CENÁRIO 2: ERP ANÓMALO (BIFURCADO) " + "#" * 30)
    erp_anomalo = ERPAnomalo()

    print("\n--- Registo de Transações ---")
    print(erp_anomalo.registar_venda(produto_id=1, quantidade=2, ocultar_transacao=False)) # 2 Cafés (Oficial)
    print(erp_anomalo.registar_venda(produto_id=2, quantidade=10, ocultar_transacao=True)) # 10 Almoços (OCULTO - 150€)
    print(erp_anomalo.registar_venda(produto_id=3, quantidade=5, ocultar_transacao=False)) # 5 Águas (Oficial)

    print("\n--- Visão do Fisco (Relatório Oficial da Tabela A) ---")
    oficiais = erp_anomalo.obter_relatorio_oficial()
    total_oficial = sum(f[1] for f in oficiais)
    for doc in oficiais:
        print(f"Doc: {doc[0]} | Valor: {doc[1]:.2f}€")
    print(f"Total Faturado Declarado: {total_oficial:.2f}€")

    print("\n--- Visão do Painel Sombra do Dono (Consolidação A + B) ---")
    todos = erp_anomalo.obter_relatorio_gestao_sombra()
    total_real = sum(t[1] for t in todos)
    for doc in todos:
        print(f"Registo: {doc[0]:<12} | Valor: {doc[1]:>6.2f}€ | Canal: {doc[2]}")
    print(f"Receita Real em Caixa: {total_real:.2f}€ (Desvio Oculto Não Declarado: {total_real - total_oficial:.2f}€)")

    # Auditoria Forense no ERP Anómalo
    anomalia_2, resultados_2 = MotorAuditoriaForense.auditar_reconciliacao_stock(
        erp_anomalo.conn_oficial, stock_inicial, nome_tabela_faturas="faturas_oficiais"
    )

    print("\n--- Relatório de Auditoria Forense (Incompatibilidade Stock vs Faturas) ---")
    for r in resultados_2:
        print(f"Produto: {r['produto']:<18} | Stock Ini: {r['stock_inicial']:>3} | Faturado: {r['unidades_faturadas']:>2} | Esperado: {r['stock_esperado_contabilistico']:>3} | Real: {r['stock_fisico_real']:>3} | [{r['status']}] (Discrepância: {r['discrepancia_unidades']} un)")
    print(f"Conclusão Auditoria: {'🚨 ALERTA: ANOMALIA E EVASÃO DE DADOS DETETADA!' if anomalia_2 else '✅ CONFORME'}")


if __name__ == "__main__":
    executar_simulacao()
