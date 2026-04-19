
#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::{Manager, State, SystemTray, SystemTrayMenu, SystemTrayMenuItem, CustomMenuItem, SystemTrayEvent};
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

// Snapshot of league state pushed by React every 5 s for the commissioner dashboard.
// Fields are pre-serialised JSON strings so Rust doesn't need to know the full schema.
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
struct CommissionerState {
    teams_json: String,     // JSON array: [{ id, name, owner, wins, losses, totalPts }]
    trades_json: String,    // JSON array of pending TRADE_OFFER transactions
    league_json: String,    // JSON object: { currentWeek, numWeeks, schedule: Matchup[] }
    locked_teams: Vec<String>,
    ruleset_name: String,
    league_name: String,
}

struct AppState {
    peers: Arc<Mutex<HashMap<String, PeerInfo>>>,
    p2p_started: Arc<Mutex<bool>>,
    port: Arc<Mutex<u16>>,
    commissioner: Arc<Mutex<CommissionerState>>,
    // Per-process session token — required by all dashboard API routes.
    // Generated once at startup; never changes; no mutex needed.
    token: String,
}

/// Generates a 32-char hex session token from timestamp + PID using LCG mixing.
/// Not cryptographically random, but unique per process start and unguessable locally.
fn generate_comm_token() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts  = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
    let pid = std::process::id() as u128;
    let a = ts.wrapping_mul(6364136223846793005u128)
              .wrapping_add(1442695040888963407u128) ^ pid;
    let b = a.wrapping_mul(2862933555777941757u128)
              .wrapping_add(3037000499u128);
    format!("{:032x}", b)
}

// ── Embedded Commissioner Dashboard HTML ──────────────────────────────────────
// Single-file vanilla HTML/JS page served at http://localhost:15434.
// Polls /api/state every 5 s; POSTs actions to /api/* routes.
// Bound to 127.0.0.1 — accessible only from this machine.
const COMM_DASHBOARD_HTML: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TFF Commissioner</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#080d1a;color:#e5e7eb;font-family:'Inter',system-ui,sans-serif;padding:20px 24px;min-height:100vh}
h1{font-family:'Orbitron',monospace;color:#eab308;letter-spacing:3px;font-size:1.4rem;text-transform:uppercase;margin-bottom:2px}
.sub{color:#4b5563;font-size:0.75rem;margin-bottom:20px;letter-spacing:1px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.full{grid-column:1/-1}
.panel{background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:16px}
.ptitle{display:flex;justify-content:space-between;align-items:center;font-family:'Orbitron',monospace;font-size:0.65rem;color:#eab308;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:0.82rem}
th{color:#6b7280;text-align:left;padding:4px 8px;font-size:0.68rem;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.07);text-transform:uppercase;letter-spacing:.5px}
td{padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.04)}
tr:last-child td{border-bottom:none}
.badge{display:inline-block;padding:2px 7px;border-radius:4px;font-size:0.68rem;font-weight:700}
.g{background:rgba(16,185,129,.18);color:#34d399}.r{background:rgba(239,68,68,.18);color:#f87171}.y{background:rgba(234,179,8,.18);color:#eab308}.p{background:rgba(167,139,250,.18);color:#a78bfa}
.btn{padding:4px 10px;border-radius:5px;border:none;cursor:pointer;font-size:0.72rem;font-weight:600;transition:opacity .15s}
.btn:hover{opacity:.8}
.btn-g{background:rgba(16,185,129,.2);color:#34d399;border:1px solid rgba(16,185,129,.4)}
.btn-r{background:rgba(239,68,68,.2);color:#f87171;border:1px solid rgba(239,68,68,.4)}
.btn-y{background:rgba(234,179,8,.18);color:#eab308;border:1px solid rgba(234,179,8,.4)}
.lock-grid{display:flex;flex-wrap:wrap;gap:5px}
.lbtn{padding:3px 7px;border-radius:4px;font-size:0.7rem;cursor:pointer;border:1px solid;font-weight:700;transition:all .12s}
.lk{background:rgba(239,68,68,.22);color:#f87171;border-color:rgba(239,68,68,.5)}
.ul{background:transparent;color:#4b5563;border-color:rgba(255,255,255,.12)}
.ul:hover{border-color:#6b7280;color:#9ca3af}
.ann{width:100%;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1);color:#e5e7eb;border-radius:6px;padding:9px;font-size:0.84rem;resize:vertical;min-height:58px;font-family:inherit}
.ann:focus{outline:none;border-color:rgba(234,179,8,.5)}
.no-data{color:#374151;font-size:0.8rem;text-align:center;padding:14px}
.trade-item{padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)}
.trade-item:last-child{border-bottom:none}
.trade-desc{font-size:0.82rem;margin-bottom:5px;line-height:1.4}
.trade-meta{display:flex;gap:7px;align-items:center}
.status-bar{font-size:0.68rem;color:#374151;text-align:right;margin-top:10px}
.wk-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}
</style>
</head>
<body>
<h1>&#9889; TFF Commissioner</h1>
<div class="sub" id="sub">LEAGUE DASHBOARD &middot; LOCAL ACCESS ONLY</div>

<div class="grid">

  <!-- Standings -->
  <div class="panel">
    <div class="ptitle">&#128202; Standings <span id="fmt" style="color:#6b7280;font-size:.6rem"></span></div>
    <table><thead><tr><th>#</th><th>Team</th><th>Owner</th><th>W</th><th>L</th><th>Pts</th></tr></thead>
    <tbody id="standings"><tr><td colspan="6" class="no-data">Waiting for sync...</td></tr></tbody></table>
  </div>

  <!-- Pending Trades -->
  <div class="panel">
    <div class="ptitle">&#128260; Pending Trades <span id="tcnt"></span></div>
    <div id="trades"><div class="no-data">No pending offers</div></div>
  </div>

  <!-- Schedule -->
  <div class="panel">
    <div class="ptitle">&#128197; Schedule</div>
    <div class="wk-row">
      <span style="font-size:.84rem">Week: <b id="wk" style="color:#eab308">–</b></span>
      <button class="btn btn-y" onclick="advanceWeek()">Advance Week &#8594;</button>
    </div>
    <table><thead><tr><th>Home</th><th></th><th>Away</th><th></th></tr></thead>
    <tbody id="sched"><tr><td colspan="4" class="no-data">No schedule</td></tr></tbody></table>
  </div>

  <!-- Game Day Locks -->
  <div class="panel">
    <div class="ptitle">&#128274; Game Day Locks
      <div style="display:flex;gap:5px">
        <button class="btn btn-r" onclick="setAllLocks(true)">Lock All</button>
        <button class="btn btn-g" onclick="setAllLocks(false)">Unlock All</button>
      </div>
    </div>
    <div class="lock-grid" id="locks">Loading...</div>
  </div>

  <!-- Announcement -->
  <div class="panel full">
    <div class="ptitle">&#128226; League Announcement</div>
    <textarea class="ann" id="ann" placeholder="Type a league-wide message..."></textarea>
    <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
      <button class="btn btn-y" onclick="sendAnn()">&#128228; Broadcast to League</button>
      <span id="ann-ok" style="font-size:.75rem;color:#34d399;display:none">&#10003; Sent</span>
    </div>
  </div>

</div>
<div class="status-bar">Last sync: <span id="ts">–</span> &middot; auto-refresh 5 s &middot; localhost only</div>

<script>
const __TOKEN='%%COMM_TOKEN%%'; // replaced at serve-time by comm_dashboard_html()
const TEAMS=['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAC','KC','LAC','LAR','LV','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SEA','SF','TB','TEN','WAS'];
let st=null,locked=[];

async function sync(){
  try{
    const r=await fetch('/api/state',{headers:{'X-Comm-Token':__TOKEN}});
    if(!r.ok)return;
    st=await r.json();
    locked=st.locked_teams||[];
    render();
    document.getElementById('ts').textContent=new Date().toLocaleTimeString();
  }catch(e){}
}

function render(){
  if(!st)return;
  document.getElementById('sub').textContent=(st.league_name||'Trier Fantasy Football').toUpperCase()+' \u00b7 LOCAL ACCESS ONLY';
  document.getElementById('fmt').textContent=st.ruleset_name||'';

  // Standings
  const teams=jp(st.teams_json,[]);
  const sb=document.getElementById('standings');
  if(!teams.length){sb.innerHTML='<tr><td colspan="6" class="no-data">No teams</td></tr>';return;}
  const sorted=[...teams].sort((a,b)=>(b.wins||0)-(a.wins||0)||(b.totalPts||0)-(a.totalPts||0));
  sb.innerHTML=sorted.map((t,i)=>`<tr>
    <td style="color:#4b5563">${i+1}</td>
    <td style="font-weight:600">${x(t.name)}</td>
    <td style="color:#6b7280">${x(t.owner)}</td>
    <td><span class="badge g">${t.wins||0}</span></td>
    <td><span class="badge r">${t.losses||0}</span></td>
    <td style="color:#eab308;font-weight:600">${(t.totalPts||0).toFixed(1)}</td>
  </tr>`).join('');

  // Trades
  const trades=jp(st.trades_json,[]);
  const tc=document.getElementById('tcnt');
  const tl=document.getElementById('trades');
  if(!trades.length){
    tc.innerHTML='';tl.innerHTML='<div class="no-data">No pending offers</div>';
  }else{
    tc.innerHTML=`<span class="badge y">${trades.length}</span>`;
    tl.innerHTML=trades.map(t=>`<div class="trade-item">
      <div class="trade-desc">${x(t.description)}</div>
      <div class="trade-meta">
        <span style="font-size:.7rem;color:#4b5563">${x(t.date||'')}</span>
        <button class="btn btn-g" onclick="tradAct('${x(t.id)}','approve')">&#10003; Approve</button>
        <button class="btn btn-r" onclick="tradAct('${x(t.id)}','decline')">&#10007; Decline</button>
      </div>
    </div>`).join('');
  }

  // Schedule
  const lg=jp(st.league_json,{});
  const cw=lg.currentWeek||1;
  document.getElementById('wk').textContent=`${cw} / ${lg.numWeeks||'–'}`;
  const matchups=(lg.schedule||[]).filter(m=>m.week===cw);
  const tmap=Object.fromEntries(teams.map(t=>[t.id,t.name]));
  const sc=document.getElementById('sched');
  if(!matchups.length){sc.innerHTML='<tr><td colspan="4" class="no-data">No matchups</td></tr>';}
  else{sc.innerHTML=matchups.map(m=>`<tr>
    <td>${x(tmap[m.homeTeamId]||m.homeTeamId)}</td>
    <td style="color:#4b5563;text-align:center;font-size:.7rem">vs</td>
    <td>${x(tmap[m.awayTeamId]||m.awayTeamId)}</td>
    <td>${m.completed?'<span class="badge g">Done</span>':'<span class="badge y">Active</span>'}</td>
  </tr>`).join('');}

  // Locks
  document.getElementById('locks').innerHTML=TEAMS.map(t=>{
    const lk=locked.includes(t);
    return`<button class="lbtn ${lk?'lk':'ul'}" onclick="tog('${t}')">${t}</button>`;
  }).join('');
}

function tog(team){
  locked=locked.includes(team)?locked.filter(t=>t!==team):[...locked,team];
  post('/api/locks',{set:locked});
  render();
}
function setAllLocks(all){
  locked=all?[...TEAMS]:[];
  post('/api/locks',{set:locked});
  render();
}
async function tradAct(id,action){await post('/api/trade',{offerId:id,action});sync();}
async function advanceWeek(){
  if(!confirm('Advance to the next week? Current week will be marked complete.'))return;
  await post('/api/week/advance',{});sync();
}
async function sendAnn(){
  const t=document.getElementById('ann').value.trim();
  if(!t)return;
  await post('/api/announce',{text:t});
  document.getElementById('ann').value='';
  const ok=document.getElementById('ann-ok');
  ok.style.display='';setTimeout(()=>ok.style.display='none',3000);
}
async function post(url,body){
  try{await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-Comm-Token':__TOKEN},body:JSON.stringify(body)});}catch(e){}
}
function jp(s,fb){try{return JSON.parse(s)||fb;}catch{return fb;}}
function x(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

sync();setInterval(sync,5000);
</script>
</body>
</html>"#;

/// Injects the per-session token into the dashboard HTML before serving.
/// Using string replacement avoids having to escape every `{` and `}` in the HTML.
fn comm_dashboard_html(token: &str) -> String {
    COMM_DASHBOARD_HTML.replace("%%COMM_TOKEN%%", token)
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

    // Transmit Timestamp is at byte 40-47 — seconds since Jan 1, 1900
    let seconds = u32::from_be_bytes([response[40], response[41], response[42], response[43]]) as u64;

    // Convert NTP epoch (1900) to Unix epoch (1970)
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

/// Receives a snapshot of league state from React and stores it for the commissioner dashboard.
/// Called every 5 seconds by App.tsx while the admin is logged in.
#[tauri::command]
fn sync_commissioner_state(state: State<'_, AppState>, data: CommissionerState) {
    let mut cs = state.commissioner.lock().unwrap();
    *cs = data;
}

/// Updates the "Pending Trades" tray menu item text when the frontend trade state changes.
#[tauri::command]
fn update_tray_badge(app_handle: tauri::AppHandle, has_offers: bool) {
    let title = if has_offers { "Pending Trade Offers ●" } else { "No Pending Trades" };
    // Silently ignore errors — tray may not be available on all platforms
    let _ = app_handle.tray_handle().get_item("trades").set_title(title);
}

/// Builds the system tray menu shown on right-click.
fn build_tray_menu() -> SystemTrayMenu {
    let show      = CustomMenuItem::new("show",       "Show App");
    let trades    = CustomMenuItem::new("trades",     "No Pending Trades").disabled();
    let lock_all  = CustomMenuItem::new("lock_all",   "Lock All Teams");
    let unlock_all= CustomMenuItem::new("unlock_all", "Unlock All Teams");
    let quit      = CustomMenuItem::new("quit",       "Quit");

    SystemTrayMenu::new()
        .add_item(show)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(trades)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(lock_all)
        .add_item(unlock_all)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit)
}

/// Returns the per-session dashboard token so the Settings page can display the full URL.
#[tauri::command]
fn get_comm_token(state: State<'_, AppState>) -> String {
    state.token.clone()
}

fn main() {
  // Build the system tray with tooltip and right-click menu
  let tray = SystemTray::new()
      .with_tooltip("Trier Fantasy Football")
      .with_menu(build_tray_menu());

  tauri::Builder::default()
    .system_tray(tray)
    .manage(AppState {
        peers: Arc::new(Mutex::new(HashMap::new())),
        p2p_started: Arc::new(Mutex::new(false)),
        port: Arc::new(Mutex::new(0)),
        commissioner: Arc::new(Mutex::new(CommissionerState::default())),
        token: generate_comm_token(),
    })
    .invoke_handler(tauri::generate_handler![
        start_p2p_services,
        p2p_list_discovered_peers,
        fix_firewall_rules,
        get_system_serial,
        get_ntp_time,
        get_local_ip,
        p2p_refresh_discovery,
        run_network_diagnostics,
        update_tray_badge,
        sync_commissioner_state,
        get_comm_token
    ])
    .setup(|app| {
        // Commissioner dashboard HTTP server — localhost:15434 only.
        // Serves the embedded HTML dashboard and a small REST API that bridges
        // to the React app via Tauri events. Bound to 127.0.0.1 so it is
        // never reachable from other machines on the network.
        let handle = app.handle();
        let comm  = app.state::<AppState>().commissioner.clone();
        // Clone the session token into the spawned thread
        let token = app.state::<AppState>().token.clone();

        std::thread::spawn(move || {
            let rt = tokio::runtime::Runtime::new().expect("comm dashboard runtime");
            rt.block_on(async {

                // GET / — serve dashboard HTML with session token injected into page JS
                let page_html = comm_dashboard_html(&token);
                let html_route = warp::get()
                    .and(warp::path::end())
                    .map(move || warp::reply::html(page_html.clone()));

                // GET /api/state — token required; silently returns error JSON if wrong
                let comm_get  = comm.clone();
                let tok_state = token.clone();
                let state_route = warp::get()
                    .and(warp::path("api"))
                    .and(warp::path("state"))
                    .and(warp::path::end())
                    .and(warp::header::optional::<String>("x-comm-token"))
                    .map(move |tok: Option<String>| {
                        if tok.as_deref() != Some(&tok_state) {
                            return warp::reply::json(&serde_json::json!({"error":"unauthorized"}));
                        }
                        let data = comm_get.lock().unwrap().clone();
                        warp::reply::json(&data)
                    });

                // POST /api/locks — token required; silently ignores unauthorized calls
                let h_locks   = handle.clone();
                let tok_locks = token.clone();
                let locks_route = warp::post()
                    .and(warp::path("api"))
                    .and(warp::path("locks"))
                    .and(warp::path::end())
                    .and(warp::header::optional::<String>("x-comm-token"))
                    .and(warp::body::json::<serde_json::Value>())
                    .map(move |tok: Option<String>, body: serde_json::Value| {
                        if tok.as_deref() == Some(&tok_locks) {
                            let _ = h_locks.emit_all("COMM_SET_LOCKS", &body);
                        }
                        warp::reply::json(&serde_json::json!({"ok": true}))
                    });

                // POST /api/trade — { offerId, action } → COMM_TRADE_ACTION (token required)
                let h_trade   = handle.clone();
                let tok_trade = token.clone();
                let trade_route = warp::post()
                    .and(warp::path("api"))
                    .and(warp::path("trade"))
                    .and(warp::path::end())
                    .and(warp::header::optional::<String>("x-comm-token"))
                    .and(warp::body::json::<serde_json::Value>())
                    .map(move |tok: Option<String>, body: serde_json::Value| {
                        if tok.as_deref() == Some(&tok_trade) {
                            let _ = h_trade.emit_all("COMM_TRADE_ACTION", &body);
                        }
                        warp::reply::json(&serde_json::json!({"ok": true}))
                    });

                // POST /api/announce — { text } → COMM_ANNOUNCE (token required)
                let h_ann   = handle.clone();
                let tok_ann = token.clone();
                let ann_route = warp::post()
                    .and(warp::path("api"))
                    .and(warp::path("announce"))
                    .and(warp::path::end())
                    .and(warp::header::optional::<String>("x-comm-token"))
                    .and(warp::body::json::<serde_json::Value>())
                    .map(move |tok: Option<String>, body: serde_json::Value| {
                        if tok.as_deref() == Some(&tok_ann) {
                            let _ = h_ann.emit_all("COMM_ANNOUNCE", &body);
                        }
                        warp::reply::json(&serde_json::json!({"ok": true}))
                    });

                // POST /api/week/advance — {} → COMM_ADVANCE_WEEK (token required)
                let h_week   = handle.clone();
                let tok_week = token.clone();
                let week_route = warp::post()
                    .and(warp::path("api"))
                    .and(warp::path("week"))
                    .and(warp::path("advance"))
                    .and(warp::path::end())
                    .and(warp::header::optional::<String>("x-comm-token"))
                    .and(warp::body::json::<serde_json::Value>())
                    .map(move |tok: Option<String>, _body: serde_json::Value| {
                        if tok.as_deref() == Some(&tok_week) {
                            let _ = h_week.emit_all("COMM_ADVANCE_WEEK", ());
                        }
                        warp::reply::json(&serde_json::json!({"ok": true}))
                    });

                let routes = html_route
                    .or(state_route)
                    .or(locks_route)
                    .or(trade_route)
                    .or(ann_route)
                    .or(week_route);

                // Bind to loopback only — never expose to the network
                let addr: SocketAddr = ([127, 0, 0, 1], 15434).into();
                println!("[CommDashboard] Listening on http://{}", addr);
                warp::serve(routes).run(addr).await;
            });
        });

        Ok(())
    })
    // Left-click on tray icon shows and focuses the main window
    .on_system_tray_event(|app, event| match event {
        SystemTrayEvent::LeftClick { .. } => {
            if let Some(w) = app.get_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        },
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            // Bring the window to front
            "show" => {
                if let Some(w) = app.get_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            },
            // Emit to the frontend — React handles state update
            "lock_all"   => { let _ = app.emit_all("TRAY_LOCK_ALL",   ()); },
            "unlock_all" => { let _ = app.emit_all("TRAY_UNLOCK_ALL", ()); },
            // Route quit through the graceful-shutdown flow (frontend logs out first)
            "quit" => { let _ = app.emit_all("CLOSE_REQUESTED", ()); },
            _ => {}
        },
        _ => {}
    })
    // Intercept the OS window-close (X button / Alt-F4 / Cmd-Q).
    // We prevent the immediate close and instead tell the frontend, which
    // flushes state and logs out before calling process::exit().
    .on_window_event(|event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
            api.prevent_close();
            let _ = event.window().emit("CLOSE_REQUESTED", ());
        }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
