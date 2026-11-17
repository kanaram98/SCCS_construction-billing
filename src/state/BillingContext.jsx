import { createContext, useContext } from 'react';
import { useBillingStore } from './useBillingStore.js';

const BillingContext = createContext(null);

export function BillingProvider({ children }) {
  const store = useBillingStore();
  return <BillingContext.Provider value={store}>{children}</BillingContext.Provider>;
}

/** Access the billing store: `{ data, bill, actions, saveStatus, storageError }`. */
export function useBilling() {
  const store = useContext(BillingContext);
  if (!store) throw new Error('useBilling must be used inside <BillingProvider>.');
  return store;
}
