import { useEffect, useMemo, useRef, useState } from "react"
import {
  createAccount,
  createCategory,
  createTransaction,
  deleteAccount,
  deleteTransaction,
  getAccounts,
  getCategories,
  getTransactions,
  updateAccount,
  updateTransaction,
  type Account,
  type AccountType,
  type Category,
  type CategoryType,
  type Transaction,
  type TransactionType,
} from "../lib/finances"

import "./Finances.css"

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Cash",
  bank: "Bank",
  credit_card: "Credit card",
  savings: "Savings",
  investment: "Investment",
  loan: "Loan",
  other: "Other",
}

const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]

// Matches the app's own theme preset accent hues, same as Calendar's
// event colors — keeps every color picker in the app pulling from one
// consistent palette instead of each module inventing its own.
const ACCOUNT_COLORS = [
  "#A8C3A0",
  "#67A7C9",
  "#E797A8",
  "#DDA33B",
  "#9D7CF3",
  "#60C0C5",
]

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatShortDate(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M5 7h14M9.5 7V5.2c0-.4.3-.7.7-.7h3.6c.4 0 .7.3.7.7V7M7.5 7l.6 12.1c0 .5.4.9.9.9h6c.5 0 .9-.4.9-.9L16.5 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        d="M14.7 5.3l4 4L8 20H4v-4L14.7 5.3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Finances() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [savingAccount, setSavingAccount] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(
    null,
  )
  const [savingTransaction, setSavingTransaction] = useState(false)
  const [deletingTransaction, setDeletingTransaction] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  const accountNameInputRef = useRef<HTMLInputElement>(null)
  const transactionDescriptionRef = useRef<HTMLInputElement>(null)

  const savedAccount = editingAccount
    ? accounts.find((account) => account.id === editingAccount.id) ?? null
    : null

  const accountIsDirty =
    !!editingAccount &&
    !!savedAccount &&
    (editingAccount.name !== savedAccount.name ||
      editingAccount.account_type !== savedAccount.account_type ||
      editingAccount.currency !== savedAccount.currency ||
      (editingAccount.color ?? "") !== (savedAccount.color ?? ""))

  const savedTransaction = selectedTransaction
    ? transactions.find((transaction) => transaction.id === selectedTransaction.id) ??
      null
    : null

  const transactionIsDirty =
    !!selectedTransaction &&
    !!savedTransaction &&
    (selectedTransaction.description !== savedTransaction.description ||
      selectedTransaction.amount !== savedTransaction.amount ||
      selectedTransaction.transaction_type !== savedTransaction.transaction_type ||
      selectedTransaction.transaction_date !== savedTransaction.transaction_date ||
      selectedTransaction.account_id !== savedTransaction.account_id ||
      (selectedTransaction.category_id ?? "") !== (savedTransaction.category_id ?? "") ||
      (selectedTransaction.transfer_account_id ?? "") !==
        (savedTransaction.transfer_account_id ?? "") ||
      (selectedTransaction.notes ?? "") !== (savedTransaction.notes ?? ""))

  async function loadAll() {
    try {
      setError(null)
      const [accountsResult, categoriesResult, transactionsResult] = await Promise.all([
        getAccounts(),
        getCategories(),
        getTransactions(),
      ])
      setAccounts(accountsResult)
      setCategories(categoriesResult)
      setTransactions(transactionsResult)
    } catch (err) {
      console.error("Failed to load finances:", err)
      setError("Couldn't load your finances. Try again.")
    } finally {
      setLoading(false)
    }
  }

  async function refreshAccountBalances() {
    try {
      const result = await getAccounts()
      setAccounts(result)
    } catch (err) {
      console.error("Failed to refresh account balances:", err)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  function confirmDiscardAccountIfDirty() {
    if (!accountIsDirty) return true
    return window.confirm("You have unsaved account changes. Discard them?")
  }

  function confirmDiscardTransactionIfDirty() {
    if (!transactionIsDirty) return true
    return window.confirm("You have unsaved changes. Discard them?")
  }

  function handleSelectAccount(accountId: string | null) {
    setSelectedAccountId(accountId)
  }

  function handleEditAccount(account: Account) {
    if (editingAccount?.id === account.id) return
    if (!confirmDiscardAccountIfDirty()) return
    setError(null)
    setEditingAccount({ ...account })
  }

  function handleCloseAccountForm() {
    if (!confirmDiscardAccountIfDirty()) return
    setEditingAccount(null)
  }

  async function handleCreateAccount() {
    if (!confirmDiscardAccountIfDirty()) return

    try {
      setError(null)
      const account = await createAccount("New account", "cash", "PHP", 0)

      setAccounts((current) =>
        [...current, account].sort((a, b) => a.name.localeCompare(b.name)),
      )
      setEditingAccount(account)

      requestAnimationFrame(() => accountNameInputRef.current?.focus())
    } catch (err) {
      console.error("Failed to create account:", err)
      setError("Couldn't create a new account. Try again.")
    }
  }

  async function handleSaveAccount() {
    if (!editingAccount || savingAccount || !accountIsDirty) return

    try {
      setSavingAccount(true)
      setError(null)

      const updated = await updateAccount(editingAccount.id, {
        name: editingAccount.name,
        account_type: editingAccount.account_type,
        currency: editingAccount.currency,
        color: editingAccount.color,
        icon: editingAccount.icon,
      })

      if (!updated) {
        setError("That account no longer exists.")
        await loadAll()
        setEditingAccount(null)
        return
      }

      setAccounts((current) =>
        current
          .map((account) => (account.id === updated.id ? updated : account))
          .sort((a, b) => a.name.localeCompare(b.name)),
      )
      setEditingAccount(updated)
    } catch (err) {
      console.error("Failed to save account:", err)
      setError("Couldn't save this account. Try again.")
    } finally {
      setSavingAccount(false)
    }
  }

  async function handleDeleteAccount() {
    if (!editingAccount || deletingAccount) return
    if (
      !window.confirm(
        `Delete "${editingAccount.name || "this account"}"? Its transactions will stay, but this account will no longer appear.`,
      )
    ) {
      return
    }

    try {
      setDeletingAccount(true)
      setError(null)

      await deleteAccount(editingAccount.id)

      setAccounts((current) => current.filter((account) => account.id !== editingAccount.id))
      if (selectedAccountId === editingAccount.id) setSelectedAccountId(null)
      setEditingAccount(null)
    } catch (err) {
      console.error("Failed to delete account:", err)
      setError("Couldn't delete that account. Try again.")
    } finally {
      setDeletingAccount(false)
    }
  }

  function handleSelectTransaction(transaction: Transaction) {
    if (selectedTransaction?.id === transaction.id) return
    if (!confirmDiscardTransactionIfDirty()) return
    setError(null)
    setAddingCategory(false)
    setSelectedTransaction(transaction)
  }

  function handleCloseTransactionForm() {
    if (!confirmDiscardTransactionIfDirty()) return
    setAddingCategory(false)
    setSelectedTransaction(null)
  }

  async function handleCreateTransaction() {
    if (!confirmDiscardTransactionIfDirty()) return

    if (accounts.length === 0) {
      setError("Create an account before adding transactions.")
      return
    }

    try {
      setError(null)
      const defaultAccountId = selectedAccountId ?? accounts[0].id

      const transaction = await createTransaction({
        account_id: defaultAccountId,
        category_id: null,
        amount: 1,
        transaction_type: "expense",
        description: "New transaction",
        transaction_date: toDateKey(new Date()),
        transfer_account_id: null,
        notes: null,
      })

      setTransactions((current) => [transaction, ...current])
      await refreshAccountBalances()
      setAddingCategory(false)
      setSelectedTransaction(transaction)

      requestAnimationFrame(() => transactionDescriptionRef.current?.focus())
    } catch (err) {
      console.error("Failed to create transaction:", err)
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't create a new transaction. Try again.",
      )
    }
  }

  async function handleSaveTransaction() {
    if (!selectedTransaction || savingTransaction || !transactionIsDirty) return

    try {
      setSavingTransaction(true)
      setError(null)

      const updated = await updateTransaction(selectedTransaction.id, {
        account_id: selectedTransaction.account_id,
        category_id: selectedTransaction.category_id,
        amount: selectedTransaction.amount,
        transaction_type: selectedTransaction.transaction_type,
        description: selectedTransaction.description,
        transaction_date: selectedTransaction.transaction_date,
        transfer_account_id: selectedTransaction.transfer_account_id,
        notes: selectedTransaction.notes,
      })

      if (!updated) {
        setError("That transaction no longer exists.")
        await loadAll()
        setSelectedTransaction(null)
        return
      }

      setTransactions((current) =>
        current
          .map((transaction) => (transaction.id === updated.id ? updated : transaction))
          .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)),
      )
      setSelectedTransaction(updated)
      await refreshAccountBalances()
    } catch (err) {
      console.error("Failed to save transaction:", err)
      setError(
        err instanceof Error ? err.message : "Couldn't save your changes. Try again.",
      )
    } finally {
      setSavingTransaction(false)
    }
  }

  async function handleDeleteTransaction() {
    if (!selectedTransaction || deletingTransaction) return
    if (
      !window.confirm(`Delete "${selectedTransaction.description || "this transaction"}"?`)
    ) {
      return
    }

    try {
      setDeletingTransaction(true)
      setError(null)

      await deleteTransaction(selectedTransaction.id)

      setTransactions((current) =>
        current.filter((transaction) => transaction.id !== selectedTransaction.id),
      )
      setSelectedTransaction(null)
      await refreshAccountBalances()
    } catch (err) {
      console.error("Failed to delete transaction:", err)
      setError("Couldn't delete that transaction. Try again.")
    } finally {
      setDeletingTransaction(false)
    }
  }

  function handleTransactionTypeChange(type: TransactionType) {
    if (!selectedTransaction) return

    setAddingCategory(false)
    setSelectedTransaction({
      ...selectedTransaction,
      transaction_type: type,
      category_id: type === "transfer" ? null : selectedTransaction.category_id,
      transfer_account_id:
        type === "transfer" ? selectedTransaction.transfer_account_id : null,
    })
  }

  function handleCategorySelectChange(value: string) {
    if (!selectedTransaction) return

    if (value === "__new__") {
      setAddingCategory(true)
      setNewCategoryName("")
      return
    }

    setSelectedTransaction({ ...selectedTransaction, category_id: value || null })
  }

  async function handleConfirmNewCategory() {
    if (!selectedTransaction || !newCategoryName.trim()) return

    try {
      setError(null)
      const category = await createCategory(
        newCategoryName.trim(),
        selectedTransaction.transaction_type as CategoryType,
      )

      setCategories((current) =>
        [...current, category].sort((a, b) => a.name.localeCompare(b.name)),
      )
      setSelectedTransaction({ ...selectedTransaction, category_id: category.id })
      setAddingCategory(false)
      setNewCategoryName("")
    } catch (err) {
      console.error("Failed to create category:", err)
      setError("Couldn't create that category. Try again.")
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isSaveShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s"

      if (!isSaveShortcut) return
      event.preventDefault()

      if (selectedTransaction) {
        handleSaveTransaction()
      } else if (editingAccount) {
        handleSaveAccount()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTransaction, editingAccount, transactionIsDirty, accountIsDirty, savingTransaction, savingAccount])

  const visibleTransactions = useMemo(() => {
    if (!selectedAccountId) return transactions
    return transactions.filter(
      (transaction) =>
        transaction.account_id === selectedAccountId ||
        transaction.transfer_account_id === selectedAccountId,
    )
  }, [transactions, selectedAccountId])

  if (loading) {
    return (
      <div className="finances-app finances-app--loading">
        <span>Loading finances…</span>
      </div>
    )
  }

  const selectedAccount = selectedAccountId
    ? accounts.find((account) => account.id === selectedAccountId) ?? null
    : null

  function renderAccountRow(account: Account) {
    const isActive = selectedAccountId === account.id

    return (
      <div
        key={account.id}
        className={`account-item${isActive ? " account-item--active" : ""}`}
      >
        <button
          type="button"
          className="account-item-main"
          onClick={() => handleSelectAccount(account.id)}
        >
          <span
            className="account-color-dot"
            style={{ background: account.color ?? "var(--color-primary)" }}
          />
          <span className="account-item-body">
            <span className="account-item-name">
              {account.name || "Untitled account"}
            </span>
            <span className="account-item-type">
              {ACCOUNT_TYPE_LABELS[account.account_type]}
            </span>
          </span>
          <span
            className={`account-item-balance${
              account.current_balance < 0 ? " account-item-balance--negative" : ""
            }`}
          >
            {formatCurrency(account.current_balance, account.currency)}
          </span>
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={() => handleEditAccount(account)}
          aria-label="Edit account"
          title="Edit account"
        >
          <EditIcon />
        </button>
      </div>
    )
  }

  function renderTransactionRow(transaction: Transaction) {
    const account = accounts.find((a) => a.id === transaction.account_id)
    const category = categories.find((c) => c.id === transaction.category_id)
    const isActive = selectedTransaction?.id === transaction.id

    const signClass =
      transaction.transaction_type === "income"
        ? "transaction-amount--income"
        : transaction.transaction_type === "expense"
          ? "transaction-amount--expense"
          : "transaction-amount--transfer"

    const sign =
      transaction.transaction_type === "income"
        ? "+"
        : transaction.transaction_type === "expense"
          ? "−"
          : ""

    return (
      <button
        key={transaction.id}
        type="button"
        className={`transaction-row${isActive ? " transaction-row--active" : ""}`}
        onClick={() => handleSelectTransaction(transaction)}
      >
        <span className="transaction-date">
          {formatShortDate(transaction.transaction_date)}
        </span>

        <span className="transaction-main">
          <span className="transaction-description">
            {transaction.description || "Untitled transaction"}
          </span>
          <span className="transaction-meta">
            {!selectedAccountId && account && <span>{account.name}</span>}
            <span>{category ? category.name : "Uncategorized"}</span>
            {transaction.transaction_type === "transfer" && (
              <span className="transaction-transfer-note">
                → {accounts.find((a) => a.id === transaction.transfer_account_id)?.name ?? "—"}
              </span>
            )}
          </span>
        </span>

        <span className={`transaction-amount ${signClass}`}>
          {sign}
          {formatCurrency(transaction.amount, account?.currency ?? "PHP")}
        </span>
      </button>
    )
  }

  return (
    <div className="finances-app">
      <aside className="finances-sidebar">
        <div className="finances-sidebar-header">
          <span className="finances-sidebar-title">Accounts</span>
          <button
            type="button"
            className="icon-button"
            onClick={handleCreateAccount}
            aria-label="New account"
            title="New account"
          >
            <PlusIcon />
          </button>
        </div>

        {error && (
          <div className="finances-error" role="alert">
            {error}
          </div>
        )}

        {editingAccount ? (
          <div className="account-form">
            <input
              ref={accountNameInputRef}
              className="account-form-title"
              value={editingAccount.name}
              placeholder="Account name"
              onChange={(event) =>
                setEditingAccount({ ...editingAccount, name: event.target.value })
              }
            />

            <label className="field">
              <span className="field-label">Type</span>
              <select
                value={editingAccount.account_type}
                onChange={(event) =>
                  setEditingAccount({
                    ...editingAccount,
                    account_type: event.target.value as AccountType,
                  })
                }
              >
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ACCOUNT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Currency</span>
              <input
                type="text"
                value={editingAccount.currency}
                maxLength={3}
                onChange={(event) =>
                  setEditingAccount({
                    ...editingAccount,
                    currency: event.target.value.toUpperCase(),
                  })
                }
              />
            </label>

            <div className="field">
              <span className="field-label">Color</span>
              <div className="color-swatches">
                {ACCOUNT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch${
                      editingAccount.color === color ? " color-swatch--selected" : ""
                    }`}
                    style={{ background: color }}
                    onClick={() => setEditingAccount({ ...editingAccount, color })}
                    aria-label={`Set color ${color}`}
                    aria-pressed={editingAccount.color === color}
                  />
                ))}
              </div>
            </div>

            <p className="account-form-note">
              Balance is calculated automatically from this account's transactions.
            </p>

            <div className="account-form-actions">
              <button
                type="button"
                className="save-button"
                onClick={handleSaveAccount}
                disabled={savingAccount || !accountIsDirty}
              >
                {savingAccount ? "Saving…" : accountIsDirty ? "Save" : "Saved"}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={handleCloseAccountForm}
              >
                Close
              </button>
              <button
                type="button"
                className="icon-button icon-button--danger"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                title="Delete account"
                aria-label="Delete account"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ) : (
          <div className="account-list">
            <div
              className={`account-item${
                selectedAccountId === null ? " account-item--active" : ""
              }`}
            >
              <button
                type="button"
                className="account-item-main account-item-all"
                onClick={() => handleSelectAccount(null)}
              >
                <span className="account-item-name">All accounts</span>
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="account-list-empty">
                No accounts yet. Add one to start tracking transactions.
              </div>
            ) : (
              accounts.map(renderAccountRow)
            )}
          </div>
        )}
      </aside>

      <main className="finances-main">
        <div className="finances-toolbar">
          <div className="finances-toolbar-title">
            <h2>{selectedAccount ? selectedAccount.name : "All accounts"}</h2>
            {selectedAccount && (
              <span className="finances-toolbar-balance">
                {formatCurrency(selectedAccount.current_balance, selectedAccount.currency)}
              </span>
            )}
          </div>

          <button
            type="button"
            className="new-transaction-button"
            onClick={handleCreateTransaction}
            disabled={accounts.length === 0}
          >
            <PlusIcon />
            New transaction
          </button>
        </div>

        {selectedTransaction ? (
          <div className="transaction-form">
            <div className="transaction-form-header">
              <input
                ref={transactionDescriptionRef}
                className="transaction-form-title"
                value={selectedTransaction.description}
                placeholder="Transaction description"
                onChange={(event) =>
                  setSelectedTransaction({
                    ...selectedTransaction,
                    description: event.target.value,
                  })
                }
              />
              <button
                type="button"
                className="icon-button icon-button--danger"
                onClick={handleDeleteTransaction}
                disabled={deletingTransaction}
                title="Delete transaction"
                aria-label="Delete transaction"
              >
                <TrashIcon />
              </button>
            </div>

            <div className="transaction-fields">
              <label className="field">
                <span className="field-label">Type</span>
                <select
                  value={selectedTransaction.transaction_type}
                  onChange={(event) =>
                    handleTransactionTypeChange(event.target.value as TransactionType)
                  }
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>

              <label className="field">
                <span className="field-label">Amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={selectedTransaction.amount}
                  onChange={(event) =>
                    setSelectedTransaction({
                      ...selectedTransaction,
                      amount: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label className="field">
                <span className="field-label">Date</span>
                <input
                  type="date"
                  value={selectedTransaction.transaction_date.slice(0, 10)}
                  onChange={(event) =>
                    setSelectedTransaction({
                      ...selectedTransaction,
                      transaction_date: event.target.value,
                    })
                  }
                />
              </label>

              <label className="field">
                <span className="field-label">
                  {selectedTransaction.transaction_type === "transfer"
                    ? "From account"
                    : "Account"}
                </span>
                <select
                  value={selectedTransaction.account_id}
                  onChange={(event) =>
                    setSelectedTransaction({
                      ...selectedTransaction,
                      account_id: event.target.value,
                    })
                  }
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              {selectedTransaction.transaction_type === "transfer" ? (
                <label className="field">
                  <span className="field-label">To account</span>
                  <select
                    value={selectedTransaction.transfer_account_id ?? ""}
                    onChange={(event) =>
                      setSelectedTransaction({
                        ...selectedTransaction,
                        transfer_account_id: event.target.value || null,
                      })
                    }
                  >
                    <option value="" disabled>
                      Choose account
                    </option>
                    {accounts
                      .filter((account) => account.id !== selectedTransaction.account_id)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <label className="field">
                  <span className="field-label">Category</span>
                  <select
                    value={selectedTransaction.category_id ?? ""}
                    onChange={(event) => handleCategorySelectChange(event.target.value)}
                  >
                    <option value="">Uncategorized</option>
                    {categories
                      .filter(
                        (category) =>
                          category.category_type === selectedTransaction.transaction_type,
                      )
                      .map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    <option value="__new__">+ New category…</option>
                  </select>
                </label>
              )}
            </div>

            {addingCategory && (
              <div className="new-category-row">
                <input
                  type="text"
                  value={newCategoryName}
                  placeholder="Category name"
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      handleConfirmNewCategory()
                    }
                  }}
                />
                <button
                  type="button"
                  className="save-button"
                  onClick={handleConfirmNewCategory}
                >
                  Add
                </button>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => {
                    setAddingCategory(false)
                    setNewCategoryName("")
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            <label className="field field-grow">
              <span className="field-label">Notes</span>
              <textarea
                className="transaction-notes"
                value={selectedTransaction.notes ?? ""}
                placeholder="Add notes…"
                onChange={(event) =>
                  setSelectedTransaction({
                    ...selectedTransaction,
                    notes: event.target.value || null,
                  })
                }
              />
            </label>

            <div className="transaction-form-actions">
              <button
                type="button"
                className="save-button"
                onClick={handleSaveTransaction}
                disabled={savingTransaction || !transactionIsDirty}
              >
                {savingTransaction ? "Saving…" : transactionIsDirty ? "Save" : "Saved"}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={handleCloseTransactionForm}
              >
                Close
              </button>
            </div>
          </div>
        ) : accounts.length === 0 ? (
          <div className="finances-empty-state">
            <p>Add an account to start tracking your money.</p>
            <button type="button" className="save-button" onClick={handleCreateAccount}>
              New account
            </button>
          </div>
        ) : (
          <div className="transactions-list">
            {visibleTransactions.length === 0 ? (
              <div className="transactions-empty">No transactions yet.</div>
            ) : (
              visibleTransactions.map(renderTransactionRow)
            )}
          </div>
        )}
      </main>
    </div>
  )
}