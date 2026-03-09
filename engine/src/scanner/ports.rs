use serde::{Deserialize, Serialize};
use std::net::{SocketAddr, TcpStream};
use std::time::Duration;
use tokio::task;

#[derive(Serialize, Deserialize, Clone)]
pub struct PortObj {
    pub port: u16,
    pub name: String,
}

#[derive(Deserialize)]
pub struct ScanRequest {
    pub host: String,
}

pub async fn scan_ports(host: &str) -> Vec<PortObj> {
    let common_ports = vec![
        PortObj { port: 20, name: "FTP".to_string() },
        PortObj { port: 21, name: "FTP".to_string() },
        PortObj { port: 22, name: "SSH".to_string() },
        PortObj { port: 23, name: "Telnet".to_string() },
        PortObj { port: 80, name: "HTTP".to_string() },
        PortObj { port: 443, name: "HTTPS".to_string() },
        PortObj { port: 8080, name: "HTTP Alt".to_string() },
        PortObj { port: 8443, name: "HTTPS Alt".to_string() },
        PortObj { port: 1433, name: "MS SQL".to_string() },
        PortObj { port: 3306, name: "MySQL".to_string() },
        PortObj { port: 5432, name: "PostgreSQL".to_string() },
        PortObj { port: 6379, name: "Redis".to_string() },
        PortObj { port: 27017, name: "MongoDB".to_string() },
    ];

    let mut handles = vec![];
    let host_string = host.to_string();

    for port_obj in common_ports {
        let host_clone = host_string.clone();
        
        let handle = task::spawn_blocking(move || {
            let target = format!("{}:{}", host_clone, port_obj.port);
            let addr: Result<SocketAddr, _> = target.parse();
            
            if let Ok(socket_addr) = addr {
                 // Try to connect with a 1.5 second timeout
                 match TcpStream::connect_timeout(&socket_addr, Duration::from_millis(1500)) {
                    Ok(_) => Some(port_obj),
                    Err(_) => None,
                 }
            } else {
                 // Fallback for DNS resolution using normal connect since parse() requires IPs
                 match std::net::TcpStream::connect(&target) {
                     Ok(stream) => {
                         // Successfully connected via DNS resolution, apply timeout to streams immediately just in case
                         let _ = stream.set_read_timeout(Some(Duration::from_millis(1500)));
                         Some(port_obj)
                     },
                     Err(_) => None
                 }
            }
        });
        handles.push(handle);
    }

    let mut open_ports = vec![];

    for handle in handles {
        if let Ok(Some(port)) = handle.await {
            open_ports.push(port);
        }
    }

    // Sort by port number
    open_ports.sort_by(|a, b| a.port.cmp(&b.port));
    open_ports
}
