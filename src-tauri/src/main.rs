
#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::{Manager, State};
use mdns_sd::{ServiceDaemon, ServiceInfo};
use serde::{Serialize, Deserialize};
use warp::Filter;
use std::sync::{Arc, Mutex};
use std::net::SocketAddr;
use std::collections::HashMap;
use base64::prelude::*;
mod diagnostics;
use diagnostics::run_network_diagnostics;

#[derive(Serialize, Deserialize, Debug, Clone)]
struct PeerInfo {
    id: String,
    ip: String,
    port: u16,
    hostname: String,
    franchise_name: Option<String>,
    last_seen: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct SignalPayload {
    sender_id: String,
    type_: String, // "offer", "answer", "candidate"
    sdp: Option<String>,
    candidate: Option<String>,
}

// Global App State to store peers
struct AppState {
    peers: Arc<Mutex<HashMap<String, PeerInfo>>>,
    p2p_started: Arc<Mutex<bool>>,
    port: Arc<Mutex<u16>>,
}

#[tauri::command]
fn p2p_list_discovered_peers(state: State<'_, AppState>) -> Vec<PeerInfo> {
    let peers = state.peers.lock().unwrap();
    peers.values().cloned().collect()
}

#[tauri::command]
async fn fix_firewall_rules() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        println!("Attempting to open firewall rules...");
        let script = r#"
            $ruleNameTCP = "TrierFantasy P2P - TCP 15432"
            $ruleNameUDP = "TrierFantasy P2P - UDP 5353"
            
            Remove-NetFirewallRule -DisplayName $ruleNameTCP -ErrorAction SilentlyContinue
            Remove-NetFirewallRule -DisplayName $ruleNameUDP -ErrorAction SilentlyContinue

            New-NetFirewallRule -DisplayName $ruleNameTCP -Direction Inbound -LocalPort 15432 -Protocol TCP -Action Allow
            New-NetFirewallRule -DisplayName $ruleNameUDP -Direction Inbound -LocalPort 5353 -Protocol UDP -Action Allow
        "#;

        // Execute via PowerShell with Elevation request
        let encoded_script = BASE64_STANDARD.encode(script.encode_utf16().collect::<Vec<u16>>().iter().flat_map(|c| c.to_le_bytes()).collect::<Vec<u8>>());
        
        // Simple trick: Create a wrapper script that runs the real script as Admin
        // OR just run std::process::Command with "runas"
        
        let status = std::process::Command::new("powershell")
            .args(&["-Command", "Start-Process", "powershell", "-ArgumentList", &format!("'-EncodedCommand {}'", encoded_script), "-Verb", "RunAs", "-Wait"])
            .status()
            .map_err(|e| e.to_string())?;

        if status.success() {
            Ok("Firewall rules updated successfully".into())
        } else {
            Err("Failed to execute firewall update".into())
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Firewall update only supported on Windows".into())
    }
}

#[tauri::command]
async fn start_p2p_services(app_handle: tauri::AppHandle, state: State<'_, AppState>, node_id: String, franchise_name: String) -> Result<u16, String> {
    {
        let mut started = state.p2p_started.lock().unwrap();
        if (*started) {
            let p = state.port.lock().unwrap();
            println!("P2P Services already running for Node: {} on port {}. Skipping init.", node_id, *p);
            return Ok(*p);
        }
        // Ensure port is reset if p2p_started is false. (Manual safety)
        *state.port.lock().unwrap() = 0;
        *started = true;
    }

    // 1. Determine Port (Try 15432, fallback to dynamic)
    let try_port = 15432;
    let listener = std::net::TcpListener::bind(format!("0.0.0.0:{}", try_port));
    let port = match listener {
        Ok(l) => {
            let p = l.local_addr().unwrap().port();
            drop(l);
            p
        },
        Err(_) => {
            println!("Port {} in use, requesting dynamic port...", try_port);
            let l = std::net::TcpListener::bind("0.0.0.0:0").unwrap();
            let p = l.local_addr().unwrap().port();
            drop(l);
            p
        }
    };

    {
        let mut p_store = state.port.lock().unwrap();
        *p_store = port;
    }

    println!("Starting P2P Services for Node: {} on port {}", node_id, port);

    // 2. Start HTTP Signaling Server (Warp)
    let handle = app_handle.clone();
    
    let cors = warp::cors()
        .allow_any_origin()
        .allow_header("content-type")
        .allow_methods(vec!["POST"]);

    let signal_route = warp::post()
        .and(warp::path("signal"))
        .and(warp::body::json())
        .map(move |payload: SignalPayload| {
            println!("Received Signal from {}: {}", payload.sender_id, payload.type_);
            let _ = handle.emit_all("PEER_SIGNAL", payload.clone());
            warp::reply::json(&"OK")
        })
        .with(cors);

    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            let addr: SocketAddr = ([0, 0, 0, 0], port).into();
            println!("P2P Signaling Server listening on {}", addr);
            warp::serve(signal_route).run(addr).await;
        });
    });

    // 3. Start mDNS Discovery
    let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;
    
    let service_type = "_trier_p2p._udp.local.";
    let host_name = format!("{}.local.", node_id);
    
    let mut properties: HashMap<String, String> = HashMap::new();
    properties.insert("version".to_string(), "1.0".to_string());
    properties.insert("node_id".to_string(), node_id.clone());
    properties.insert("franchise_name".to_string(), franchise_name.clone());
    
    let ip_arg = "0.0.0.0";
    let instance_name = format!("{}-{}", node_id, port);

    let my_service = ServiceInfo::new(
        service_type,
        &instance_name,
        &host_name,
        ip_arg, 
        port,
        Some(properties),
    ).map_err(|e| e.to_string())?;

    mdns.register(my_service).map_err(|e| e.to_string())?;

    // 4. Browse for Peers
    let browse_mdns = mdns.clone();
    let receiver = browse_mdns.browse(service_type).map_err(|e| e.to_string())?;
    let browse_handle = app_handle.clone();
    let peers_store = state.peers.clone();
    let my_node_id = node_id.clone();
    let my_port = port;

    std::thread::spawn(move || {
        while let Ok(event) = receiver.recv() {
            if let mdns_sd::ServiceEvent::ServiceResolved(info) = event {
                // Filter out exact self (same node AND same port)
                let peer_port = info.get_port();
                let peer_node_id = info.get_properties()
                    .get("node_id")
                    .cloned()
                    .unwrap_or_else(|| {
                        info.get_fullname().replace(&format!(".{}", service_type), "")
                    });

                if peer_port == my_port && peer_node_id == my_node_id {
                    continue; 
                }

                let ip = info.get_addresses().iter().next().map(|ip| ip.to_string()).unwrap_or_default();
                if ip.is_empty() { continue; }

                println!("Resolved Peer: {} (Node: {}) at {}:{}", info.get_fullname(), peer_node_id, ip, peer_port);
                
                let franchise_name = info.get_properties().get("franchise_name").cloned();

                let peer = PeerInfo {
                    id: peer_node_id.clone(),
                    ip,
                    port: peer_port,
                    hostname: info.get_hostname().to_string(),
                    franchise_name,
                    last_seen: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as u64,
                };
                
                // Update Store
                {
                    let mut map = peers_store.lock().unwrap();
                    map.insert(peer_node_id, peer.clone());
                }

                let _ = browse_handle.emit_all("PEER_DISCOVERED", peer);
            }
        }
    });

    Ok(port)
}

#[tauri::command]
fn get_system_serial() -> String {
    #[cfg(target_os = "windows")]
    {
        // Try multiple methods to find a unique hardware tag
        let commands = [
            "(Get-WmiObject win32_bios).SerialNumber",
            "(Get-WmiObject win32_baseboard).SerialNumber",
            "(Get-WmiObject win32_computersystemproduct).IdentifyingNumber",
            "(Get-WmiObject win32_computersystemproduct).UUID"
        ];

        for cmd in commands {
            let output = std::process::Command::new("powershell")
                .args(&["-Command", cmd])
                .output();
            
            if let Ok(o) = output {
                let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
                if !s.is_empty() && s != "Default string" && s != "None" {
                    println!("[Rust] Found Serial via {}: {}", cmd, s);
                    return s;
                }
            }
        }
        "0000".into()
    }
    #[cfg(not(target_os = "windows"))]
    {
        "0000".into()
    }
}

#[tauri::command]
fn get_local_ip() -> Result<String, String> {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_ntp_time() -> Result<u64, String> {
    use std::net::UdpSocket;
    use std::time::Duration;

    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.set_read_timeout(Some(Duration::from_secs(3))).map_err(|e| e.to_string())?;
    
    // NTP packet is 48 bytes
    let mut packet = [0u8; 48];
    packet[0] = 0x1B; // LI = 0 (no warning), VN = 3 (IPv4 only), Mode = 3 (Client)

    let ntp_server = "pool.ntp.org:123";
    socket.send_to(&packet, ntp_server).map_err(|e| e.to_string())?;

    let mut response = [0u8; 48];
    let (_amt, _src) = socket.recv_from(&mut response).map_err(|e| e.to_string())?;

    // Transmit Timestamp is at byte 40-47
    // Seconds since Jan 1, 1900
    let seconds = u32::from_be_bytes([response[40], response[41], response[42], response[43]]) as u64;
    
    // NTP fractional part (not needed for general date)
    // let fraction = u32::from_be_bytes([response[44], response[45], response[46], response[47]]);

    // Convert NTP (1900) to Unix (1970)
    const NTP_UNIX_OFFSET: u64 = 2_208_988_800;
    if seconds < NTP_UNIX_OFFSET {
        return Err("Invalid NTP response".into());
    }
    
    Ok(seconds - NTP_UNIX_OFFSET)
}

#[tauri::command]
fn p2p_refresh_discovery(state: State<'_, AppState>) {
    // Clear the peer list in Rust state to force a fresh resolution
    let mut peers = state.peers.lock().unwrap();
    peers.clear();
    println!("[Rust] Discovery Refreshed. Peer list cleared.");
}

fn main() {
  tauri::Builder::default()
    .manage(AppState {
        peers: Arc::new(Mutex::new(HashMap::new())),
        p2p_started: Arc::new(Mutex::new(false)),
        port: Arc::new(Mutex::new(0)),
    })
    .invoke_handler(tauri::generate_handler![
        start_p2p_services,
        p2p_list_discovered_peers,
        fix_firewall_rules,
        get_system_serial,
        get_ntp_time,
        get_local_ip,
        p2p_refresh_discovery,
        run_network_diagnostics
    ])
    .setup(|app| {
        Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
