<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import {
		Database,
		Loader2,
		CheckCircle,
		XCircle,
		Building,
		Wallet,
		Users,
		TrendingUp,
		History,
		Copy,
		Check,
		ExternalLink,
		Plus,
		RotateCcw,
		Send,
		ArrowRightLeft
	} from '@lucide/svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let isLoading = $state(false);
	let isLoadingCounterpartyTxn = $state(false);
	let isLoadingAccountTxn = $state(false);
	let numBanks = $state(data.defaults.numBanks);
	let numAccountsPerBank = $state(data.defaults.numAccountsPerBank);
	let currency = $state(data.defaults.currency);
	let bankIdPrefix = $state(data.defaults.bankIdPrefix);
	let createCounterparties = $state(true);
	let createFxRates = $state(true);
	let createTransactions = $state(true);

	// Copy states for each section
	let copiedSection = $state<string | null>(null);

	async function copyToClipboard(section: string, text: string) {
		await navigator.clipboard.writeText(text);
		copiedSection = section;
		setTimeout(() => {
			copiedSection = null;
		}, 2000);
	}

	function formatBanks() {
		if (!form?.results?.banks) return '';
		return form.results.banks.map(b => `bank_id: ${b.bank_id}, bank_code: ${b.bank_code}`).join('\n');
	}

	function formatAccounts() {
		if (!form?.results?.accounts) return '';
		return form.results.accounts.map(a => `account_id: ${a.account_id}, label: ${a.label}, currency: ${a.currency}`).join('\n');
	}

	function formatCounterparties() {
		if (!form?.results?.counterparties) return '';
		return form.results.counterparties.map(c => `name: ${c.name}`).join('\n');
	}

	function formatFxRates() {
		if (!form?.results?.fxRates) return '';
		return form.results.fxRates.map(fx => `${fx.from_currency} → ${fx.to_currency}: ${fx.rate}`).join('\n');
	}

	function formatTransactions() {
		if (!form?.results?.transactions) return '';
		return form.results.transactions.map(t => `transaction_id: ${t.transaction_id}, amount: ${t.amount}`).join('\n');
	}

	function formatErrors() {
		if (!form?.results?.errors) return '';
		return form.results.errors.join('\n');
	}

	function getTransactionUrl(txn: { transaction_id: string; bank_id: string; from_account_id: string }) {
		return `/transaction/${txn.bank_id}/${txn.from_account_id}/${txn.transaction_id}`;
	}

	function getBankUrl(bank: { bank_id: string }) {
		return `/banks/${bank.bank_id}`;
	}

	function getAccountUrl(account: { account_id: string; bank_id: string }) {
		return `/account/${account.bank_id}/${account.account_id}`;
	}

	// Check if there's any existing data
	function hasExistingData() {
		return data.existing && (
			data.existing.banks.length > 0 ||
			data.existing.accounts.length > 0 ||
			data.existing.counterparties.length > 0 ||
			data.existing.fxRates.length > 0 ||
			data.existing.transactions.length > 0
		);
	}

	// Format functions for existing data
	function formatExistingBanks() {
		if (!data.existing?.banks) return '';
		return data.existing.banks.map(b => `bank_id: ${b.bank_id}, bank_code: ${b.bank_code}`).join('\n');
	}

	function formatExistingAccounts() {
		if (!data.existing?.accounts) return '';
		return data.existing.accounts.map(a => `account_id: ${a.account_id}, label: ${a.label}, currency: ${a.currency}`).join('\n');
	}

	function formatExistingCounterparties() {
		if (!data.existing?.counterparties) return '';
		return data.existing.counterparties.map(c => `name: ${c.name}`).join('\n');
	}

	function formatExistingFxRates() {
		if (!data.existing?.fxRates) return '';
		return data.existing.fxRates.map(fx => `${fx.from_currency} → ${fx.to_currency}: ${fx.rate}`).join('\n');
	}

	function formatExistingTransactions() {
		if (!data.existing?.transactions) return '';
		return data.existing.transactions.map(t => `transaction_id: ${t.transaction_id}, amount: ${t.amount}`).join('\n');
	}

	function getCounterpartyUrl(cp: { counterparty_id: string; bank_id: string; account_id: string }) {
		return `/counterparty/${cp.bank_id}/${cp.account_id}/${cp.counterparty_id}`;
	}
</script>

<div class="p-8 w-full">
	<h1 class="h1 mb-2">Populate Sandbox</h1>
	<p class="text-surface-400 mb-8">
		Configure and create test data for your OBP sandbox as <span class="text-secondary-400"
			>{data.username}</span
		>
	</p>

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
		<!-- Configuration Panel -->
		<div class="card p-6 preset-filled-surface-50-950">
			<h2 class="h3 mb-4 flex items-center gap-2">
				<Database class="size-5 text-secondary-500" />
				Configuration
			</h2>

			<form
				method="POST"
				action="?/populate"
				use:enhance={() => {
					isLoading = true;
					return async ({ update }) => {
						await update();
						isLoading = false;
					};
				}}
				class="space-y-4"
			>
				<!-- Bank ID Prefix & Number of Banks -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="bankIdPrefix" class="block text-sm font-medium mb-1">Bank ID Prefix</label>
						<input
							type="text"
							id="bankIdPrefix"
							name="bankIdPrefix"
							bind:value={bankIdPrefix}
							class="input w-full"
							disabled={isLoading}
						/>
					</div>
					<div>
						<label for="numBanks" class="block text-sm font-medium mb-1">Number of Banks</label>
						<input
							type="number"
							id="numBanks"
							name="numBanks"
							bind:value={numBanks}
							min="1"
							max="5"
							class="input w-full"
							disabled={isLoading}
						/>
					</div>
				</div>
				<p class="text-xs text-surface-500 -mt-2">Banks will be: <code class="bg-surface-700 px-1 rounded">{bankIdPrefix}.bnk.1</code>, <code class="bg-surface-700 px-1 rounded">{bankIdPrefix}.bnk.2</code>, ...</p>

				<!-- Currency & Accounts per Bank -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="currency" class="block text-sm font-medium mb-1">Currency</label>
						<select
							id="currency"
							name="currency"
							bind:value={currency}
							class="select w-full"
							disabled={isLoading}
						>
							<option value="BWP">BWP - Botswana Pula</option>
							<option value="USD">USD - US Dollar</option>
							<option value="EUR">EUR - Euro</option>
							<option value="GBP">GBP - British Pound</option>
							<option value="ZAR">ZAR - South African Rand</option>
						</select>
					</div>
					<div>
						<label for="numAccountsPerBank" class="block text-sm font-medium mb-1">Accounts per Bank</label>
						<input
							type="number"
							id="numAccountsPerBank"
							name="numAccountsPerBank"
							bind:value={numAccountsPerBank}
							min="1"
							max="10"
							class="input w-full"
							disabled={isLoading}
						/>
					</div>
				</div>

				<hr class="border-surface-700" />

				<!-- Optional Features -->
				<div class="space-y-3">
					<p class="text-sm font-medium">Additional Data</p>

					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							name="createCounterparties"
							bind:checked={createCounterparties}
							class="checkbox"
							disabled={isLoading}
						/>
						<span class="flex items-center gap-2">
							<Users class="size-4 text-tertiary-500" />
							Create Counterparties (Botswana businesses)
						</span>
					</label>

					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							name="createFxRates"
							bind:checked={createFxRates}
							class="checkbox"
							disabled={isLoading}
						/>
						<span class="flex items-center gap-2">
							<TrendingUp class="size-4 text-tertiary-500" />
							Create FX Rates (African currencies + CNY)
						</span>
					</label>

					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							name="createTransactions"
							bind:checked={createTransactions}
							class="checkbox"
							disabled={isLoading}
						/>
						<span class="flex items-center gap-2">
							<History class="size-4 text-tertiary-500" />
							Create Historical Transactions (12 months)
						</span>
					</label>
				</div>

				<button
					type="submit"
					class="btn preset-filled-primary-500 w-full mt-6"
					disabled={isLoading || isLoadingCounterpartyTxn || isLoadingAccountTxn}
				>
					{#if isLoading}
						<Loader2 class="size-5 animate-spin mr-2" />
						Populating...
					{:else}
						<Database class="size-5 mr-2" />
						Populate Sandbox
					{/if}
				</button>
			</form>

			<hr class="border-surface-700 my-4" />

			<p class="text-sm font-medium mb-3">Transaction Requests</p>
			<div class="grid grid-cols-2 gap-3">
				<form
					method="POST"
					action="?/createCounterpartyTransactionRequests"
					use:enhance={() => {
						isLoadingCounterpartyTxn = true;
						return async ({ update }) => {
							await update();
							isLoadingCounterpartyTxn = false;
						};
					}}
				>
					<button
						type="submit"
						class="btn preset-tonal-secondary w-full text-sm"
						disabled={isLoading || isLoadingCounterpartyTxn || isLoadingAccountTxn}
					>
						{#if isLoadingCounterpartyTxn}
							<Loader2 class="size-4 animate-spin mr-1" />
						{:else}
							<Users class="size-4 mr-1" />
						{/if}
						10 to Counterparties
					</button>
				</form>

				<form
					method="POST"
					action="?/createAccountTransactionRequests"
					use:enhance={() => {
						isLoadingAccountTxn = true;
						return async ({ update }) => {
							await update();
							isLoadingAccountTxn = false;
						};
					}}
				>
					<button
						type="submit"
						class="btn preset-tonal-secondary w-full text-sm"
						disabled={isLoading || isLoadingCounterpartyTxn || isLoadingAccountTxn}
					>
						{#if isLoadingAccountTxn}
							<Loader2 class="size-4 animate-spin mr-1" />
						{:else}
							<ArrowRightLeft class="size-4 mr-1" />
						{/if}
						10 to Accounts
					</button>
				</form>
			</div>
		</div>

		<!-- Results Panel -->
		<div class="card p-6 preset-filled-surface-50-950">
			<h2 class="h3 mb-4 flex items-center gap-2">
				{#if form?.success}
					<CheckCircle class="size-5 text-success-500" />
					Results
				{:else if form?.error}
					<XCircle class="size-5 text-error-500" />
					Results
				{:else if hasExistingData()}
					<Database class="size-5 text-secondary-500" />
					Existing Data
				{:else}
					<Database class="size-5 text-surface-500" />
					Results
				{/if}
			</h2>

			{#if isLoading}
				<div class="py-6 text-surface-400">
					<p class="text-sm mb-4">Populating sandbox data...</p>
					<ul class="space-y-3">
						<li class="flex items-center gap-3">
							<Loader2 class="size-4 animate-spin text-primary-400" />
							<span>Creating {numBanks} bank{numBanks > 1 ? 's' : ''}...</span>
						</li>
						<li class="flex items-center gap-3">
							<Loader2 class="size-4 animate-spin text-primary-400" />
							<span>Creating {numAccountsPerBank} account{numAccountsPerBank > 1 ? 's' : ''} per bank...</span>
						</li>
						{#if createCounterparties}
							<li class="flex items-center gap-3">
								<Loader2 class="size-4 animate-spin text-primary-400" />
								<span>Adding Botswana business counterparties...</span>
							</li>
						{/if}
						{#if createFxRates}
							<li class="flex items-center gap-3">
								<Loader2 class="size-4 animate-spin text-primary-400" />
								<span>Setting up FX rates for African currencies...</span>
							</li>
						{/if}
						{#if createTransactions}
							<li class="flex items-center gap-3">
								<Loader2 class="size-4 animate-spin text-primary-400" />
								<span>Generating 12 months of historical transactions...</span>
							</li>
						{/if}
					</ul>
					<p class="text-xs text-surface-500 mt-6">This may take a moment depending on the number of items...</p>
				</div>
			{:else if isLoadingCounterpartyTxn || isLoadingAccountTxn}
				<div class="py-6 text-surface-400">
					<p class="text-sm mb-4">Creating transaction requests...</p>
					<ul class="space-y-3">
						<li class="flex items-center gap-3">
							<Loader2 class="size-4 animate-spin text-primary-400" />
							<span>Creating 10 transaction requests...</span>
						</li>
					</ul>
				</div>
			{:else if form?.success && form?.action && form.results?.transactionRequests}
				<div class="space-y-4 max-h-[60vh] overflow-y-auto">
					<p class="text-sm text-surface-400 mb-2">
						Created {form.results.transactionRequests.length} {form.action === 'counterpartyTransactionRequests' ? 'COUNTERPARTY' : 'ACCOUNT'} transaction requests
					</p>

					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center gap-2 mb-2">
							<Send class="size-4 text-secondary-500" />
							<span class="font-medium">Transaction Requests: {form.results.transactionRequests.length}</span>
						</div>
						{#if form.results.transactionRequests.length > 0}
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-48 overflow-y-auto">
								{#each form.results.transactionRequests as txnReq}
									<li class="flex items-center gap-1">
										<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										<code class="text-xs bg-surface-700 px-1 rounded">{txnReq.id}</code>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-tertiary-400">{txnReq.amount}</span>
										<span class="text-surface-500 mx-1">→</span>
										<span class="text-surface-300">{txnReq.counterparty || txnReq.toAccount}</span>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-xs px-1 rounded {txnReq.status === 'COMPLETED' ? 'bg-success-700' : 'bg-warning-700'}">{txnReq.status}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					{#if form.results.errors && form.results.errors.length > 0}
						<div class="p-3 rounded-lg bg-error-900/30 border border-error-700">
							<div class="flex items-center gap-2 mb-2">
								<XCircle class="size-4 text-error-500" />
								<span class="font-medium text-error-400">Errors: {form.results.errors.length}</span>
							</div>
							<ul class="text-sm text-error-300 ml-6 space-y-1 max-h-32 overflow-y-auto">
								{#each form.results.errors as error}
									<li class="truncate">{error}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{:else if form?.success && form.results}
				<div class="space-y-4 max-h-[60vh] overflow-y-auto">
					<!-- Banks -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<Building class="size-4 text-secondary-500" />
								<span class="font-medium">Banks: {form.results.banks.length}</span>
								{#if form.results.banks.filter(b => !b.existed).length > 0}
									<span class="text-xs text-success-400">{form.results.banks.filter(b => !b.existed).length} new</span>
								{/if}
								{#if form.results.banks.filter(b => b.existed).length > 0}
									<span class="text-xs text-warning-400">{form.results.banks.filter(b => b.existed).length} existing</span>
								{/if}
							</div>
							{#if form.results.banks.length > 0}
								<button
									type="button"
									onclick={() => copyToClipboard('banks', formatBanks())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy banks"
								>
									{#if copiedSection === 'banks'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							{/if}
						</div>
						{#if form.results.banks.length > 0}
							<ul class="text-sm text-surface-400 ml-6 space-y-1">
								{#each form.results.banks as bank}
									<li class="flex items-center gap-1">
										{#if bank.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<a
											href={getBankUrl(bank)}
											class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<code class="text-xs bg-surface-700 px-1 rounded">{bank.bank_id}</code>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-surface-300">{bank.bank_code}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<!-- Accounts -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<Wallet class="size-4 text-secondary-500" />
								<span class="font-medium">Accounts: {form.results.accounts.length}</span>
								{#if form.results.accounts.filter(a => !a.existed).length > 0}
									<span class="text-xs text-success-400">{form.results.accounts.filter(a => !a.existed).length} new</span>
								{/if}
								{#if form.results.accounts.filter(a => a.existed).length > 0}
									<span class="text-xs text-warning-400">{form.results.accounts.filter(a => a.existed).length} existing</span>
								{/if}
							</div>
							{#if form.results.accounts.length > 0}
								<button
									type="button"
									onclick={() => copyToClipboard('accounts', formatAccounts())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy accounts"
								>
									{#if copiedSection === 'accounts'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							{/if}
						</div>
						{#if form.results.accounts.length > 0}
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each form.results.accounts as account}
									<li class="flex items-center gap-1">
										{#if account.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<a
											href={getAccountUrl(account)}
											class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<code class="text-xs bg-surface-700 px-1 rounded">{account.account_id}</code>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-surface-300">{account.label}</span>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-tertiary-400">{account.currency}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<!-- Counterparties -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<Users class="size-4 text-secondary-500" />
								<span class="font-medium">Counterparties: {form.results.counterparties.length}</span>
								{#if form.results.counterparties.filter(cp => !cp.existed).length > 0}
									<span class="text-xs text-success-400">{form.results.counterparties.filter(cp => !cp.existed).length} new</span>
								{/if}
								{#if form.results.counterparties.filter(cp => cp.existed).length > 0}
									<span class="text-xs text-warning-400">{form.results.counterparties.filter(cp => cp.existed).length} existing</span>
								{/if}
							</div>
							{#if form.results.counterparties.length > 0}
								<button
									type="button"
									onclick={() => copyToClipboard('counterparties', formatCounterparties())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy counterparties"
								>
									{#if copiedSection === 'counterparties'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							{/if}
						</div>
						{#if form.results.counterparties.length > 0}
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each form.results.counterparties as cp}
									<li class="flex items-center gap-1">
										{#if cp.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<a
											href={getCounterpartyUrl(cp)}
											class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<span>{cp.name}</span>
											<ExternalLink class="size-3" />
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<!-- FX Rates -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<TrendingUp class="size-4 text-secondary-500" />
								<span class="font-medium">FX Rates: {form.results.fxRates.length}</span>
								{#if form.results.fxRates.filter(fx => !fx.existed).length > 0}
									<span class="text-xs text-success-400">{form.results.fxRates.filter(fx => !fx.existed).length} new</span>
								{/if}
								{#if form.results.fxRates.filter(fx => fx.existed).length > 0}
									<span class="text-xs text-warning-400">{form.results.fxRates.filter(fx => fx.existed).length} existing</span>
								{/if}
							</div>
							{#if form.results.fxRates.length > 0}
								<button
									type="button"
									onclick={() => copyToClipboard('fxRates', formatFxRates())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy FX rates"
								>
									{#if copiedSection === 'fxRates'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							{/if}
						</div>
						{#if form.results.fxRates.length > 0}
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each form.results.fxRates.slice(0, 10) as fx}
									<li class="flex items-center gap-1">
										{#if fx.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<span>{fx.from_currency} → {fx.to_currency}:</span>
										<code class="text-xs bg-surface-700 px-1 rounded">{fx.rate}</code>
									</li>
								{/each}
								{#if form.results.fxRates.length > 10}
									<li class="text-surface-500">...and {form.results.fxRates.length - 10} more</li>
								{/if}
							</ul>
						{/if}
					</div>

					<!-- Transactions -->
					<div class="p-3 rounded-lg bg-surface-800/50">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<History class="size-4 text-secondary-500" />
								<span class="font-medium">Transactions: {form.results.transactions.length}</span>
								{#if form.results.transactions.filter(t => !t.existed).length > 0}
									<span class="text-xs text-success-400">{form.results.transactions.filter(t => !t.existed).length} new</span>
								{/if}
								{#if form.results.transactions.filter(t => t.existed).length > 0}
									<span class="text-xs text-warning-400">{form.results.transactions.filter(t => t.existed).length} existing</span>
								{/if}
							</div>
							{#if form.results.transactions.length > 0}
								<button
									type="button"
									onclick={() => copyToClipboard('transactions', formatTransactions())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy transactions"
								>
									{#if copiedSection === 'transactions'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							{/if}
						</div>
						{#if form.results.transactions.length > 0}
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each form.results.transactions as txn}
									<li class="flex items-center gap-1">
										{#if txn.existed}
											<span title="Already existed"><RotateCcw class="size-3 text-warning-400" /></span>
										{:else}
											<span title="Newly created"><Plus class="size-3 text-success-400" /></span>
										{/if}
										<a
											href={getTransactionUrl(txn)}
											class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<code class="text-xs bg-surface-700 px-1 rounded">{txn.transaction_id}</code>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-tertiary-400">{txn.amount}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<!-- Errors -->
					{#if form.results.errors && form.results.errors.length > 0}
						<div class="p-3 rounded-lg bg-error-900/30 border border-error-700">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<XCircle class="size-4 text-error-500" />
									<span class="font-medium text-error-400"
										>Errors: {form.results.errors.length}</span
									>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('errors', formatErrors())}
									class="btn btn-sm preset-tonal-error flex items-center gap-1"
									title="Copy all errors to clipboard"
								>
									{#if copiedSection === 'errors'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-error-300 ml-6 space-y-1 max-h-32 overflow-y-auto">
								{#each form.results.errors.slice(0, 5) as error}
									<li class="truncate">{error}</li>
								{/each}
								{#if form.results.errors.length > 5}
									<li class="text-error-400">...and {form.results.errors.length - 5} more</li>
								{/if}
							</ul>
						</div>
					{/if}
				</div>
			{:else if form?.error}
				<div class="p-4 rounded-lg bg-error-900/30 border border-error-700">
					<p class="text-error-400">{form.error}</p>
				</div>
			{:else if hasExistingData()}
				<div class="space-y-4 max-h-[60vh] overflow-y-auto">
					<p class="text-sm text-surface-400 mb-4">Showing existing data for prefix <code class="bg-surface-700 px-1 rounded">{data.defaults.bankIdPrefix}</code></p>

					<!-- Existing Banks -->
					{#if data.existing.banks.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<Building class="size-4 text-secondary-500" />
									<span class="font-medium">Banks: {data.existing.banks.length}</span>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('existingBanks', formatExistingBanks())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy banks"
								>
									{#if copiedSection === 'existingBanks'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1">
								{#each data.existing.banks as bank}
									<li class="flex items-center gap-1">
										<a
											href={getBankUrl(bank)}
											class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<code class="text-xs bg-surface-700 px-1 rounded">{bank.bank_id}</code>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-surface-300">{bank.full_name}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Existing Accounts -->
					{#if data.existing.accounts.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<Wallet class="size-4 text-secondary-500" />
									<span class="font-medium">Accounts: {data.existing.accounts.length}</span>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('existingAccounts', formatExistingAccounts())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy accounts"
								>
									{#if copiedSection === 'existingAccounts'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each data.existing.accounts as account}
									<li class="flex items-center gap-1">
										<a
											href={getAccountUrl(account)}
											class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<code class="text-xs bg-surface-700 px-1 rounded">{account.account_id}</code>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-surface-300">{account.label}</span>
										{#if account.currency}
											<span class="text-surface-500 mx-1">|</span>
											<span class="text-tertiary-400">{account.currency}</span>
										{/if}
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Existing Counterparties -->
					{#if data.existing.counterparties.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<Users class="size-4 text-secondary-500" />
									<span class="font-medium">Counterparties: {data.existing.counterparties.length}</span>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('existingCounterparties', formatExistingCounterparties())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy counterparties"
								>
									{#if copiedSection === 'existingCounterparties'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each data.existing.counterparties as cp}
									<li class="flex items-center gap-1">
										<a
											href={getCounterpartyUrl(cp)}
											class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<span>{cp.name}</span>
											<ExternalLink class="size-3" />
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Existing FX Rates -->
					{#if data.existing.fxRates.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<TrendingUp class="size-4 text-secondary-500" />
									<span class="font-medium">FX Rates: {data.existing.fxRates.length}</span>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('existingFxRates', formatExistingFxRates())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy FX rates"
								>
									{#if copiedSection === 'existingFxRates'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each data.existing.fxRates.slice(0, 10) as fx}
									<li>{fx.from_currency} → {fx.to_currency}: <code class="text-xs bg-surface-700 px-1 rounded">{fx.rate}</code></li>
								{/each}
								{#if data.existing.fxRates.length > 10}
									<li class="text-surface-500">...and {data.existing.fxRates.length - 10} more</li>
								{/if}
							</ul>
						</div>
					{/if}

					<!-- Existing Transactions -->
					{#if data.existing.transactions.length > 0}
						<div class="p-3 rounded-lg bg-surface-800/50">
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<History class="size-4 text-secondary-500" />
									<span class="font-medium">Transactions: {data.existing.transactions.length}</span>
								</div>
								<button
									type="button"
									onclick={() => copyToClipboard('existingTransactions', formatExistingTransactions())}
									class="btn btn-sm preset-tonal flex items-center gap-1"
									title="Copy transactions"
								>
									{#if copiedSection === 'existingTransactions'}
										<Check class="size-3" />
									{:else}
										<Copy class="size-3" />
									{/if}
								</button>
							</div>
							<ul class="text-sm text-surface-400 ml-6 space-y-1 max-h-24 overflow-y-auto">
								{#each data.existing.transactions as txn}
									<li class="flex items-center gap-1">
										<a
											href={getTransactionUrl(txn)}
											class="text-primary-400 hover:text-primary-300 flex items-center gap-1"
										>
											<code class="text-xs bg-surface-700 px-1 rounded">{txn.transaction_id}</code>
											<ExternalLink class="size-3" />
										</a>
										<span class="text-surface-500 mx-1">|</span>
										<span class="text-tertiary-400">{txn.amount}</span>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{:else}
				<div class="flex flex-col items-center justify-center py-12 text-surface-500">
					<Database class="size-12 mb-4 opacity-50" />
					<p>No existing data for prefix <code class="bg-surface-700 px-1 rounded">{data.defaults.bankIdPrefix}</code></p>
					<p class="text-sm mt-2">Configure options and click "Populate Sandbox"</p>
				</div>
			{/if}
		</div>
	</div>
</div>
