import React, { useEffect, useState } from 'react';
import type { Article, ReferenceOption } from '@/shared/types/domain.types';

export interface NewArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (article: Omit<Article, 'id'>) => Promise<void>;
  onUpdate?: (article: Article) => Promise<void>;
  articleToEdit?: Article | null;
  existingArticles?: Article[];
  categories?: ReferenceOption[];
  brands?: ReferenceOption[];
  units?: ReferenceOption[];
  taxCodes?: ReferenceOption[];
}

export const NewArticleModal: React.FC<NewArticleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  articleToEdit,
  existingArticles = [],
  categories = [],
  brands = [],
  units = [],
  taxCodes = [],
}) => {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('Geral');
  const [brandName, setBrandName] = useState('');
  const [unit, setUnit] = useState('UN');
  const [minStock, setMinStock] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [profitMargin, setProfitMargin] = useState(25);
  const [sellPrice, setSellPrice] = useState(0);
  const [sellPriceWithIva, setSellPriceWithIva] = useState(0);
  const [taxRate, setTaxRate] = useState(16);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (articleToEdit) {
      setCode(articleToEdit.code);
      setDescription(articleToEdit.description);
      setCategoryName(articleToEdit.category || 'Geral');
      setBrandName(articleToEdit.brand || '');
      setUnit(articleToEdit.unit || 'UN');
      setMinStock(articleToEdit.minStock || 0);
      setCostPrice(articleToEdit.costPrice || 0);
      setProfitMargin(articleToEdit.profitMargin || 25);
      setSellPrice(articleToEdit.sellPrice || 0);
      setSellPriceWithIva(articleToEdit.sellPriceWithIva || 0);
      setTaxRate(articleToEdit.taxRate ?? 16);
    } else {
      setCode('');
      setDescription('');
      setCategoryName('Geral');
      setBrandName('');
      setUnit('UN');
      setMinStock(5);
      setCostPrice(0);
      setProfitMargin(25);
      setSellPrice(0);
      setSellPriceWithIva(0);
      setTaxRate(16);
    }
  }, [articleToEdit, isOpen]);

  // Recalculate selling prices when cost, margin or tax changes
  const handleCostChange = (val: number) => {
    setCostPrice(val);
    const saleExcl = val * (1 + profitMargin / 100);
    setSellPrice(Math.round(saleExcl * 100) / 100);
    setSellPriceWithIva(Math.round(saleExcl * (1 + taxRate / 100) * 100) / 100);
  };

  const handleMarginChange = (val: number) => {
    setProfitMargin(val);
    const saleExcl = costPrice * (1 + val / 100);
    setSellPrice(Math.round(saleExcl * 100) / 100);
    setSellPriceWithIva(Math.round(saleExcl * (1 + taxRate / 100) * 100) / 100);
  };

  const handlePriceWithIvaChange = (val: number) => {
    setSellPriceWithIva(val);
    const saleExcl = val / (1 + taxRate / 100);
    setSellPrice(Math.round(saleExcl * 100) / 100);
    if (costPrice > 0) {
      setProfitMargin(Math.round(((saleExcl - costPrice) / costPrice) * 100 * 10) / 10);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('O código do artigo é obrigatório.');
      return;
    }
    if (!description.trim()) {
      setError('A descrição do artigo é obrigatória.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload: Omit<Article, 'id'> = {
        code: code.trim().toUpperCase(),
        description: description.trim(),
        unit: unit.trim().toUpperCase() || 'UN',
        minStock: Number(minStock) || 0,
        stock: articleToEdit?.stock || 0,
        costPrice: Number(costPrice) || 0,
        profitMargin: Number(profitMargin) || 0,
        sellPrice: Number(sellPrice) || 0,
        sellPriceWithIva: Number(sellPriceWithIva) || 0,
        taxRate: Number(taxRate) || 16,
        category: categoryName.trim() || 'Geral',
        brand: brandName.trim() || undefined,
      };

      if (articleToEdit && onUpdate) {
        await onUpdate({ ...payload, id: articleToEdit.id });
      } else {
        await onSave(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao guardar artigo.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-surface dark:bg-slate-900 border border-outline-variant dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-outline-variant dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
            {articleToEdit ? 'Editar Artigo' : 'Novo Artigo / Produto'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-xl">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Código *</label>
              <input
                type="text"
                required
                placeholder="Ex: ART-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3 py-2 font-bold uppercase focus:border-primary focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Descrição do Artigo *</label>
              <input
                type="text"
                required
                placeholder="Nome ou descrição detalhada"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3 py-2 font-medium focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
              <input
                type="text"
                placeholder="Ex: Bebidas"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3 py-2 font-medium focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Unidade</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3 py-2 font-medium focus:border-primary focus:outline-none"
              >
                <option value="UN">UN (Unidade)</option>
                <option value="KG">KG (Quilograma)</option>
                <option value="L">L (Litro)</option>
                <option value="M">M (Metro)</option>
                <option value="CX">CX (Caixa)</option>
                <option value="PAR">PAR (Par)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Stock Mínimo</label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full rounded-xl border border-outline-variant dark:border-slate-800 bg-background px-3 py-2 font-medium focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Pricing & Taxes Section */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-outline-variant dark:border-slate-800 rounded-2xl space-y-3">
            <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase text-[10px] tracking-wider">
              Preços & Regime de IVA (Meticais)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-slate-500 mb-1">Preço Custo (MZN)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => handleCostChange(Number(e.target.value))}
                  className="w-full rounded-xl border border-outline-variant bg-background px-3 py-2 font-bold focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">Margem (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={profitMargin}
                  onChange={(e) => handleMarginChange(Number(e.target.value))}
                  className="w-full rounded-xl border border-outline-variant bg-background px-3 py-2 font-bold focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">IVA (%)</label>
                <select
                  value={taxRate}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    setTaxRate(r);
                    setSellPriceWithIva(Math.round(sellPrice * (1 + r / 100) * 100) / 100);
                  }}
                  className="w-full rounded-xl border border-outline-variant bg-background px-3 py-2 font-bold focus:border-primary focus:outline-none"
                >
                  <option value={16}>16% (IVA Normal)</option>
                  <option value={0}>0% (Isento / Exportação)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-primary mb-1">Preço Final c/ IVA</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={sellPriceWithIva}
                  onChange={(e) => handlePriceWithIvaChange(Number(e.target.value))}
                  className="w-full rounded-xl border border-primary bg-background px-3 py-2 font-black text-primary focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-outline-variant font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary hover:bg-primary-container text-white font-black rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-60"
            >
              {saving ? 'A guardar…' : 'Guardar Artigo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
