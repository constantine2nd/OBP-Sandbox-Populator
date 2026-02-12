import { createLogger } from '$lib/utils/logger';
const logger = createLogger('PopulateServer');
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { OBPClient } from '$lib/obp/client';
import { env } from '$env/dynamic/public';
import { getBusinesses, getBusinessForCounterparty } from '$lib/data/botswana-businesses';

// FX rates for African currencies and others (relative to BWP)
const FX_RATES: Record<string, number> = {
	EUR: 0.068, // 1 BWP = 0.068 EUR
	USD: 0.074, // 1 BWP = 0.074 USD
	GBP: 0.058, // 1 BWP = 0.058 GBP
	ZAR: 1.37, // 1 BWP = 1.37 ZAR
	KES: 11.5, // 1 BWP = 11.5 KES
	NGN: 115, // 1 BWP = 115 NGN
	EGP: 2.28, // 1 BWP = 2.28 EGP
	GHS: 0.92, // 1 BWP = 0.92 GHS
	TZS: 186, // 1 BWP = 186 TZS
	UGX: 275, // 1 BWP = 275 UGX
	ZMW: 1.88, // 1 BWP = 1.88 ZMW
	NAD: 1.37, // 1 BWP = 1.37 NAD
	CNY: 0.53 // 1 BWP = 0.53 CNY
};

// Target currencies for FX rates
const TARGET_CURRENCIES = Object.keys(FX_RATES);
const BASE_CURRENCY = 'BWP';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.session?.data?.user;
	const accessToken = locals.session?.data?.oauth?.access_token;
	const username = user?.username || 'unknown';
	const bankIdPrefix = getUsernamePrefix(username);

	// Initialize existing data structure
	const existing = {
		banks: [] as Array<{ bank_id: string; bank_code: string; full_name: string }>,
		accounts: [] as Array<{ account_id: string; bank_id: string; label: string; currency: string }>,
		counterparties: [] as Array<{ counterparty_id: string; name: string; bank_id: string; account_id: string }>,
		fxRates: [] as Array<{ bank_id: string; from_currency: string; to_currency: string; rate: number }>,
		transactions: [] as Array<{ transaction_id: string; bank_id: string; from_account_id: string; to_account_id: string; amount: string }>
	};

	if (accessToken) {
		const client = new OBPClient(env.PUBLIC_OBP_BASE_URL, 'v6.0.0', accessToken);

		try {
			// Find banks matching user's prefix pattern
			const banksResponse = await client.getBanks();
			const userBanks = banksResponse.banks.filter(b => b.bank_id.startsWith(bankIdPrefix + '.'));

			for (const bank of userBanks) {
				existing.banks.push({
					bank_id: bank.bank_id,
					bank_code: bank.short_name || '',
					full_name: bank.full_name
				});

				// Get accounts for this bank (v6.0.0 returns account_id)
				try {
					const accountsResponse = await client.getAccountsAtBank(bank.bank_id);
					const accounts = accountsResponse.accounts || [];
					for (const account of accounts) {
						existing.accounts.push({
							account_id: account.account_id,
							bank_id: bank.bank_id,
							label: account.label || '',
							currency: account.currency || ''
						});
					}
				} catch (e) {
					logger.warn(`Could not fetch accounts for ${bank.bank_id}`);
				}

				// Get FX rates for this bank
				for (const targetCurrency of TARGET_CURRENCIES) {
					const forwardRate = await client.getFxRate(bank.bank_id, BASE_CURRENCY, targetCurrency);
					if (forwardRate) {
						existing.fxRates.push({
							bank_id: bank.bank_id,
							from_currency: BASE_CURRENCY,
							to_currency: targetCurrency,
							rate: forwardRate.conversion_value
						});
					}
					const reverseRate = await client.getFxRate(bank.bank_id, targetCurrency, BASE_CURRENCY);
					if (reverseRate) {
						existing.fxRates.push({
							bank_id: bank.bank_id,
							from_currency: targetCurrency,
							to_currency: BASE_CURRENCY,
							rate: reverseRate.conversion_value
						});
					}
				}
			}

			// Get counterparties for first account
			if (existing.accounts.length > 0) {
				const firstAccount = existing.accounts[0];
				try {
					const cpResponse = await client.getCounterparties(firstAccount.bank_id, firstAccount.account_id);
					for (const cp of cpResponse.counterparties || []) {
						existing.counterparties.push({
							counterparty_id: cp.counterparty_id,
							name: cp.name,
							bank_id: firstAccount.bank_id,
							account_id: firstAccount.account_id
						});
					}
				} catch (e) {
					logger.warn(`Could not fetch counterparties`);
				}

				// Get transactions for first account
				try {
					const transactions = await client.getTransactionsForAccount(firstAccount.bank_id, firstAccount.account_id);
					for (const txn of transactions.slice(0, 20)) { // Limit to 20
						existing.transactions.push({
							transaction_id: txn.transaction_id,
							bank_id: firstAccount.bank_id,
							from_account_id: firstAccount.account_id,
							to_account_id: txn.other_account?.id || '',
							amount: `${txn.details?.value?.amount || '0'} ${txn.details?.value?.currency || ''}`
						});
					}
				} catch (e) {
					logger.warn(`Could not fetch transactions`);
				}
			}
		} catch (e) {
			logger.error('Failed to load existing data:', e);
		}
	}

	return {
		username,
		obpBaseUrl: env.PUBLIC_OBP_BASE_URL,
		defaults: {
			numBanks: 2,
			numAccountsPerBank: 5,
			country: 'Botswana',
			currency: 'BWP',
			bankIdPrefix
		},
		existing
	};
};

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeVowels(str: string): string {
	return str.replace(/[aeiou]/gi, '');
}

function getUsernamePrefix(username: string): string {
	// Lowercase, remove special characters, keep only alphanumeric, remove vowels
	const cleaned = username.toLowerCase().replace(/[^a-z0-9]/g, '');
	return removeVowels(cleaned).slice(0, 4);
}

export const actions: Actions = {
	populate: async ({ request, locals }) => {
		const session = locals.session;
		const accessToken = session?.data?.oauth?.access_token;
		const user = session?.data?.user;

		if (!accessToken || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const numBanks = parseInt(formData.get('numBanks') as string) || 2;
		const numAccountsPerBank = parseInt(formData.get('numAccountsPerBank') as string) || 5;
		const currency = (formData.get('currency') as string) || 'BWP';
		const bankIdPrefix = (formData.get('bankIdPrefix') as string) || getUsernamePrefix(user.username);
		const createCounterparties = formData.get('createCounterparties') === 'on';
		const createFxRates = formData.get('createFxRates') === 'on';
		const createTransactions = formData.get('createTransactions') === 'on';

		const client = new OBPClient(
			env.PUBLIC_OBP_BASE_URL,
			'v6.0.0',
			accessToken
		);

		const results: {
			banks: Array<{ bank_id: string; bank_code: string; full_name: string; existed: boolean }>;
			accounts: Array<{ account_id: string; bank_id: string; label: string; currency: string; existed: boolean }>;
			counterparties: Array<{ counterparty_id: string; name: string; bank_id: string; account_id: string; existed: boolean }>;
			fxRates: Array<{ bank_id: string; from_currency: string; to_currency: string; rate: number; existed: boolean }>;
			transactions: Array<{ transaction_id: string; bank_id: string; from_account_id: string; to_account_id: string; amount: string; existed: boolean }>;
			errors: string[];
		} = {
			banks: [],
			accounts: [],
			counterparties: [],
			fxRates: [],
			transactions: [],
			errors: []
		};

		try {
			// Create Banks
			logger.info(`Creating ${numBanks} banks...`);
			for (let i = 1; i <= numBanks; i++) {
				const bankId = `${bankIdPrefix}.bnk.${i}`;
				const bankName = `${user.username} Test Bank ${i}`;

				const bank_code = `TB${i}BW`;
				try {
					// Check if bank exists
					const exists = await client.bankExists(bankId);
					if (exists) {
						logger.info(`Bank ${bankId} already exists, skipping`);
						results.banks.push({ bank_id: bankId, bank_code, full_name: bankName, existed: true });
					} else {
						const bank = await client.createBank({
							bank_id: bankId,
							full_name: bankName,
							short_name: `TB${i}`,
							bank_code: bank_code
						});
						logger.debug('Bank creation response:', JSON.stringify(bank));
						results.banks.push({
							bank_id: bank.bank_id,
							bank_code: bank.bank_code,
							full_name: bank.full_name,
							existed: false
						});
						logger.info(`Created bank: ${bank.bank_id}`);
					}
				} catch (e: any) {
					const errorMsg = `Failed to create bank ${bankId}: ${e.message}`;
					logger.error(errorMsg);
					results.errors.push(errorMsg);
				}

				await delay(100); // Rate limiting delay
			}

			// Create Accounts for each bank
			logger.info(`Creating ${numAccountsPerBank} accounts per bank...`);
			for (const bank of results.banks) {
				// Get existing accounts for this bank (v6.0.0 returns account_id)
				let existingAccounts: Array<{ account_id: string; label?: string; currency?: string }> = [];
				try {
					const accountsResponse = await client.getAccountsAtBank(bank.bank_id);
					existingAccounts = accountsResponse.accounts || [];
					logger.debug(`Found ${existingAccounts.length} existing accounts at ${bank.bank_id}`);
				} catch (e: any) {
					logger.warn(`Could not fetch existing accounts for ${bank.bank_id}: ${e.message}`);
				}

				for (let j = 1; j <= numAccountsPerBank; j++) {
					const label = `Account ${j}`;
					try {
						// Check if account with this label already exists
						const existingAccount = existingAccounts.find(a => a.label === label);
						if (existingAccount) {
							logger.info(`Account "${label}" already exists at ${bank.bank_id}, skipping`);
							results.accounts.push({
								account_id: existingAccount.account_id,
								bank_id: bank.bank_id,
								label: existingAccount.label || label,
								currency: existingAccount.currency || currency,
								existed: true
							});
						} else {
							const account = await client.createAccount(bank.bank_id, {
								label: label,
								currency: currency,
								balance: { amount: '0', currency: currency },
								user_id: user.user_id
							});
							logger.debug('Account creation response:', JSON.stringify(account));
							results.accounts.push({
								account_id: account.account_id,
								bank_id: bank.bank_id,
								label: account.label,
								currency: account.currency,
								existed: false
							});
							logger.info(`Created account: ${account.account_id} at ${bank.bank_id}`);
						}
					} catch (e: any) {
						const errorMsg = `Failed to create account at ${bank.bank_id}: ${e.message}`;
						logger.error(errorMsg);
						results.errors.push(errorMsg);
					}
					await delay(100);
				}
			}

			// Create Counterparties
			if (createCounterparties && results.accounts.length > 0) {
				logger.info('Creating counterparties...');
				const businesses = getBusinesses(10); // Get first 10 businesses
				const firstAccount = results.accounts[0];

				// Get existing counterparties for this account
				let existingCounterparties: Array<{ counterparty_id?: string; name?: string }> = [];
				try {
					const cpResponse = await client.getCounterparties(firstAccount.bank_id, firstAccount.account_id);
					existingCounterparties = cpResponse.counterparties || [];
					logger.debug(`Found ${existingCounterparties.length} existing counterparties`);
				} catch (e: any) {
					logger.warn(`Could not fetch existing counterparties: ${e.message}`);
				}

				for (const business of businesses) {
					try {
						// Check if counterparty with this name already exists
						const existingCp = existingCounterparties.find(cp => cp.name === business.name);
						if (existingCp && existingCp.counterparty_id) {
							logger.info(`Counterparty "${business.name}" already exists, skipping`);
							results.counterparties.push({
								counterparty_id: existingCp.counterparty_id,
								name: business.name,
								bank_id: firstAccount.bank_id,
								account_id: firstAccount.account_id,
								existed: true
							});
						} else {
							const payload = getBusinessForCounterparty(business, currency);
							const counterparty = await client.createCounterparty(firstAccount.bank_id, firstAccount.account_id, payload);
							results.counterparties.push({
								counterparty_id: counterparty.counterparty_id,
								name: business.name,
								bank_id: firstAccount.bank_id,
								account_id: firstAccount.account_id,
								existed: false
							});
							logger.info(`Created counterparty: ${business.name}`);
						}
					} catch (e: any) {
						const errorMsg = `Failed to create counterparty ${business.name}: ${e.message}`;
						logger.error(errorMsg);
						results.errors.push(errorMsg);
					}
					await delay(100);
				}
			}

			// Create FX Rates
			if (createFxRates && results.banks.length > 0) {
				logger.info('Creating FX rates...');
				for (const bank of results.banks) {
					for (const [targetCurrency, rate] of Object.entries(FX_RATES)) {
						try {
							const effectiveDate = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

							// Check if forward rate exists
							const existingForwardRate = await client.getFxRate(bank.bank_id, currency, targetCurrency);
							if (existingForwardRate) {
								logger.info(`FX rate ${currency}→${targetCurrency} already exists at ${bank.bank_id}, skipping`);
								results.fxRates.push({
									bank_id: bank.bank_id,
									from_currency: currency,
									to_currency: targetCurrency,
									rate: existingForwardRate.conversion_value,
									existed: true
								});
							} else {
								await client.createFxRate(bank.bank_id, {
									from_currency_code: currency,
									to_currency_code: targetCurrency,
									conversion_value: rate,
									effective_date: effectiveDate
								});
								results.fxRates.push({
									bank_id: bank.bank_id,
									from_currency: currency,
									to_currency: targetCurrency,
									rate: rate,
									existed: false
								});
							}

							// Check if reverse rate exists
							const existingReverseRate = await client.getFxRate(bank.bank_id, targetCurrency, currency);
							if (existingReverseRate) {
								logger.info(`FX rate ${targetCurrency}→${currency} already exists at ${bank.bank_id}, skipping`);
								results.fxRates.push({
									bank_id: bank.bank_id,
									from_currency: targetCurrency,
									to_currency: currency,
									rate: existingReverseRate.conversion_value,
									existed: true
								});
							} else {
								await client.createFxRate(bank.bank_id, {
									from_currency_code: targetCurrency,
									to_currency_code: currency,
									conversion_value: 1 / rate,
									effective_date: effectiveDate
								});
								results.fxRates.push({
									bank_id: bank.bank_id,
									from_currency: targetCurrency,
									to_currency: currency,
									rate: parseFloat((1 / rate).toFixed(6)),
									existed: false
								});
							}
						} catch (e: any) {
							const errorMsg = `FX rate ${currency}→${targetCurrency} at ${bank.bank_id}: ${e.message}`;
							logger.error(errorMsg);
							results.errors.push(errorMsg);
						}
						await delay(50);
					}
				}
				logger.info(`Created ${results.fxRates.length} FX rates`);
			}

			// Create Historical Transactions
			if (createTransactions && results.accounts.length >= 2) {
				logger.info('Creating historical transactions...');
				const bankAccounts: Record<string, string[]> = {};

				// Group accounts by bank
				for (const account of results.accounts) {
					if (!bankAccounts[account.bank_id]) {
						bankAccounts[account.bank_id] = [];
					}
					bankAccounts[account.bank_id].push(account.account_id);
				}

				// Create transactions within each bank
				const now = new Date();
				for (const [bank_id, account_ids] of Object.entries(bankAccounts)) {
					if (account_ids.length < 2) continue;

					// Get existing transactions for the first account to check for duplicates
					let existingTransactions: Array<{ transaction_id: string; details?: { description?: string; value?: { amount?: string; currency?: string } } }> = [];
					try {
						existingTransactions = await client.getTransactionsForAccount(bank_id, account_ids[0]);
						logger.debug(`Found ${existingTransactions.length} existing transactions for account ${account_ids[0]}`);
					} catch (e: any) {
						logger.warn(`Could not fetch existing transactions: ${e.message}`);
					}

					// Create some transactions over the last 12 months
					for (let month = 0; month < 12; month++) {
						const date = new Date(now);
						date.setMonth(date.getMonth() - month);
						const dateStr = date.toISOString().replace(/\.\d{3}Z$/, 'Z');
						const description = `Monthly transfer ${month + 1}`;

						// Check if a transaction with this description already exists
						const existingTxn = existingTransactions.find(t => t.details?.description === description);
						if (existingTxn) {
							logger.info(`Transaction "${description}" already exists at ${bank_id}, skipping`);
							const amount = existingTxn.details?.value?.amount || '0';
							const txnCurrency = existingTxn.details?.value?.currency || currency;
							results.transactions.push({
								transaction_id: existingTxn.transaction_id,
								bank_id: bank_id,
								from_account_id: account_ids[0],
								to_account_id: account_ids[1] || account_ids[0],
								amount: `${amount} ${txnCurrency}`,
								existed: true
							});
							continue;
						}

						// Random transaction between accounts
						const fromIdx = Math.floor(Math.random() * account_ids.length);
						let toIdx = Math.floor(Math.random() * account_ids.length);
						while (toIdx === fromIdx) {
							toIdx = Math.floor(Math.random() * account_ids.length);
						}

						try {
							const amount = (Math.random() * 1000 + 100).toFixed(2);
							const txn = await client.createHistoricalTransaction(bank_id, {
								from_account_id: account_ids[fromIdx],
								to_account_id: account_ids[toIdx],
								value: {
									currency: currency,
									amount: amount
								},
								description: description,
								posted: dateStr,
								completed: dateStr
							});
							logger.debug('Transaction creation response:', JSON.stringify(txn));
							results.transactions.push({
								transaction_id: txn.transaction_id,
								bank_id: bank_id,
								from_account_id: account_ids[fromIdx],
								to_account_id: account_ids[toIdx],
								amount: `${amount} ${currency}`,
								existed: false
							});
						} catch (e: any) {
							const errorMsg = `Transaction at ${bank_id}: ${e.message}`;
							logger.error(errorMsg);
							results.errors.push(errorMsg);
						}
						await delay(100);
					}
				}
				logger.info(`Created ${results.transactions.length} historical transactions`);
			}

			return {
				success: true,
				results
			};
		} catch (e: any) {
			logger.error('Population failed:', e);
			return fail(500, {
				error: e.message || 'Population failed',
				results
			});
		}
	},

	createCounterpartyTransactionRequests: async ({ locals }) => {
		const session = locals.session;
		const accessToken = session?.data?.oauth?.access_token;
		const user = session?.data?.user;

		if (!accessToken || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const client = new OBPClient(env.PUBLIC_OBP_BASE_URL, 'v6.0.0', accessToken);
		const bankIdPrefix = getUsernamePrefix(user.username);

		const results: {
			transactionRequests: Array<{ id: string; type: string; status: string; amount: string; counterparty: string }>;
			errors: string[];
		} = {
			transactionRequests: [],
			errors: []
		};

		try {
			// Find user's banks
			const banksResponse = await client.getBanks();
			const userBanks = banksResponse.banks.filter(b => b.bank_id.startsWith(bankIdPrefix + '.'));

			if (userBanks.length === 0) {
				return fail(400, { error: 'No banks found. Please populate first.', results });
			}

			const bank = userBanks[0];

			// Get accounts for this bank (v6.0.0 returns account_id)
			const accountsResponse = await client.getAccountsAtBank(bank.bank_id);
			const accounts = accountsResponse.accounts || [];

			if (accounts.length === 0) {
				return fail(400, { error: `No accounts found for bank ${bank.bank_id}. Please populate first.`, results });
			}

			const account = accounts[0];

			// Get counterparties for this account
			const cpResponse = await client.getCounterparties(bank.bank_id, account.account_id);
			const counterparties = cpResponse.counterparties || [];

			if (counterparties.length === 0) {
				return fail(400, { error: 'No counterparties found. Please populate with counterparties first.', results });
			}

			// Create 10 transaction requests to various counterparties
			const descriptions = [
				'Office supplies', 'Consulting services', 'Monthly subscription',
				'Equipment rental', 'Catering services', 'Marketing materials',
				'Training workshop', 'Software license', 'Maintenance fee', 'Delivery charges'
			];

			for (let i = 0; i < 10; i++) {
				const counterparty = counterparties[i % counterparties.length];
				const amount = (Math.random() * 50 + 5).toFixed(2); // Low value: 5-55
				const description = descriptions[i];

				try {
					const txnRequest = await client.createTransactionRequestCounterparty(
						bank.bank_id,
						account.account_id,
						{
							to: { counterparty_id: counterparty.counterparty_id },
							value: { currency: 'BWP', amount },
							description,
							charge_policy: 'SHARED'
						}
					);

					results.transactionRequests.push({
						id: txnRequest.id,
						type: 'COUNTERPARTY',
						status: txnRequest.status,
						amount: `${amount} BWP`,
						counterparty: counterparty.name
					});
					logger.info(`Created COUNTERPARTY transaction request: ${txnRequest.id}`);
				} catch (e: any) {
					const errorMsg = `Failed to create transaction request to ${counterparty.name}: ${e.message}`;
					logger.error(errorMsg);
					results.errors.push(errorMsg);
				}

				await delay(100);
			}

			return { success: true, action: 'counterpartyTransactionRequests', results };
		} catch (e: any) {
			logger.error('Failed to create counterparty transaction requests:', e);
			return fail(500, { error: e.message, results });
		}
	},

	createAccountTransactionRequests: async ({ locals }) => {
		const session = locals.session;
		const accessToken = session?.data?.oauth?.access_token;
		const user = session?.data?.user;

		if (!accessToken || !user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const client = new OBPClient(env.PUBLIC_OBP_BASE_URL, 'v6.0.0', accessToken);
		const bankIdPrefix = getUsernamePrefix(user.username);

		const results: {
			transactionRequests: Array<{ id: string; type: string; status: string; amount: string; toAccount: string }>;
			errors: string[];
		} = {
			transactionRequests: [],
			errors: []
		};

		try {
			// Find user's banks
			const banksResponse = await client.getBanks();
			const userBanks = banksResponse.banks.filter(b => b.bank_id.startsWith(bankIdPrefix + '.'));

			if (userBanks.length === 0) {
				return fail(400, { error: 'No banks found. Please populate first.', results });
			}

			const bank = userBanks[0];

			// Get accounts for this bank (v6.0.0 returns account_id)
			const accountsResponse = await client.getAccountsAtBank(bank.bank_id);
			const accounts = accountsResponse.accounts || [];

			if (accounts.length < 2) {
				return fail(400, { error: 'Need at least 2 accounts. Please populate first.', results });
			}

			const fromAccount = accounts[0];

			// Create 10 transaction requests to various accounts
			const descriptions = [
				'Internal transfer', 'Savings deposit', 'Budget allocation',
				'Expense reimbursement', 'Petty cash', 'Reserve fund',
				'Operating expenses', 'Payroll funding', 'Investment transfer', 'Emergency fund'
			];

			for (let i = 0; i < 10; i++) {
				const toAccount = accounts[(i % (accounts.length - 1)) + 1]; // Skip first account
				const amount = (Math.random() * 50 + 5).toFixed(2); // Low value: 5-55
				const description = descriptions[i];

				try {
					const txnRequest = await client.createTransactionRequest(
						bank.bank_id,
						fromAccount.account_id,
						{
							to: { bank_id: bank.bank_id, account_id: toAccount.account_id },
							value: { currency: 'BWP', amount },
							description
						}
					);

					results.transactionRequests.push({
						id: txnRequest.id,
						type: 'ACCOUNT',
						status: txnRequest.status,
						amount: `${amount} BWP`,
						toAccount: toAccount.label || toAccount.account_id
					});
					logger.info(`Created ACCOUNT transaction request: ${txnRequest.id}`);
				} catch (e: any) {
					const errorMsg = `Failed to create transaction request to ${toAccount.account_id}: ${e.message}`;
					logger.error(errorMsg);
					results.errors.push(errorMsg);
				}

				await delay(100);
			}

			return { success: true, action: 'accountTransactionRequests', results };
		} catch (e: any) {
			logger.error('Failed to create account transaction requests:', e);
			return fail(500, { error: e.message, results });
		}
	}
};
