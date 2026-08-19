import { useState, useRef, useCallback } from 'react';
import type { Article, SaleItem } from '@/shared/types/domain.types';
import { recalculateSaleItem } from '@/lib/documentCalculations';
import { getArticlePriceWithIva } from '../utils/posCalculations';
import type { PosDocStatus } from '../types/pos.types';

export interface UsePosItemDraftProps {
  articles: Article[];
  docStatus: PosDocStatus;
  onAddItem: (item: SaleItem) => void;
}

export function usePosItemDraft({ articles, docStatus, onAddItem }: UsePosItemDraftProps) {
  const [selectedArticleId, setSelectedArticleId] = useState<string>('');
  const [catalogCache, setCatalogCache] = useState<Record<string, Article>>({});
  const [customDescription, setCustomDescription] = useState<string>('');
  const [inputQty, setInputQty] = useState<number>(1);
  const [inputDiscount, setInputDiscount] = useState<number>(0);
  const [inputIva, setInputIva] = useState<number>(articles[0]?.taxRate ?? 16);
  const [inputUnitPrice, setInputUnitPrice] = useState<number>(0);

  const customDescriptionInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const unitPriceInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const ivaInputRef = useRef<HTMLInputElement>(null);

  const findArticle = useCallback(
    (id: string) => catalogCache[id] || articles.find((a) => a.id === id),
    [articles, catalogCache]
  );

  const resolveArticle = useCallback((art: Article) => {
    setCatalogCache((current) => (current[art.id] === art ? current : { ...current, [art.id]: art }));
    setCustomDescription(art.description);
    setInputIva(art.taxRate ?? 16);
    setInputUnitPrice(getArticlePriceWithIva(art));
  }, []);

  const handleArticleSelect = useCallback((id: string) => {
    setSelectedArticleId(id);
    const art = findArticle(id);
    if (art) {
      setCustomDescription(art.description);
      setInputIva(art.taxRate ?? 16);
      setInputUnitPrice(getArticlePriceWithIva(art));
    }
  }, [findArticle]);

  const handleAfterArticleSelect = useCallback(() => {
    setTimeout(() => {
      if (customDescriptionInputRef.current) {
        customDescriptionInputRef.current.focus();
        customDescriptionInputRef.current.select();
      } else if (qtyInputRef.current) {
        qtyInputRef.current.focus();
        qtyInputRef.current.select();
      }
    }, 40);
  }, []);

  const handleAddItem = useCallback(() => {
    if (docStatus === 'CONFIRMING') return;

    const art = findArticle(selectedArticleId);
    const finalDesc = customDescription.trim() || art?.description || '';
    if (!finalDesc || inputQty <= 0) return;

    const priceWithIva = inputUnitPrice > 0 ? inputUnitPrice : (art ? getArticlePriceWithIva(art) : 0);
    const newItem = recalculateSaleItem({
      articleId: art?.id || `custom-${Date.now()}`,
      code: art?.code || 'DIV',
      description: finalDesc,
      quantity: inputQty,
      unitPrice: Math.round(priceWithIva * 100) / 100,
      discountPercent: 0,
      discountAmount: Math.max(0, inputDiscount),
      ivaPercent: inputIva,
      total: 0,
      lineType: art ? 'STOCK' : 'SERVICE',
      stockEffectEnabled: Boolean(art),
    });

    onAddItem(newItem);
    setInputQty(1);
    setInputDiscount(0);
    setSelectedArticleId('');
    setCustomDescription('');
    setInputUnitPrice(0);

    setTimeout(() => {
      const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Pesquisar catálogo"]');
      if (searchInput) {
        searchInput.focus();
      }
    }, 40);
  }, [docStatus, findArticle, selectedArticleId, customDescription, inputQty, inputUnitPrice, inputDiscount, inputIva, onAddItem]);

  const resetDraft = useCallback(() => {
    setSelectedArticleId('');
    setCustomDescription('');
    setInputQty(1);
    setInputDiscount(0);
    setInputUnitPrice(0);
  }, []);

  return {
    selectedArticleId,
    setSelectedArticleId,
    customDescription,
    setCustomDescription,
    inputQty,
    setInputQty,
    inputDiscount,
    setInputDiscount,
    inputIva,
    setInputIva,
    inputUnitPrice,
    setInputUnitPrice,
    customDescriptionInputRef,
    qtyInputRef,
    unitPriceInputRef,
    discountInputRef,
    ivaInputRef,
    findArticle,
    resolveArticle,
    handleArticleSelect,
    handleAfterArticleSelect,
    handleAddItem,
    resetDraft,
  };
}
