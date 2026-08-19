import { useEffect, useState, type FormEvent } from 'react';
import type { PartyInput, ReferenceOption } from '@/shared/types/domain.types';

interface PartyModalProps {
  type: 'customer' | 'supplier' | null;
  onClose: () => void;
  onSave: (type: 'customer' | 'supplier', input: PartyInput) => Promise<void>;
  paymentTerms: ReferenceOption[];
}

const initialInput: PartyInput = {
  number: '',
  name: '',
  taxNumber: '',
  telephone: '',
  email: '',
  address: '',
  city: '',
  contactPerson: '',
  creditLimit: 0,
  paymentTermCode: 'DINHEIRO',
};

export function PartyModal({ type, onClose, onSave, paymentTerms }: PartyModalProps) {
  const [input, setInput] = useState(initialInput);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (type) {
      setInput({ ...initialInput, paymentTermCode: paymentTerms[0]?.code ?? '' });
      setError('');
    }
  }, [type, paymentTerms]);

  if (!type) return null;

  const label = type === 'customer' ? 'Cliente' : 'Fornecedor';
  const update = (field: keyof PartyInput, value: string | number) =>
    setInput((current: PartyInput) => ({ ...current, [field]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave(type, input);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : `Falha ao guardar ${label.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'F2') {
      e.preventDefault();
      e.currentTarget.requestSubmit();
      return;
    }
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
        e.preventDefault();
        const formElements = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>('input, select, button[type="submit"]')
        ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
        const index = formElements.indexOf(target);
        if (index >= 0 && index < formElements.length - 1) {
          formElements[index + 1].focus();
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <form
        onSubmit={submit}
        onKeyDown={handleFormKeyDown}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl dark:bg-[#1f2325]"
      >
        <header className="flex items-center justify-between bg-[#001e40] px-6 py-4 text-white">
          <h2 className="text-lg font-black">Novo {label}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          {error && (
            <p role="alert" className="md:col-span-2 rounded bg-red-50 p-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}
          <label>
            <span className="mb-1 block text-xs font-bold uppercase">Número *</span>
            <input required value={input.number} onChange={(e) => update('number', e.target.value)} className="w-full rounded border p-2" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase">Nome *</span>
            <input required value={input.name} onChange={(e) => update('name', e.target.value)} className="w-full rounded border p-2" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase">NUIT</span>
            <input value={input.taxNumber} onChange={(e) => update('taxNumber', e.target.value)} className="w-full rounded border p-2" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase">Telefone</span>
            <input value={input.telephone} onChange={(e) => update('telephone', e.target.value)} className="w-full rounded border p-2" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase">Email</span>
            <input type="email" value={input.email} onChange={(e) => update('email', e.target.value)} className="w-full rounded border p-2" />
          </label>
          {type === 'supplier' && (
            <label>
              <span className="mb-1 block text-xs font-bold uppercase">Pessoa de contacto</span>
              <input value={input.contactPerson} onChange={(e) => update('contactPerson', e.target.value)} className="w-full rounded border p-2" />
            </label>
          )}
          <label className={type === 'customer' ? '' : 'md:col-span-2'}>
            <span className="mb-1 block text-xs font-bold uppercase">Morada</span>
            <input value={input.address} onChange={(e) => update('address', e.target.value)} className="w-full rounded border p-2" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase">Cidade</span>
            <input value={input.city} onChange={(e) => update('city', e.target.value)} className="w-full rounded border p-2" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase">Condição de pagamento</span>
            <select value={input.paymentTermCode} onChange={(e) => update('paymentTermCode', e.target.value)} className="w-full rounded border p-2">
              {paymentTerms.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-xs font-bold uppercase">Limite de crédito</span>
            <input type="number" min="0" step="0.01" value={input.creditLimit} onChange={(e) => update('creditLimit', Number(e.target.value))} className="w-full rounded border p-2" />
          </label>
        </div>

        <footer className="flex justify-end gap-3 border-t px-6 py-4">
          <button type="button" onClick={onClose} className="rounded bg-slate-200 px-4 py-2 text-xs font-black uppercase">
            Cancelar
          </button>
          <button disabled={saving} type="submit" className="rounded bg-[#006e25] px-5 py-2 text-xs font-black uppercase text-white disabled:opacity-50">
            {saving ? 'A guardar…' : `Guardar ${label}`}
          </button>
        </footer>
      </form>
    </div>
  );
}
