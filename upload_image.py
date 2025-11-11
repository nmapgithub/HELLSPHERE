#!/usr/bin/env python3
"""
Image Upload Helper for GeoIntel
Copies an image to the uploads directory and provides the HTTP URL for SerpAPI.
"""

import shutil
import os
import sys
from pathlib import Path

def upload_image(image_path: str, uploads_dir: str = "/root/geointel/uploads", 
                public_ip: str = "localhost", http_port: int = 1339):
    """
    Copy an image to the uploads directory and return the HTTP URL.
    
    Args:
        image_path: Path to the source image file
        uploads_dir: Directory to copy the image to
        public_ip: Public IP address for HTTP access
        http_port: HTTP server port
        
    Returns:
        HTTP URL for the uploaded image
    """
    # Create uploads directory if it doesn't exist
    upload_dir = Path(uploads_dir)
    upload_dir.mkdir(exist_ok=True)
    
    # Get filename
    filename = os.path.basename(image_path)
    destination = upload_dir / filename
    
    try:
        # Copy the image to uploads directory
        shutil.copy2(image_path, destination)
        print(f"Image copied to: {destination}")
        
        # Generate HTTP URL
        http_url = f"http://{public_ip}:{http_port}/{filename}"
        print(f"HTTP URL for SerpAPI: {http_url}")
        
        return http_url
        
    except FileNotFoundError:
        print(f"Error: Image file not found: {image_path}")
        return None
    except PermissionError:
        print(f"Error: Permission denied when copying image")
        return None
    except Exception as e:
        print(f"Error copying image: {e}")
        return None

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Upload image for GeoIntel processing")
    parser.add_argument("image_path", help="Path to the image file to upload")
    parser.add_argument("--uploads-dir", default="/root/geointel/uploads", 
                       help="Uploads directory (default: /root/geointel/uploads)")
    parser.add_argument("--public-ip", default="localhost", 
                       help="Public IP address (default: localhost)")
    parser.add_argument("--http-port", type=int, default=1339, 
                       help="HTTP server port (default: 1339)")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.image_path):
        print(f"Error: Image file does not exist: {args.image_path}")
        sys.exit(1)
    
    http_url = upload_image(args.image_path, args.uploads_dir, args.public_ip, args.http_port)
    
    if http_url:
        print(f"\nImage is now accessible at: {http_url}")
        print("You can now use this URL with GeoIntel for SerpAPI processing.")
    else:
        sys.exit(1)
