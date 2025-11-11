import streamlit as st
import os
import tempfile
import threading
import time
import requests
from pathlib import Path
import json
from geointel import GeoIntel
import configparser
import socket

# Configure Streamlit page
st.set_page_config(
    page_title="GeoIntel - Image Geolocation Analysis",
    page_icon="🌍",
    layout="wide"
)

# Global variables for HTTP server
http_server = None
server_thread = None
server_port = 1339  # Use port 1339 for SerpAPI
public_url = None

# Configuration file path
CONFIG_FILE = "api_config.ini"

def load_api_keys():
    """Load API keys from configuration file"""
    config = configparser.ConfigParser()
    if os.path.exists(CONFIG_FILE):
        config.read(CONFIG_FILE)
        return {
            'gemini_key': config.get('API_KEYS', 'gemini_key', fallback=''),
            'serpapi_key': config.get('API_KEYS', 'serpapi_key', fallback=''),
            'imgur_client_id': config.get('API_KEYS', 'imgur_client_id', fallback='')
        }
    return {'gemini_key': '', 'serpapi_key': '', 'imgur_client_id': ''}

def save_api_keys(gemini_key, serpapi_key, imgur_client_id):
    """Save API keys to configuration file"""
    config = configparser.ConfigParser()
    config['API_KEYS'] = {
        'gemini_key': gemini_key,
        'serpapi_key': serpapi_key,
        'imgur_client_id': imgur_client_id
    }
    with open(CONFIG_FILE, 'w') as configfile:
        config.write(configfile)

def get_public_ip():
    """Get the public IP address of the server"""
    try:
        # Try to get public IP from external service
        response = requests.get('https://api.ipify.org', timeout=5)
        return response.text.strip()
    except:
        try:
            # Fallback to another service
            response = requests.get('https://ipinfo.io/ip', timeout=5)
            return response.text.strip()
        except:
            return "localhost"

def start_http_server():
    """Start a simple HTTP server to serve uploaded images"""
    global http_server, server_thread, public_url
    
    if http_server is None:
        import http.server
        import socketserver
        
        # Create uploads directory if it doesn't exist
        uploads_dir = Path("/root/geointel/uploads")
        uploads_dir.mkdir(exist_ok=True)
        
        class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                # Set the directory to serve from
                super().__init__(*args, directory=str(uploads_dir.absolute()), **kwargs)
            
            def end_headers(self):
                # Add CORS headers
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type')
                super().end_headers()
        
        try:
            # Bind to all interfaces (0.0.0.0) to make it accessible from outside
            http_server = socketserver.TCPServer(("0.0.0.0", server_port), CustomHTTPRequestHandler)
            server_thread = threading.Thread(target=http_server.serve_forever, daemon=True)
            server_thread.start()
            
            # Get public IP for the URL
            public_ip = get_public_ip()
            public_url = f"http://{public_ip}:{server_port}"
            
            st.success(f"HTTP server started on port {server_port}")
            st.info(f"Public URL: {public_url}")
        except Exception as e:
            st.error(f"Failed to start HTTP server: {e}")

def stop_http_server():
    """Stop the HTTP server"""
    global http_server
    if http_server:
        http_server.shutdown()
        http_server = None

def save_uploaded_file(uploaded_file):
    """Save uploaded file to uploads directory and return the file path"""
    try:
        # Create uploads directory if it doesn't exist
        uploads_dir = Path("/root/geointel/uploads")
        uploads_dir.mkdir(exist_ok=True)
        
        # Save file
        file_path = uploads_dir / uploaded_file.name
        with open(file_path, "wb") as f:
            f.write(uploaded_file.getbuffer())
        
        return str(file_path)
    except Exception as e:
        st.error(f"Error saving file: {e}")
        return None

def get_image_url(file_path):
    """Convert local file path to HTTP URL"""
    global public_url
    filename = Path(file_path).name
    
    if public_url:
        return f"{public_url}/{filename}"
    else:
        # Fallback to localhost if public URL not available
        return f"http://localhost:{server_port}/{filename}"

def main():
    st.title("🌍 GeoIntel - Image Geolocation Analysis")
    st.markdown("Upload an image to analyze its geographical location using AI and web search.")
    
    # Initialize GeoIntel
    geointel = GeoIntel()
    
    # Load saved API keys
    saved_keys = load_api_keys()
    
    # Sidebar for configuration
    with st.sidebar:
        st.header("Configuration")
        
        # API Keys with saved values
        gemini_key = st.text_input(
            "Gemini API Key", 
            value=saved_keys['gemini_key'] or os.environ.get("GEMINI_API_KEY", ""),
            type="password",
            help="Your Google Gemini API key"
        )
        
        serpapi_key = st.text_input(
            "SerpAPI Key", 
            value=saved_keys['serpapi_key'] or os.environ.get("SERPAPI_KEY", "ffdc1a91340395fc2b40cc14735e27e5d226474da8c1f7f50c00d181522b377d"),
            type="password",
            help="Your SerpAPI key for Google search (default key provided for testing)"
        )
        
        imgur_client_id = st.text_input(
            "Imgur Client ID", 
            value=saved_keys['imgur_client_id'] or os.environ.get("IMGUR_CLIENT_ID", ""),
            type="password",
            help="Your Imgur client ID for image hosting"
        )
        
        # Save keys button
        if st.button("💾 Save API Keys", type="secondary"):
            save_api_keys(gemini_key, serpapi_key, imgur_client_id)
            st.success("API keys saved successfully!")
            st.rerun()
        
        # Clear keys button
        if st.button("🗑️ Clear Saved Keys", type="secondary"):
            save_api_keys("", "", "")
            st.success("Saved API keys cleared!")
            st.rerun()
        
        # Update environment variables
        if gemini_key:
            os.environ["GEMINI_API_KEY"] = gemini_key
        if serpapi_key:
            os.environ["SERPAPI_KEY"] = serpapi_key
        if imgur_client_id:
            os.environ["IMGUR_CLIENT_ID"] = imgur_client_id
    
    # Main content area
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.header("📸 Upload Image")
        
        # File uploader
        uploaded_file = st.file_uploader(
            "Choose an image file",
            type=['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'],
            help="Upload an image to analyze its location"
        )
        
        if uploaded_file is not None:
            # Display uploaded image
            st.image(uploaded_file, caption="Uploaded Image", use_container_width=True)
            
            # Save file
            with st.spinner("Processing image..."):
                file_path = save_uploaded_file(uploaded_file)
                if file_path:
                    st.success(f"Image saved successfully!")
    
    with col2:
        st.header("🔍 Analysis Options")
        
        # Analysis parameters
        context_info = st.text_area(
            "Additional Context (Optional)",
            placeholder="Any additional information about the image, time taken, etc.",
            height=100
        )
        
        location_guess = st.text_input(
            "Location Guess (Optional)",
            placeholder="Your guess of where this image was taken"
        )
        
        # Analysis options
        st.write("**Search Options:**")
        use_serpapi = st.checkbox("🔎 Use SerpAPI (Google Reverse Image Search)", value=True, help="Enable Google reverse image search for additional context")
        use_imgur = st.checkbox("📤 Use Imgur for image hosting", value=False, help="Upload image to Imgur instead of using local HTTP server")
        
        # Analyze button
        if st.button("🚀 Analyze Location", type="primary"):
            if uploaded_file is None:
                st.error("Please upload an image first!")
                return
            
            if not gemini_key:
                st.error("Please provide a Gemini API key!")
                return
            
            if use_serpapi and not serpapi_key:
                st.warning("SerpAPI key not provided. Analysis will continue without web search context.")
                use_serpapi = False
            elif use_serpapi and serpapi_key:
                st.success("✅ SerpAPI will be used for additional context")
            
            if use_imgur and not imgur_client_id:
                st.warning("Imgur Client ID not provided. Will use local HTTP server instead.")
                use_imgur = False
            
            # Check if HTTP server is available for SerpAPI
            if use_serpapi:
                # Use fixed public IP
                public_ip = "31.97.227.80"
                image_url = f"http://{public_ip}:2001/{uploaded_file.name}"
                st.info(f"Image accessible at: {image_url}")
                st.info("🔗 SerpAPI can now access this public URL for reverse image search")
                
                # Check if HTTP server is actually running (use localhost for faster check)
                try:
                    import requests
                    import socket
                    
                    # Quick socket check first
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(2)
                    result = sock.connect_ex(('127.0.0.1', 2001))
                    sock.close()
                    
                    if result == 0:
                        st.success("✅ HTTP server is running on port 2001")
                    else:
                        st.warning("⚠️ HTTP server may not be running on port 2001")
                        
                except Exception as e:
                    st.info(f"ℹ️ Could not verify HTTP server status (this is OK if it's running)")
            
            # Perform analysis
            with st.spinner("Analyzing image location..."):
                try:
                    # Determine which image path to use
                    if use_imgur:
                        # Use local file path for Imgur upload
                        analysis_result = geointel.locate(
                            image_path=file_path,
                            context_info=context_info if context_info else None,
                            location_guess=location_guess if location_guess else None,
                            serpapi_key=serpapi_key if use_serpapi else None,
                            public_ip="31.97.227.80",
                            http_port=2001
                        )
                    elif use_serpapi:
                        # Use HTTP URL for SerpAPI access
                        analysis_result = geointel.locate(
                            image_path=file_path,  # Use local file path
                            context_info=context_info if context_info else None,
                            location_guess=location_guess if location_guess else None,
                            serpapi_key=serpapi_key,
                            public_ip="31.97.227.80",
                            http_port=2001
                        )
                    else:
                        # Use local file path directly for Gemini only
                        analysis_result = geointel.locate(
                            image_path=file_path,
                            context_info=context_info if context_info else None,
                            location_guess=location_guess if location_guess else None,
                            serpapi_key=None,
                            public_ip="31.97.227.80",
                            http_port=2001
                        )
                    
                    # Display results
                    display_results(analysis_result)
                    
                except Exception as e:
                    st.error(f"Analysis failed: {str(e)}")
                    st.exception(e)

def display_results(result):
    """Display the analysis results in a formatted way"""
    st.header("🎯 Analysis Results")
    
    if "error" in result:
        st.error(f"❌ Error: {result['error']}")
        if "details" in result:
            st.error(f"Details: {result['details']}")
        return
    
    # Display EXIF data if available
    if "exif_data" in result:
        st.subheader("📷 EXIF Data")
        exif = result["exif_data"]
        
        # Show message if no EXIF data found
        if not exif["has_exif"]:
            st.info("ℹ️ No EXIF metadata found in this image")
            st.caption("This image may have been processed/edited, or the metadata was stripped")
            st.divider()
        else:
            # GPS Data - highlight if present (show first)
            if exif["has_gps"] and exif["gps_coordinates"]:
                with st.expander("📍 GPS Coordinates Found!", expanded=True):
                    st.success("✅ **GPS Location Data Available in Image!**")
                    gps = exif["gps_coordinates"]
                    
                    col1, col2 = st.columns(2)
                    with col1:
                        st.metric("Latitude", gps['latitude'])
                    with col2:
                        st.metric("Longitude", gps['longitude'])
                    
                    st.markdown(f"### [🗺️ View on Google Maps]({gps['google_maps_url']})")
            
            # Camera Information
            with st.expander("📸 Camera Information", expanded=False):
                col1, col2 = st.columns(2)
                
                with col1:
                    if exif.get("camera_make"):
                        st.write(f"**Camera Make:** {exif['camera_make']}")
                    if exif.get("camera_model"):
                        st.write(f"**Camera Model:** {exif['camera_model']}")
                    if exif.get("datetime"):
                        st.write(f"**Date/Time:** {exif['datetime']}")
                
                with col2:
                    if exif.get("software"):
                        st.write(f"**Software:** {exif['software']}")
                    if exif.get("orientation"):
                        st.write(f"**Orientation:** {exif['orientation']}")
            
            # All EXIF Tags
            if exif.get("all_tags") and len(exif["all_tags"]) > 0:
                with st.expander(f"🔍 All EXIF Tags ({len(exif['all_tags'])} tags found)", expanded=False):
                    # Organize tags by category
                    image_tags = {}
                    exif_tags = {}
                    gps_tags = {}
                    other_tags = {}
                    
                    for tag, value in exif["all_tags"].items():
                        if tag.startswith("Image "):
                            image_tags[tag] = value
                        elif tag.startswith("EXIF "):
                            exif_tags[tag] = value
                        elif tag.startswith("GPS "):
                            gps_tags[tag] = value
                        else:
                            other_tags[tag] = value
                    
                    # Display by category
                    if image_tags:
                        st.write("**📷 Image Information:**")
                        for tag, value in sorted(image_tags.items()):
                            st.text(f"{tag}: {value}")
                        st.divider()
                    
                    if exif_tags:
                        st.write("**📊 EXIF Technical Data:**")
                        for tag, value in sorted(exif_tags.items()):
                            st.text(f"{tag}: {value}")
                        st.divider()
                    
                    if gps_tags:
                        st.write("**📍 GPS Data:**")
                        for tag, value in sorted(gps_tags.items()):
                            st.text(f"{tag}: {value}")
                        st.divider()
                    
                    if other_tags:
                        st.write("**🔧 Other Tags:**")
                        for tag, value in sorted(other_tags.items()):
                            st.text(f"{tag}: {value}")
            else:
                st.info("ℹ️ No additional EXIF data found in this image")
            
            st.divider()
    
    # Display SerpAPI results if available
    if "serpapi_results" in result:
        if result["serpapi_results"]["has_results"]:
            serpapi_context = result["serpapi_results"]["context"]
            
            # Check if it's an error message
            if serpapi_context and "SerpAPI Error:" in serpapi_context:
                st.subheader("🔍 SerpAPI Search Results")
                st.warning("⚠️ Google Reverse Image Search found no matches for this image")
                with st.expander("Why no results?", expanded=False):
                    st.info("""
                    **Possible reasons:**
                    - This image is unique or not indexed by Google
                    - The image has been heavily edited or cropped
                    - The image is very new and hasn't been crawled yet
                    - The image comes from a private or restricted source
                    - The image quality is too low or too high
                    
                    **This is normal!** Not all images will have matches in Google's database.
                    The AI analysis will still work using visual features.
                    """)
                    st.text_area("SerpAPI Response", serpapi_context, height=100, disabled=True)
                st.divider()
            else:
                st.subheader("🔍 SerpAPI Search Results")
                with st.expander("View SerpAPI Context", expanded=True):
                    if serpapi_context:
                        # Parse and display structured SerpAPI results
                        lines = serpapi_context.split('\n')
                        for line in lines:
                            if line.strip():
                                if line.startswith("Suggested search:"):
                                    st.write(f"🔍 **{line}**")
                                elif line.startswith("Best guess:"):
                                    st.write(f"🎯 **{line}**")
                                elif line.startswith("Found") and "similar images" in line:
                                    st.write(f"🖼️ **{line}**")
                                elif line.startswith("Similar image"):
                                    st.write(f"🖼️ {line}")
                                elif line.startswith("Result "):
                                    st.write(f"🖼️ **{line}**")
                                elif line.startswith("  Source:"):
                                    st.write(f"🔗 {line}")
                                elif line.startswith("  URL:"):
                                    st.write(f"🔗 {line}")
                                elif line.startswith("Google found no matching results"):
                                    st.warning(f"⚠️ {line}")
                                elif line.startswith("Google identified as:"):
                                    st.success(f"🎯 {line}")
                                elif line.startswith("Total results found:"):
                                    st.info(f"📊 {line}")
                                elif line.startswith("Search state:"):
                                    st.info(f"ℹ️ {line}")
                                elif line.startswith("Snippet:"):
                                    st.write(f"📄 {line}")
                                elif line.startswith("No search results found"):
                                    st.warning(f"⚠️ {line}")
                                elif line.startswith("This could mean"):
                                    st.info(f"ℹ️ {line}")
                                else:
                                    st.write(f"ℹ️ {line}")
                    
                        # Also show raw context in a collapsible section
                        with st.expander("Raw SerpAPI Context"):
                            st.text_area("Raw Context", serpapi_context, height=150, disabled=True)
                    else:
                        st.info("No SerpAPI context available")
                st.divider()
        else:
            st.info("ℹ️ SerpAPI was not used for this analysis")
            st.divider()
    
    # Display interpretation
    if "interpretation" in result:
        st.subheader("📋 Image Analysis")
        st.write(result["interpretation"])
    
    # Display locations
    if "locations" in result and result["locations"]:
        st.subheader("📍 Possible Locations")
        
        for i, location in enumerate(result["locations"], 1):
            with st.expander(f"Location {i} - {location.get('city', 'Unknown')}, {location.get('country', 'Unknown')}"):
                col1, col2 = st.columns([2, 1])
                
                with col1:
                    st.write(f"**Country:** {location.get('country', 'N/A')}")
                    st.write(f"**State/Region:** {location.get('state', 'N/A')}")
                    st.write(f"**City:** {location.get('city', 'N/A')}")
                    st.write(f"**Confidence:** {location.get('confidence', 'N/A')}")
                    
                    if 'coordinates' in location and location['coordinates']:
                        coords = location['coordinates']
                        st.write(f"**Coordinates:** {coords.get('latitude', 'N/A')}, {coords.get('longitude', 'N/A')}")
                
                with col2:
                    # Confidence indicator
                    confidence = location.get('confidence', 'Medium')
                    if confidence == 'High':
                        st.success("🟢 High Confidence")
                    elif confidence == 'Medium':
                        st.warning("🟡 Medium Confidence")
                    else:
                        st.error("🔴 Low Confidence")
                
                # Explanation
                if 'explanation' in location:
                    st.write("**Reasoning:**")
                    st.write(location['explanation'])
                
                # Map link (if coordinates available)
                if 'coordinates' in location and location['coordinates']:
                    coords = location['coordinates']
                    if coords.get('latitude') and coords.get('longitude'):
                        lat, lon = coords['latitude'], coords['longitude']
                        map_url = f"https://www.google.com/maps?q={lat},{lon}"
                        st.markdown(f"[🗺️ View on Google Maps]({map_url})")
    else:
        st.warning("No location information found in the analysis.")

if __name__ == "__main__":
    try:
        main()
    finally:
        # Clean up HTTP server on exit
        stop_http_server()
