import Database from "@tauri-apps/plugin-sql"

export type AccountType =
  | "cash"
  | "bank"
  | "credit_card"
  | "savings"
  | "investment"
  | "loan"
  | "other"

export type CategoryType = "income" | "expense" | "transfer"

export type TransactionType = "income" | "expense" | "transfer"

export interface Account {
  id: string
  workspace_id: string | null
  name: string
  account_type: AccountType
  currency: string
  initial_balance: number
  current_balance: number
  color: string | null
  icon: string | null
  metadata: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AccountEdits {
  name: string
  account_type: AccountType
  currency: string
  color: string | null
  icon: string | null
}

export interface Category {
  id: string
  workspace_id: string | null
  name: string
  category_type: CategoryType
  parent_id: string | null
  color: string | null
  icon: string | null
  metadata: string
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  workspace_id: string | null
  account_id: string
  category_id: string | null
  amount: number
  transaction_type: TransactionType
  description: string
  transaction_date: string
  transfer_account_id: string | null
  notes: string | null
  metadata: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface TransactionEdits {
  account_id: string
  category_id: string | null
  amount: number
  transaction_type: TransactionType
  description: string
  transaction_date: string
  transfer_account_id: string | null
  notes: string | null
}

let dbPromise: ReturnType<typeof Database.load> | null = null

async function getDatabase() {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:noto.db")
  }

  return dbPromise
}

function generateId() {
  return crypto.randomUUID()
}

// ---------- Balance maintenance ----------
//
// financial_accounts.current_balance has no trigger keeping it in sync
// with financial_transactions, so it's recomputed from scratch (not
// incremented) after every transaction create/update/delete. This
// avoids drift: an incremental approach breaks the moment an edit
// changes an amount, account, or type, while a full recalculation from
// the transaction log is always correct by construction.
async function recomputeAccountBalance(
  db: Awaited<ReturnType<typeof getDatabase>>,
  accountId: string,
) {
  const rows = await db.select<{ net: number }[]>(
    `
    SELECT
      COALESCE(SUM(
        CASE
          WHEN account_id = $1 AND transaction_type = 'income' THEN amount
          WHEN account_id = $1 AND transaction_type = 'expense' THEN -amount
          WHEN account_id = $1 AND transaction_type = 'transfer' THEN -amount
          WHEN transfer_account_id = $1 AND transaction_type = 'transfer' THEN amount
          ELSE 0
        END
      ), 0) AS net
    FROM financial_transactions
    WHERE deleted_at IS NULL
      AND (account_id = $1 OR transfer_account_id = $1)
    `,
    [accountId],
  )

  const net = rows[0]?.net ?? 0

  await db.execute(
    `
    UPDATE financial_accounts
    SET current_balance = initial_balance + $1
    WHERE id = $2
    `,
    [net, accountId],
  )
}

// ---------- Accounts ----------

export async function getAccounts(): Promise<Account[]> {
  const db = await getDatabase()

  return db.select<Account[]>(
    `
    SELECT *
    FROM financial_accounts
    WHERE deleted_at IS NULL
    ORDER BY name ASC
    `,
  )
}

export async function getAccount(id: string): Promise<Account | null> {
  const db = await getDatabase()

  const rows = await db.select<Account[]>(
    `
    SELECT *
    FROM financial_accounts
    WHERE id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [id],
  )

  return rows[0] ?? null
}

export async function createAccount(
  name: string,
  account_type: AccountType,
  currency = "PHP",
  initial_balance = 0,
): Promise<Account> {
  const db = await getDatabase()
  const id = generateId()

  await db.execute(
    `
    INSERT INTO financial_accounts (
      id, workspace_id, name, account_type, currency,
      initial_balance, current_balance
    )
    VALUES (
      $1, 'default', $2, $3, $4, $5, $5
    )
    `,
    [id, name, account_type, currency, initial_balance],
  )

  const account = await getAccount(id)

  if (!account) {
    throw new Error("Failed to create account")
  }

  return account
}

export async function updateAccount(id: string, edits: AccountEdits) {
  const db = await getDatabase()

  // updated_at is set automatically by trg_financial_accounts_updated.
  await db.execute(
    `
    UPDATE financial_accounts
    SET
      name = $1,
      account_type = $2,
      currency = $3,
      color = $4,
      icon = $5
    WHERE id = $6
    `,
    [edits.name, edits.account_type, edits.currency, edits.color, edits.icon, id],
  )

  return getAccount(id)
}

export async function deleteAccount(id: string) {
  const db = await getDatabase()

  await db.execute(
    `
    UPDATE financial_accounts
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = $1
    `,
    [id],
  )
}

// ---------- Categories ----------
//
// financial_categories has no deleted_at column in the schema, so
// deleteCategory below is a genuine hard DELETE, unlike everything
// else in this file.

export async function getCategories(): Promise<Category[]> {
  const db = await getDatabase()

  return db.select<Category[]>(
    `
    SELECT *
    FROM financial_categories
    ORDER BY name ASC
    `,
  )
}

export async function createCategory(
  name: string,
  category_type: CategoryType,
  parent_id: string | null = null,
): Promise<Category> {
  const db = await getDatabase()
  const id = generateId()

  await db.execute(
    `
    INSERT INTO financial_categories (
      id, workspace_id, name, category_type, parent_id
    )
    VALUES ($1, 'default', $2, $3, $4)
    `,
    [id, name, category_type, parent_id],
  )

  const rows = await db.select<Category[]>(
    `SELECT * FROM financial_categories WHERE id = $1 LIMIT 1`,
    [id],
  )

  const category = rows[0]

  if (!category) {
    throw new Error("Failed to create category")
  }

  return category
}

export async function deleteCategory(id: string) {
  const db = await getDatabase()

  // ON DELETE SET NULL on financial_transactions.category_id only
  // takes effect if the connection has `PRAGMA foreign_keys = ON`.
  // If it isn't set, referencing transactions keep a dangling
  // category_id — the UI treats that the same as "Uncategorized".
  await db.execute(`DELETE FROM financial_categories WHERE id = $1`, [id])
}

// ---------- Transactions ----------

function assertValidTransaction(edits: TransactionEdits) {
  if (!edits.account_id) {
    throw new Error("Choose an account.")
  }

  if (!(edits.amount > 0)) {
    throw new Error("Amount must be greater than zero.")
  }

  if (edits.transaction_type === "transfer") {
    if (!edits.transfer_account_id) {
      throw new Error("Choose a destination account for the transfer.")
    }
    if (edits.transfer_account_id === edits.account_id) {
      throw new Error("Transfer accounts must be different.")
    }
  }
}

export async function getTransactions(): Promise<Transaction[]> {
  const db = await getDatabase()

  return db.select<Transaction[]>(
    `
    SELECT *
    FROM financial_transactions
    WHERE deleted_at IS NULL
    ORDER BY transaction_date DESC, created_at DESC
    `,
  )
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const db = await getDatabase()

  const rows = await db.select<Transaction[]>(
    `
    SELECT *
    FROM financial_transactions
    WHERE id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [id],
  )

  return rows[0] ?? null
}

export async function createTransaction(
  edits: TransactionEdits,
): Promise<Transaction> {
  assertValidTransaction(edits)

  const db = await getDatabase()
  const id = generateId()

  await db.execute(
    `
    INSERT INTO financial_transactions (
      id, workspace_id, account_id, category_id, amount,
      transaction_type, description, transaction_date,
      transfer_account_id, notes
    )
    VALUES (
      $1, 'default', $2, $3, $4, $5, $6, $7, $8, $9
    )
    `,
    [
      id,
      edits.account_id,
      edits.category_id,
      edits.amount,
      edits.transaction_type,
      edits.description,
      edits.transaction_date,
      edits.transaction_type === "transfer" ? edits.transfer_account_id : null,
      edits.notes,
    ],
  )

  await recomputeAccountBalance(db, edits.account_id)
  if (edits.transaction_type === "transfer" && edits.transfer_account_id) {
    await recomputeAccountBalance(db, edits.transfer_account_id)
  }

  const transaction = await getTransaction(id)

  if (!transaction) {
    throw new Error("Failed to create transaction")
  }

  return transaction
}

export async function updateTransaction(id: string, edits: TransactionEdits) {
  assertValidTransaction(edits)

  const db = await getDatabase()
  const existing = await getTransaction(id)

  // updated_at is set automatically by trg_financial_transactions_updated.
  await db.execute(
    `
    UPDATE financial_transactions
    SET
      account_id = $1,
      category_id = $2,
      amount = $3,
      transaction_type = $4,
      description = $5,
      transaction_date = $6,
      transfer_account_id = $7,
      notes = $8
    WHERE id = $9
    `,
    [
      edits.account_id,
      edits.category_id,
      edits.amount,
      edits.transaction_type,
      edits.description,
      edits.transaction_date,
      edits.transaction_type === "transfer" ? edits.transfer_account_id : null,
      edits.notes,
      id,
    ],
  )

  // Recompute every account touched by either the old or new version
  // of this transaction (account/type/amount may all have changed).
  const affectedAccounts = new Set<string>()

  if (existing) {
    affectedAccounts.add(existing.account_id)
    if (existing.transfer_account_id) {
      affectedAccounts.add(existing.transfer_account_id)
    }
  }

  affectedAccounts.add(edits.account_id)
  if (edits.transaction_type === "transfer" && edits.transfer_account_id) {
    affectedAccounts.add(edits.transfer_account_id)
  }

  for (const accountId of affectedAccounts) {
    await recomputeAccountBalance(db, accountId)
  }

  return getTransaction(id)
}

export async function deleteTransaction(id: string) {
  const db = await getDatabase()
  const existing = await getTransaction(id)

  await db.execute(
    `
    UPDATE financial_transactions
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = $1
    `,
    [id],
  )

  if (existing) {
    await recomputeAccountBalance(db, existing.account_id)
    if (existing.transfer_account_id) {
      await recomputeAccountBalance(db, existing.transfer_account_id)
    }
  }
}