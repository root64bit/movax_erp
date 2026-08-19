import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Article } from '../types';

interface ArticleSearchSelectProps {
  articles: Article[];
  selectedArticleId: string;
  onSelect: (articleId: string) => void;
  /** Optional server search used by large catalogues. Local articles remain available as a fallback. */
  loadOptions?: (query: string) => Promise<Article[]>;
  /** Gives the parent the resolved row, useful when the row was not part of the initially loaded catalogue. */
  onResolveArticle?: (article: Article) => void;
  onAfterSelect?: () => void;
  /** Extra info shown per option, e.g., price or stock. Default shows code + description + stock. */
  renderLabel?: (article: Article) => string;
  className?: string;
  placeholder?: string;
  searchByCodeOnly?: boolean;
  disabled?: boolean;
  inputId?: string;
  onEmptyEnter?: () => void;
}

export const ArticleSearchSelect: React.FC<ArticleSearchSelectProps> = ({
  articles,
  selectedArticleId,
  onSelect,
  loadOptions,
  onResolveArticle,
  onAfterSelect,
  renderLabel,
  className = '',
  placeholder = 'Pesquisar por código ou descrição…',
  searchByCodeOnly = false,
  disabled = false,
  inputId,
  onEmptyEnter,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [remoteArticles, setRemoteArticles] = useState<Article[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Article | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const availableArticles = useMemo(() => {
    const byId = new Map<string, Article>();
    articles.forEach((article) => byId.set(article.id, article));
    remoteArticles.forEach((article) => byId.set(article.id, article));
    if (selectedSnapshot) byId.set(selectedSnapshot.id, selectedSnapshot);
    return Array.from(byId.values());
  }, [articles, remoteArticles, selectedSnapshot]);

  const selectedArticle = useMemo(
    () => availableArticles.find((a) => a.id === selectedArticleId),
    [availableArticles, selectedArticleId],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return availableArticles;
    const q = query.toLowerCase().trim();

    const matches = availableArticles.filter((a) => {
      if (searchByCodeOnly) {
        return a.code.toLowerCase().includes(q);
      }
      const terms = q.split(/\s+/);
      const haystack = `${a.code} ${a.barcode ?? ''} ${a.description} ${a.brand ?? ''}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });

    return matches.sort((a, b) => {
      const aCode = a.code.toLowerCase();
      const bCode = b.code.toLowerCase();

      // 1. Exact code match goes FIRST
      if (aCode === q && bCode !== q) return -1;
      if (aCode !== q && bCode === q) return 1;

      // 2. Code starting with query goes SECOND
      const aStarts = aCode.startsWith(q);
      const bStarts = bCode.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // 3. Fallback to numeric/alphabetic code sorting
      return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [availableArticles, query, searchByCodeOnly]);

  useEffect(() => {
    if (!loadOptions) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRemoteArticles([]);
      setRemoteLoading(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setRemoteLoading(true);
      void loadOptions(trimmed)
        .then((rows) => { if (!cancelled) setRemoteArticles(rows); })
        .catch(() => { if (!cancelled) setRemoteArticles([]); })
        .finally(() => { if (!cancelled) setRemoteLoading(false); });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loadOptions, query]);

  // Reset highlight when filtered list changes
  useEffect(() => setHighlightIndex(0), [filtered]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectArticle = (article: Article) => {
    setSelectedSnapshot(article);
    onResolveArticle?.(article);
    onSelect(article.id);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
    if (onAfterSelect) onAfterSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !query.trim() && onEmptyEnter) {
      e.preventDefault();
      setIsOpen(false);
      onEmptyEnter();
      return;
    }
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      if (e.key === 'Enter' && query.trim()) {
        const topMatch = filtered[0];
        if (topMatch) {
          e.preventDefault();
          selectArticle(topMatch);
          return;
        }
      }
      e.preventDefault();
      setIsOpen(true);
      return;
    }
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIndex]) selectArticle(filtered[highlightIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setQuery('');
        break;
      case 'Tab':
        setIsOpen(false);
        setQuery('');
        break;
    }
  };

  const defaultLabel = (a: Article) =>
    `[${a.code}] ${a.description} · Stock ${a.stock}`;

  const label = renderLabel ?? defaultLabel;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected display + search input */}
      <div
        className="flex items-stretch border border-[#c3c6d1] dark:border-[#43474f] rounded overflow-hidden bg-white dark:bg-[#1f2325] cursor-text"
        onClick={() => { inputRef.current?.focus(); setIsOpen(true); }}
      >
        <span className="material-symbols-outlined px-2 flex items-center text-[#737780] text-base">
          search
        </span>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={isOpen ? query : (selectedArticle ? `[${selectedArticle.code}] ${selectedArticle.description}` : '')}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => { setQuery(''); setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="flex-1 p-2 text-xs font-bold text-[#003366] dark:text-[#a7c8ff] bg-transparent outline-none placeholder:text-[#737780] placeholder:font-normal"
        />
        {selectedArticle && !isOpen && (
          <span className="flex items-center px-2 text-[10px] font-bold text-[#006e25] bg-[#f3f4f5] dark:bg-[#282c2e] whitespace-nowrap">
            Stock: {selectedArticle.stock}
          </span>
        )}
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded border border-[#c3c6d1] dark:border-[#43474f] bg-white dark:bg-[#1f2325] shadow-xl"
        >
          {filtered.length === 0 ? (
            <li className="p-3 text-xs text-[#737780] text-center italic">
              {remoteLoading ? 'A pesquisar no catálogo…' : `Nenhum artigo encontrado para "${query}"`}
            </li>
          ) : (
            filtered.slice(0, 100).map((a, idx) => (
              <li
                key={a.id}
                onMouseDown={(e) => { e.preventDefault(); selectArticle(a); }}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                  idx === highlightIndex
                    ? 'bg-[#003366] text-white'
                    : a.stock === 0
                      ? 'bg-[#ffdad6]/20 text-[#191c1d] dark:text-white hover:bg-[#003366]/10'
                      : 'text-[#191c1d] dark:text-white hover:bg-[#f3f4f5] dark:hover:bg-[#282c2e]'
                }`}
              >
                <span className="flex-1 truncate">
                  <span className="font-bold font-mono">[{a.code}]</span>{' '}
                  <span className="font-medium">{a.description}</span>
                  {a.brand && <span className="ml-1 text-[10px] opacity-60">· {a.brand}</span>}
                </span>
                <span className={`ml-3 text-[10px] font-bold whitespace-nowrap ${
                  idx === highlightIndex
                    ? 'text-white/80'
                    : a.stock === 0
                      ? 'text-[#ba1a1a]'
                      : 'text-[#006e25]'
                }`}>
                  Stock: {a.stock}
                </span>
              </li>
            ))
          )}
          {filtered.length > 100 && (
            <li className="p-2 text-center text-[10px] text-[#737780] border-t border-[#c3c6d1]">
              A mostrar 100 de {filtered.length} resultados. Refine a pesquisa.
            </li>
          )}
          {remoteLoading && filtered.length > 0 && (
            <li className="border-t border-[#c3c6d1] p-2 text-center text-[10px] font-bold text-[#737780]">
              A actualizar resultados do servidor…
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
