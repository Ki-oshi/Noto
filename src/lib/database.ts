import Database from "@tauri-apps/plugin-sql"

let database: Database | null = null

export async function getDatabase(): Promise<Database> {
  if (database) {
    return database
  }

  database = await Database.load("sqlite:noto.db")

  return database
}