
use std::process::Command;
use serde::Serialize;
use tauri;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NetworkTestResult {
    pub gateway_ping: bool,
    pub dns_ping: bool,
    pub internet_ping: bool,
    pub gateway_latency: Option<u64>,
    pub details: Vec<String>,
}

#[tauri::command]
pub async fn run_network_diagnostics() -> Result<NetworkTestResult, String> {
    let mut details = Vec::new();
    let mut gateway_ping = false;
    let mut gateway_latency = None;
    let mut dns_ping = false;
    let mut internet_ping = false;

    fn get_default_gateway() -> Option<String> {
        #[cfg(target_os = "windows")]
        {
             let output = Command::new("powershell")
                .args(&["-Command", "(Get-NetRoute -DestinationPrefix 0.0.0.0/0).NextHop"])
                .output().ok()?;
             let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
             if !s.is_empty() { return Some(s); }
        }
        None
    }

    fn ping(target: &str) -> (bool, Option<u64>) {
        #[cfg(target_os = "windows")]
        {
            // -n 1 = 1 count, -w 2000 = 2000ms timeout
            let output = Command::new("ping").args(&["-n", "1", "-w", "2000", target]).output();
            if let Ok(o) = output {
                if o.status.success() {
                    let s = String::from_utf8_lossy(&o.stdout);
                    if s.contains("Reply from") {
                         // Extract time (lazy parse)
                         // "time=14ms"
                         if let Some(pos) = s.find("time=") {
                             let remainder = &s[pos+5..];
                             if let Some(end) = remainder.find("ms") {
                                 let ms_str = &remainder[..end];
                                 return (true, ms_str.parse::<u64>().ok());
                             }
                         }
                        return (true, Some(1));
                    }
                }
            }
        }
        (false, None)
    }

    // 1. Gateway
    if let Some(gw) = get_default_gateway() {
        details.push(format!("Gateway identified as: {}", gw));
        let (success, lat) = ping(&gw);
        gateway_ping = success;
        gateway_latency = lat;
        details.push(format!("Ping Gateway ({}): {} (Lat: {:?})", gw, if success { "PASS" } else { "FAIL" }, lat));
    } else {
        details.push("Could not determine Default Gateway".to_string());
    }

    // 2. DNS (8.8.8.8)
    let (success_dns, _) = ping("8.8.8.8");
    dns_ping = success_dns;
    details.push(format!("Ping DNS (8.8.8.8): {}", if success_dns { "PASS" } else { "FAIL" }));

    // 3. Internet (google.com)
    let (success_net, _) = ping("google.com");
    internet_ping = success_net;
    details.push(format!("Ping Internet (google.com): {}", if success_net { "PASS" } else { "FAIL" }));
    
    Ok(NetworkTestResult {
        gateway_ping,
        dns_ping,
        internet_ping,
        gateway_latency,
        details
    })
}
