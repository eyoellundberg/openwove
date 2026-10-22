// The desktop shell: starts the runner (a bundled Node), waits for it, and shows the app in a window.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    net::TcpStream,
    path::PathBuf,
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

/// The runner's port. The agent's MCP server talks to the same one.
const PORT: u16 = 5189;
const START_TIMEOUT: Duration = Duration::from_secs(20);

struct Runner(Mutex<Option<CommandChild>>);

fn start_runner(app: &tauri::AppHandle) -> Result<CommandChild, String> {
    let resources: PathBuf = app.path().resource_dir().map_err(|e| e.to_string())?.join("resources");
    let home = app.path().home_dir().map_err(|e| e.to_string())?.join("OpenWove");
    let path = |p: &str| resources.join(p).to_string_lossy().into_owned();

    let (_events, child) = app
        .shell()
        .sidecar("node")
        .map_err(|e| e.to_string())?
        .args([path("runner.mjs")])
        .env("OPENWOVE_HOME", home.to_string_lossy().into_owned())
        .env("OPENWOVE_STATIC", path("dist"))
        .env("OPENWOVE_SEED", path("seed"))
        .env("OPENWOVE_FILES_SERVER", path("files-server.mjs"))
        .env("RUNNER_PORT", PORT.to_string())
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(child)
}

fn wait_for_runner() -> bool {
    let start = Instant::now();
    while start.elapsed() < START_TIMEOUT {
        if TcpStream::connect(("127.0.0.1", PORT)).is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(100));
    }
    false
}

fn open_window(app: &tauri::AppHandle) -> tauri::Result<()> {
    let url = format!("http://127.0.0.1:{PORT}");
    let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.parse().unwrap()))
        .title("OpenWove")
        .inner_size(1280.0, 820.0)
        .min_inner_size(900.0, 600.0)
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        .transparent(true)
        // Like any Mac app: the first click on an inactive window also presses what's under it.
        .accept_first_mouse(true)
        // The page lays itself out around the traffic lights when it knows it's in the app.
        .initialization_script("document.documentElement.classList.add('desktop')")
        .build()?;

    // macOS's own frosted material behind the window. Only shows where the page is see-through.
    #[cfg(target_os = "macos")]
    {
        use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
        let _ = apply_vibrancy(&window, NSVisualEffectMaterial::Sidebar, None, None);
    }
    let _ = window;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            match start_runner(&handle) {
                Ok(child) => *handle.state::<Runner>().0.lock().unwrap() = Some(child),
                Err(e) => eprintln!("Couldn't start the runner: {e}"),
            }
            thread::spawn(move || {
                if !wait_for_runner() {
                    eprintln!("The runner didn't start in time.");
                }
                let h = handle.clone();
                let _ = handle.run_on_main_thread(move || {
                    let _ = open_window(&h);
                });
            });
            Ok(())
        })
        .manage(Runner(Mutex::new(None)))
        .build(tauri::generate_context!())
        .expect("error while building OpenWove")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(child) = app.state::<Runner>().0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
