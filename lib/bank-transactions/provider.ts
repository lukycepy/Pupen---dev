export type BankTransaction = {
  providerTxId: string;
  bookedAt: string;
  amount: number;
  currency: string;
  accountIban?: string | null;
  counterpartyIban?: string | null;
  counterpartyName?: string | null;
  vs?: string | null;
  ks?: string | null;
  ss?: string | null;
  message?: string | null;
  raw?: any;
};

export type FetchBankTransactionsParams = {
  from?: Date;
  to?: Date;
  limit?: number;
};

export interface BankTransactionsProvider {
  id: string;
  fetchTransactions(params: FetchBankTransactionsParams): Promise<BankTransaction[]>;
}

class StubBankTransactionsProvider implements BankTransactionsProvider {
  id = 'stub';

  async fetchTransactions(_params: FetchBankTransactionsParams) {
    void _params;
    return [];
  }
}

export function getBankTransactionsProvider(): BankTransactionsProvider {
  return new StubBankTransactionsProvider();
}
