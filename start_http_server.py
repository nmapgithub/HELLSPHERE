#!/usr/bin/env python3
"""
HTTP Server for GeoIntel Image Access
Starts an HTTP server on port 1339 to serve uploaded images for SerpAPI access.
"""

import http.server
import socketserver
import os
import sys
from pathlib import Path

def start_http_server(port=1339, directory="/root/geointel/uploads"):
    """
    Start HTTP server to serve images for SerpAPI access.
    
    Args:
        port: Port number for HTTP server (default: 1339)
        directory: Directory to serve files from (default: /root/geointel/uploads)
    """
    # Create uploads directory if it doesn't exist
    upload_dir = Path(directory)
    upload_dir.mkdir(exist_ok=True)
    
    # Change to the uploads directory
    os.chdir(directory)
    
    # Create custom handler to serve files
    class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            # Add CORS headers to allow cross-origin requests
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            super().end_headers()
    
    try:
        with socketserver.TCPServer(("", port), CustomHTTPRequestHandler) as httpd:
            print(f"HTTP Server started on port {port}")
            print(f"Serving files from: {directory}")
            print(f"Access images at: http://localhost:{port}/filename")
            print("Press Ctrl+C to stop the server")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"Error: Port {port} is already in use.")
            print("Please stop the existing server or use a different port.")
        else:
            print(f"Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Start HTTP server for GeoIntel image access")
    parser.add_argument("--port", type=int, default=1339, help="Port number (default: 1339)")
    parser.add_argument("--directory", type=str, default="/root/geointel/uploads", 
                       help="Directory to serve files from (default: /root/geointel/uploads)")
    
    args = parser.parse_args()
    start_http_server(args.port, args.directory)
