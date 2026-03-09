mod scanner;

use axum::{
    routing::{get, post},
    Router, Json,
};
use serde_json::{Value, json};
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    // Build our application with routes
    let app = Router::new()
        .route("/api/health", get(health_handler))
        .route("/scan/ports", post(scan_ports_handler));

    // Run it with tokio on localhost:8080
    let listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await.unwrap();
    println!("🚀 Rust Engine listening on {}", listener.local_addr().unwrap());
    
    axum::serve(listener, app).await.unwrap();
}

async fn health_handler() -> Json<Value> {
    Json(json!({ "status": "ok", "engine": "rust-axum" }))
}

async fn scan_ports_handler(
    Json(payload): Json<scanner::ports::ScanRequest>,
) -> Json<Vec<scanner::ports::PortObj>> {
    println!("Received port scan request for: {}", payload.host);
    
    let open_ports = scanner::ports::scan_ports(&payload.host).await;
    
    Json(open_ports)
}
