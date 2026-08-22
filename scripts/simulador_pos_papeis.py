# -*- coding: utf-8 -*-
"""
====================================================================================
SIMULADOR DIDATICO DE POS / ERP COM PAPEIS DE UTILIZADOR (OPERADOR E ADMIN)
====================================================================================
Finalidade:
Demonstrar a nivel arquitetural e de fluxo de dados a interacao entre:
 1. Autenticacao e Controlo de Acesso (Operador de Caixa vs Administrador).
 2. Terminal do Operador (Venda Oficial vs Venda em Modo Alternativo/Paralelo).
 3. Painel do Administrador (Visao Oficial, Visao Sombra Consolidada e Saldo Real de Caixa).
====================================================================================
"""

import sqlite3
import json
from datetime import datetime


class SistemaBaseDados:
    """
    Simula a infraestrutura de dados:
    - Base Oficial (Tabela A): Faturas declaradas e stock central.
    - Base Sombra (Tabela B): Transacoes paralelas/ocultas.
    """
    def __init__(self):
        self.conn_oficial = sqlite3.connect(":memory:")
        self.conn_paralela = sqlite3.connect(":memory:")
        self._inicializar_schemas()

    def _inicializar_schemas(self):
        # 1. Base Oficial
        cursor_of = self.conn_oficial.cursor()
        cursor_of.executescript("""
            CREATE TABLE utilizadores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                senha TEXT NOT NULL,
                papel TEXT NOT NULL -- 'OPERADOR' ou 'ADMIN'
            );

            CREATE TABLE produtos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                preco REAL NOT NULL,
                stock_atual INTEGER NOT NULL
            );

            CREATE TABLE faturas_oficiais (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero_fatura TEXT UNIQUE NOT NULL,
                operador TEXT NOT NULL,
                produto_id INTEGER NOT NULL,
                quantidade INTEGER NOT NULL,
                valor_total REAL NOT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Utilizadores padrao para teste
        cursor_of.executemany(
            "INSERT INTO utilizadores (username, senha, papel) VALUES (?, ?, ?)",
            [
                ("caixa01", "1234", "OPERADOR"),
                ("admin", "admin99", "ADMIN")
            ]
        )

        # Catalogo de produtos e stock inicial
        cursor_of.executemany(
            "INSERT INTO produtos (nome, preco, stock_atual) VALUES (?, ?, ?)",
            [
                ("Cafe Espresso", 1.50, 100),
                ("Almoco Executivo", 15.00, 50),
                ("Agua Mineral", 1.00, 80)
            ]
        )
        self.conn_oficial.commit()

        # 2. Base Paralela / Sombra
        cursor_par = self.conn_paralela.cursor()
        cursor_par.executescript("""
            CREATE TABLE vendas_sombra (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operador TEXT NOT NULL,
                produto_id INTEGER NOT NULL,
                quantidade INTEGER NOT NULL,
                valor_total REAL NOT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadados_json TEXT
            );
        """)
        self.conn_paralela.commit()


class SistemaAuth:
    """Gere a autenticacao dos utilizadores no POS."""
    def __init__(self, db: SistemaBaseDados):
        self.db = db

    def autenticar(self, username, senha):
        cursor = self.db.conn_oficial.cursor()
        cursor.execute(
            "SELECT id, username, papel FROM utilizadores WHERE username = ? AND senha = ?",
            (username, senha)
        )
        user = cursor.fetchone()
        if user:
            return {"id": user[0], "username": user[1], "papel": user[2]}
        return None


class TerminalPOS:
    """
    Ecra do Operador de Caixa:
    Regista produtos e executa as transacoes de venda.
    """
    def __init__(self, db: SistemaBaseDados, operador_logado: dict):
        self.db = db
        self.operador = operador_logado
        self.total_caixa_operador = 0.0

    def listar_produtos(self):
        cursor = self.db.conn_oficial.cursor()
        cursor.execute("SELECT id, nome, preco, stock_atual FROM produtos")
        return cursor.fetchall()

    def processar_venda(self, produto_id: int, quantidade: int, modo_oculto: bool = False):
        """
        Executa a venda no POS:
        - Se modo_oculto == False: Venda Oficial (Tabela A) + Baixa de Stock.
        - Se modo_oculto == True: Venda Sombra (Tabela B) + Baixa de Stock fisico.
        """
        cursor_of = self.db.conn_oficial.cursor()
        cursor_of.execute("SELECT nome, preco, stock_atual FROM produtos WHERE id = ?", (produto_id,))
        produto = cursor_of.fetchone()

        if not produto:
            return {"sucesso": False, "mensagem": "Produto nao encontrado."}

        nome, preco, stock = produto
        if stock < quantidade:
            return {"sucesso": False, "mensagem": f"Stock insuficiente para {nome} (Stock: {stock})."}

        valor_total = preco * quantidade
        self.total_caixa_operador += valor_total

        if modo_oculto:
            # 1. Grava na Base Paralela (Tabela B)
            cursor_par = self.db.conn_paralela.cursor()
            meta = json.dumps({"terminal": "POS-01", "tipo_registo": "PARALELO_SEM_FATURA"})
            cursor_par.execute(
                "INSERT INTO vendas_sombra (operador, produto_id, quantidade, valor_total, metadados_json) VALUES (?, ?, ?, ?, ?)",
                (self.operador["username"], produto_id, quantidade, valor_total, meta)
            )
            self.db.conn_paralela.commit()

            # 2. Baixa o stock fisico na base oficial (para o stock bater certo na prateleira)
            cursor_of.execute(
                "UPDATE produtos SET stock_atual = stock_atual - ? WHERE id = ?",
                (quantidade, produto_id)
            )
            self.db.conn_oficial.commit()

            return {
                "sucesso": True,
                "canal": "SOMBRA (Tabela B)",
                "documento": "Talao Nao Fiscal / Pre-Conta",
                "produto": nome,
                "quantidade": quantidade,
                "total": valor_total
            }
        else:
            # 1. Registo na Base Oficial (Tabela A)
            cursor_of.execute("SELECT COUNT(*) FROM faturas_oficiais")
            num_seq = cursor_of.fetchone()[0] + 1
            num_fatura = f"FT 2026/{num_seq}"

            cursor_of.execute(
                "INSERT INTO faturas_oficiais (numero_fatura, operador, produto_id, quantidade, valor_total) VALUES (?, ?, ?, ?, ?)",
                (num_fatura, self.operador["username"], produto_id, quantidade, valor_total)
            )
            # 2. Baixa o stock fisico
            cursor_of.execute(
                "UPDATE produtos SET stock_atual = stock_atual - ? WHERE id = ?",
                (quantidade, produto_id)
            )
            self.db.conn_oficial.commit()

            return {
                "sucesso": True,
                "canal": "OFICIAL (Tabela A)",
                "documento": num_fatura,
                "produto": nome,
                "quantidade": quantidade,
                "total": valor_total
            }


class PainelAdministracao:
    """
    Ecra do Administrador:
    Permite visualizar a consolidacao dos dois fluxos de dados.
    """
    def __init__(self, db: SistemaBaseDados, admin_logado: dict):
        if admin_logado["papel"] != "ADMIN":
            raise PermissionError("Acesso reservado ao perfil de Administrador.")
        self.db = db
        self.admin = admin_logado

    def relatorio_oficial(self):
        """Dados que serao exportados para SAF-T / Autoridade Tributaria."""
        cursor = self.db.conn_oficial.cursor()
        cursor.execute("""
            SELECT f.numero_fatura, f.operador, p.nome, f.quantidade, f.valor_total, f.data_hora
            FROM faturas_oficiais f
            JOIN produtos p ON f.produto_id = p.id
        """)
        return cursor.fetchall()

    def relatorio_sombra(self):
        """Transacoes paralelas que nao entraram na contabilidade oficial."""
        cursor = self.db.conn_paralela.cursor()
        cursor.execute("""
            SELECT v.id, v.operador, v.produto_id, v.quantidade, v.valor_total, v.data_hora
            FROM vendas_sombra v
        """)
        return cursor.fetchall()

    def relatorio_consolidado_gestao(self):
        """Visao unificada (Oficial + Oculto) para controlo financeiro real da empresa."""
        oficiais = self.relatorio_oficial()
        sombra = self.relatorio_sombra()

        linhas = []
        total_oficial = 0.0
        total_oculto = 0.0

        for item in oficiais:
            num_fat, op, prod_nome, qtd, total, dt = item
            total_oficial += total
            linhas.append({
                "origem": "OFICIAL (Tabela A)",
                "identificador": num_fat,
                "operador": op,
                "produto": prod_nome,
                "quantidade": qtd,
                "valor": total,
                "declarado_fisco": True
            })

        # Obter nomes dos produtos para as vendas sombra
        cursor_of = self.db.conn_oficial.cursor()
        for item in sombra:
            v_id, op, prod_id, qtd, total, dt = item
            total_oculto += total
            cursor_of.execute("SELECT nome FROM produtos WHERE id = ?", (prod_id,))
            nome_prod = cursor_of.fetchone()[0]

            linhas.append({
                "origem": "SOMBRA (Tabela B)",
                "identificador": f"DOC-INT-{v_id}",
                "operador": op,
                "produto": nome_prod,
                "quantidade": qtd,
                "valor": total,
                "declarado_fisco": False
            })

        return {
            "transacoes": linhas,
            "total_faturado_oficial": total_oficial,
            "total_desviado_oculto": total_oculto,
            "total_real_em_caixa": total_oficial + total_oculto
        }

    def estado_stock_produtos(self):
        cursor = self.db.conn_oficial.cursor()
        cursor.execute("SELECT id, nome, preco, stock_atual FROM produtos")
        return cursor.fetchall()


# ==================================================================================
# DEMONSTRACAO COMPLETA DO FLUXO (OPERADOR -> ADMIN)
# ==================================================================================
def main():
    print("=" * 75)
    print("DEMONSTRACAO DIDATICA: FLUXO DE CAIXA E PAINEL DE ADMINISTRACAO")
    print("=" * 75)

    db = SistemaBaseDados()
    auth = SistemaAuth(db)

    # ------------------------------------------------------------------------------
    # PASSO 1: LOGIN DO OPERADOR DE CAIXA
    # ------------------------------------------------------------------------------
    print("\n[1] LOGIN DO OPERADOR DE CAIXA")
    sessao_operador = auth.autenticar("caixa01", "1234")
    if not sessao_operador:
        print("Erro de autenticacao.")
        return

    print(f"-> Operador autenticado com sucesso: {sessao_operador['username']} (Papel: {sessao_operador['papel']})")
    pos = TerminalPOS(db, sessao_operador)

    # ------------------------------------------------------------------------------
    # PASSO 2: OPERACAO DO POS (VENDAS OFICIAIS E OCULTAS)
    # ------------------------------------------------------------------------------
    print("\n[2] REGISTO DE VENDAS NO TERMINAL DO CAIXA")

    # Venda 1: Normal / Oficial (2 Cafes)
    v1 = pos.processar_venda(produto_id=1, quantidade=2, modo_oculto=False)
    print(f"  [VENDA 1] {v1['canal']} | Doc: {v1['documento']} | {v1['produto']} x{v1['quantidade']} = {v1['total']:.2f} EUR")

    # Venda 2: Oculta / Modo B (1 Almoco Executivo)
    v2 = pos.processar_venda(produto_id=2, quantidade=1, modo_oculto=True)
    print(f"  [VENDA 2] {v2['canal']} | Doc: {v2['documento']} | {v2['produto']} x{v2['quantidade']} = {v2['total']:.2f} EUR")

    # Venda 3: Normal / Oficial (3 Aguas Minerais)
    v3 = pos.processar_venda(produto_id=3, quantidade=3, modo_oculto=False)
    print(f"  [VENDA 3] {v3['canal']} | Doc: {v3['documento']} | {v3['produto']} x{v3['quantidade']} = {v3['total']:.2f} EUR")

    # Venda 4: Oculta / Modo B (2 Almocos Executivos)
    v4 = pos.processar_venda(produto_id=2, quantidade=2, modo_oculto=True)
    print(f"  [VENDA 4] {v4['canal']} | Doc: {v4['documento']} | {v4['produto']} x{v4['quantidade']} = {v4['total']:.2f} EUR")

    print(f"\n-> Total Fisico de Dinheiro Contado na Gaveta do Operador: {pos.total_caixa_operador:.2f} EUR")

    # ------------------------------------------------------------------------------
    # PASSO 3: LOGIN DO ADMINISTRADOR E ANALISE DOS RELATORIOS
    # ------------------------------------------------------------------------------
    print("\n" + "=" * 75)
    print("[3] LOGIN DO ADMINISTRADOR NO PAINEL DE GESTAO")
    print("=" * 75)

    sessao_admin = auth.autenticar("admin", "admin99")
    print(f"-> Administrador autenticado: {sessao_admin['username']} (Papel: {sessao_admin['papel']})")
    painel = PainelAdministracao(db, sessao_admin)

    # 3.1 Relatorio Oficial
    print("\n--- [A] RELATORIO OFICIAL (O que o Fisco / SAF-T Visualiza) ---")
    oficiais = painel.relatorio_oficial()
    for item in oficiais:
        print(f"  Doc: {item[0]:<12} | Operador: {item[1]} | Item: {item[2]:<18} | Qtd: {item[3]} | Total: {item[4]:>6.2f} EUR")

    # 3.2 Painel Consolidado de Gestao
    print("\n--- [B] DASHBOARD DE GESTAO CONSOLIDADA DO ADMINISTRADOR ---")
    consolidado = painel.relatorio_consolidado_gestao()
    for row in consolidado["transacoes"]:
        status_declarado = "SIM" if row["declarado_fisco"] else "NAO (OCULTO)"
        print(f"  [{row['origem']:<18}] {row['identificador']:<12} | {row['produto']:<18} x{row['quantidade']} | {row['valor']:>6.2f} EUR | Declarado: {status_declarado}")

    print("\n" + "-" * 55)
    print(f"  Total Declarado Oficialmente : {consolidado['total_faturado_oficial']:>8.2f} EUR")
    print(f"  Total Desviado / Oculto      : {consolidado['total_desviado_oculto']:>8.2f} EUR")
    print(f"  TOTAL REAL EM CAIXA (Gaveta) : {consolidado['total_real_em_caixa']:>8.2f} EUR")
    print("-" * 55)

    # 3.3 Estado do Stock Fisico
    print("\n--- [C] ESTADO DO STOCK FISICO NO ARMAZEM ---")
    stocks = painel.estado_stock_produtos()
    for s in stocks:
        print(f"  ID: {s[0]} | Produto: {s[1]:<18} | Preco: {s[2]:>5.2f} EUR | Stock Fisico Restante: {s[3]} un")


if __name__ == "__main__":
    main()
