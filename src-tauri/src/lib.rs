mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:noto.db",
                    vec![
                        tauri_plugin_sql::Migration {
                            version: 1,
                            description: "initial database",
                            sql: include_str!("../migrations/001_initial.sql"),
                            kind: tauri_plugin_sql::MigrationKind::Up,
                        },
                    ],
                )
                .build(),
        )
        .manage(vault::VaultState::default())
        .invoke_handler(tauri::generate_handler![
            vault::vault_setup,
            vault::vault_unlock,
            vault::vault_lock,
            vault::vault_is_unlocked,
            vault::vault_encrypt_secret,
            vault::vault_decrypt_secret,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}