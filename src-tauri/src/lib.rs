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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}