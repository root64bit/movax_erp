import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Client } from '@/shared/types/domain.types';
import { normalizeClientSearch, isWalkInClient } from '../utils/posCalculations';

export interface UsePosCustomerProps {
  clients: Client[];
}

export function usePosCustomer({ clients }: UsePosCustomerProps) {
  const [clientCodeInput, setClientCodeInput] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClientName, setSelectedClientName] = useState('');
  const [clientNuit, setClientNuit] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [keepAsWalkIn, setKeepAsWalkIn] = useState(false);
  const [showClientInvoices, setShowClientInvoices] = useState(false);
  const [showClientNameMatches, setShowClientNameMatches] = useState(false);

  useEffect(() => {
    if (clients.length === 0 || selectedClientId) return;
    const pontual = clients.find(
      (client) => client.number === '1' || client.code === '1' || client.name.toLowerCase().includes('pontual')
    ) || clients[0];
    if (pontual) {
      setSelectedClientId(pontual.id);
      setSelectedClientName(pontual.number === '1' || pontual.code === '1' ? 'Cliente Pontual' : pontual.name);
      setClientCodeInput(pontual.number || pontual.code || '1');
    }
  }, [clients, selectedClientId]);

  const clientNameMatches = useMemo(() => {
    const query = normalizeClientSearch(selectedClientName);
    if (!query || ['cliente pontual', 'cliente final', 'pontual'].includes(query)) return [];

    return clients
      .filter((client) => client.active !== false && !isWalkInClient(client))
      .filter((client) => normalizeClientSearch(client.name).includes(query))
      .sort((a, b) => {
        const aName = normalizeClientSearch(a.name);
        const bName = normalizeClientSearch(b.name);
        const aRank = aName === query ? 0 : aName.startsWith(query) ? 1 : 2;
        const bRank = bName === query ? 0 : bName.startsWith(query) ? 1 : 2;
        return aRank - bRank || aName.localeCompare(bName, 'pt-PT');
      })
      .slice(0, 8);
  }, [clients, selectedClientName]);

  const applySelectedClient = useCallback((client: Client) => {
    setSelectedClientId(client.id);
    setSelectedClientName(client.name);
    setClientNuit(client.nuit || '');
    setClientAddress(client.address || '');
    setClientCodeInput(client.number || client.code || '');
    setKeepAsWalkIn(false);
    setShowClientNameMatches(false);
  }, []);

  const keepManualClientDetailsUnlinked = useCallback((clearCopiedDetails = false) => {
    const walkIn = clients.find(isWalkInClient);
    setSelectedClientId(walkIn?.id || 'client-pontual');
    setClientCodeInput('1');
    if (clearCopiedDetails) {
      setClientNuit('');
      setClientAddress('');
    }
  }, [clients]);

  const handleClientNameChange = useCallback((value: string) => {
    setSelectedClientName(value);
    const normalizedValue = normalizeClientSearch(value);

    if (['cliente pontual', 'cliente final', 'pontual'].includes(normalizedValue)) {
      const walkIn = clients.find(isWalkInClient);
      setSelectedClientId(walkIn?.id || 'client-pontual');
      setClientCodeInput('1');
      setClientNuit('');
      setClientAddress('');
      setKeepAsWalkIn(false);
      setShowClientNameMatches(false);
      return;
    }

    const exactClient = clients.find(
      (client) => client.active !== false
        && !isWalkInClient(client)
        && normalizeClientSearch(client.name) === normalizedValue,
    );

    if (exactClient && normalizedValue.length > 1) {
      applySelectedClient(exactClient);
      return;
    }

    const previouslySelectedClient = clients.find((client) => client.id === selectedClientId);
    keepManualClientDetailsUnlinked(Boolean(previouslySelectedClient && !isWalkInClient(previouslySelectedClient)));
    setShowClientNameMatches(Boolean(normalizedValue));
  }, [clients, selectedClientId, applySelectedClient, keepManualClientDetailsUnlinked]);

  const lookupClientByCode = useCallback((query: string) => {
    const clean = query.trim().toLowerCase();
    if (!clean) {
      const hasDetails = selectedClientName.trim() !== ''
        && !['cliente pontual', 'cliente final'].includes(selectedClientName.trim().toLowerCase());
      if (!hasDetails && !clientNuit.trim() && !clientAddress.trim()) {
        lookupClientByCode('1');
      }
      return;
    }

    if (clean === '1' || clean === '01') {
      const pontualInDb = clients.find(
        (c) => c.number === '1' || c.code === '1' || c.name.toLowerCase().includes('pontual') || c.name.toLowerCase().includes('final')
      ) || clients[0];

      setSelectedClientId(pontualInDb ? pontualInDb.id : 'client-pontual');
      setSelectedClientName('Cliente Pontual');
      setClientCodeInput('1');
      setClientNuit('');
      setClientAddress('');
      setKeepAsWalkIn(false);
      setShowClientInvoices(false);
      return;
    }

    const found = clients.find(
      (c) =>
        c.number !== '1' &&
        c.code !== '1' &&
        ((c.number && c.number.trim().toLowerCase() === clean) ||
          (c.code && c.code.trim().toLowerCase() === clean) ||
          c.id.toLowerCase() === clean ||
          String(c.number) === clean ||
          c.name.toLowerCase().includes(clean))
    );

    if (found) {
      applySelectedClient(found);
    } else {
      const pontualInDb = clients.find(
        (c) => c.number === '1' || c.code === '1' || c.name.toLowerCase().includes('pontual')
      ) || clients[0];

      setSelectedClientId(pontualInDb ? pontualInDb.id : 'client-pontual');
      if (!selectedClientName || selectedClientName === 'Cliente Pontual') {
        setSelectedClientName('Cliente Pontual');
      }
      setShowClientInvoices(false);
      setShowClientNameMatches(false);
    }
  }, [clients, selectedClientName, clientNuit, clientAddress, applySelectedClient]);

  const resetCustomer = useCallback(() => {
    const pontual = clients.find(
      (client) => client.number === '1' || client.code === '1' || client.name.toLowerCase().includes('pontual')
    ) || clients[0];

    if (pontual) {
      setSelectedClientId(pontual.id);
      setSelectedClientName('Cliente Pontual');
      setClientCodeInput('1');
    }
    setClientNuit('');
    setClientAddress('');
    setKeepAsWalkIn(false);
    setShowClientInvoices(false);
    setShowClientNameMatches(false);
  }, [clients]);

  return {
    clientCodeInput,
    setClientCodeInput,
    selectedClientId,
    setSelectedClientId,
    selectedClientName,
    setSelectedClientName,
    clientNuit,
    setClientNuit,
    clientAddress,
    setClientAddress,
    keepAsWalkIn,
    setKeepAsWalkIn,
    showClientInvoices,
    setShowClientInvoices,
    showClientNameMatches,
    setShowClientNameMatches,
    clientNameMatches,
    applySelectedClient,
    handleClientNameChange,
    lookupClientByCode,
    resetCustomer,
  };
}
