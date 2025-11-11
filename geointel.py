import json
import requests
import base64
import os
from typing import Dict, Any, Optional, List, Union
from urllib.parse import urlparse
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import exifread

class GeoIntel:
    def __init__(self, api_key: Optional[str] = None):
        self.gemini_api_key = api_key or os.environ.get("GEMINI_API_KEY", "AIzaSyBvpTt2LjN8Z1KfMbYPn8x_UE6YOmBBhz8")
        self.gemini_api_url = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite-001:generateContent"
    
    def extract_exif_data(self, image_path: str) -> Dict[str, Any]:
        """
        Extract ALL EXIF data from an image, including GPS coordinates if available.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            Dictionary containing all EXIF data including GPS coordinates
        """
        exif_data = {
            "has_exif": False,
            "has_gps": False,
            "gps_coordinates": None,
            "camera_make": None,
            "camera_model": None,
            "datetime": None,
            "software": None,
            "orientation": None,
            "all_tags": {}  # Store all EXIF tags
        }
        
        try:
            # Open image and extract EXIF
            with open(image_path, 'rb') as f:
                tags = exifread.process_file(f, details=False)
            
            if tags:
                exif_data["has_exif"] = True
                
                # Store ALL tags
                for tag, value in tags.items():
                    # Skip thumbnail data (too large)
                    if 'thumbnail' not in tag.lower() and 'makernote' not in tag.lower():
                        exif_data["all_tags"][tag] = str(value)
                
                # Extract common camera info
                if 'Image Make' in tags:
                    exif_data["camera_make"] = str(tags['Image Make'])
                if 'Image Model' in tags:
                    exif_data["camera_model"] = str(tags['Image Model'])
                if 'Image DateTime' in tags:
                    exif_data["datetime"] = str(tags['Image DateTime'])
                if 'Image Software' in tags:
                    exif_data["software"] = str(tags['Image Software'])
                if 'Image Orientation' in tags:
                    exif_data["orientation"] = str(tags['Image Orientation'])
                
                # Extract GPS data
                gps_lat = tags.get('GPS GPSLatitude')
                gps_lat_ref = tags.get('GPS GPSLatitudeRef')
                gps_lon = tags.get('GPS GPSLongitude')
                gps_lon_ref = tags.get('GPS GPSLongitudeRef')
                
                if all([gps_lat, gps_lat_ref, gps_lon, gps_lon_ref]):
                    exif_data["has_gps"] = True
                    
                    # Convert GPS coordinates to decimal
                    def convert_to_degrees(value):
                        try:
                            d, m, s = value.values
                            # Check for zero denominators
                            d_val = float(d.num) / float(d.den) if d.den != 0 else 0
                            m_val = (float(m.num) / float(m.den)) / 60.0 if m.den != 0 else 0
                            s_val = (float(s.num) / float(s.den)) / 3600.0 if s.den != 0 else 0
                            return d_val + m_val + s_val
                        except (AttributeError, ZeroDivisionError, ValueError) as e:
                            print(f"⚠️ Error converting GPS coordinate: {e}")
                            return None
                    
                    try:
                        lat = convert_to_degrees(gps_lat)
                        lon = convert_to_degrees(gps_lon)
                        
                        if lat is not None and lon is not None:
                            if str(gps_lat_ref) == 'S':
                                lat = -lat
                            
                            if str(gps_lon_ref) == 'W':
                                lon = -lon
                            
                            exif_data["gps_coordinates"] = {
                                "latitude": round(lat, 6),
                                "longitude": round(lon, 6),
                                "google_maps_url": f"https://www.google.com/maps?q={lat},{lon}"
                            }
                            
                            print(f"✅ Found GPS coordinates in EXIF: {lat}, {lon}")
                        else:
                            exif_data["has_gps"] = False
                            print("⚠️ GPS coordinates invalid (division by zero)")
                    except Exception as e:
                        exif_data["has_gps"] = False
                        print(f"⚠️ Error processing GPS coordinates: {e}")
                else:
                    print("ℹ️ No GPS data found in EXIF")
                    
        except Exception as e:
            print(f"⚠️ Error extracting EXIF data: {e}")
        
        return exif_data
        
    def encode_image_to_base64(self, image_path: str) -> str:
        """
        Convert an image file to base64 encoding.
        Supports both local files and URLs.
        
        Args:
            image_path: Path to the image file or URL
            
        Returns:
            Base64 encoded string of the image
            
        Raises:
            ValueError: If the image cannot be loaded or the URL is invalid
            FileNotFoundError: If the local image file doesn't exist
        """
        # Check if the image_path is a URL
        parsed_url = urlparse(image_path)
        if parsed_url.scheme in ('http', 'https'):
            try:
                response = requests.get(image_path, timeout=10)
                response.raise_for_status()  # Raise an exception for HTTP errors
                return base64.b64encode(response.content).decode('utf-8')
            except requests.exceptions.ConnectionError:
                raise ValueError(f"Failed to connect to URL: {image_path}. Please check your internet connection.")
            except requests.exceptions.HTTPError as e:
                raise ValueError(f"HTTP error when downloading image: {e}")
            except requests.exceptions.Timeout:
                raise ValueError(f"Request timed out when downloading image from URL: {image_path}")
            except requests.exceptions.RequestException as e:
                raise ValueError(f"Failed to download image from URL: {e}")
        else:
            # Assume it's a local file path
            try:
                with open(image_path, "rb") as image_file:
                    return base64.b64encode(image_file.read()).decode('utf-8')
            except FileNotFoundError:
                raise FileNotFoundError(f"Image file not found: {image_path}")
            except PermissionError:
                raise ValueError(f"Permission denied when accessing image file: {image_path}")
            except Exception as e:
                raise ValueError(f"Failed to read image file: {str(e)}")
    
    def locate_with_gemini(self, 
                          image_path: str, 
                          context_info: Optional[str] = None, 
                          location_guess: Optional[str] = None) -> Dict[str, Any]:
        """
        Use Gemini API to analyze and geolocate an image with higher accuracy.
        
        Args:
            image_path: Path to the image file or URL
            context_info: Optional additional context about the image
            location_guess: Optional user's guess of the location
            
        Returns:
            Dictionary containing the analysis and location information with structure:
            {
                "interpretation": str,  # Analysis of the image
                "locations": [          # List of possible locations
                    {
                        "country": str,
                        "state": str,
                        "city": str,
                        "confidence": "High"/"Medium"/"Low",
                        "coordinates": {
                            "latitude": float,
                            "longitude": float
                        },
                        "explanation": str
                    }
                ]
            }
            
            On error, returns:
            {
                "error": str,           # Error message
                "details": str,         # Optional details about the error
                "exception": str        # Optional exception information
            }
        """
        # Convert image to base64
        try:
            image_base64 = self.encode_image_to_base64(image_path)
        except Exception as e:
            return {"error": f"Failed to process image: {str(e)}"}
        
        # Build the prompt
        prompt_text = """You are a professional geolocation expert. You MUST respond with a valid JSON object in the following format:

{
  "interpretation": "A comprehensive analysis of the image, including:
    - Architectural style and period
    - Notable landmarks or distinctive features
    - Natural environment and climate indicators
    - Cultural elements (signage, vehicles, clothing, etc.)
    - Any visible text or language
    - Time period indicators (if any)",
  "locations": [
    {
      "country": "Primary country name",
      "state": "State/region/province name",
      "city": "City name",
      "confidence": "High/Medium/Low",
      "coordinates": {
        "latitude": 12.3456,
        "longitude": 78.9012
      },
      "explanation": "Detailed reasoning for this location identification, including:
        - Specific architectural features that match this location
        - Environmental characteristics that support this location
        - Cultural elements that indicate this region
        - Any distinctive landmarks or features
        - Supporting evidence from visible text or signage"
    }
  ]
}

IMPORTANT: 
1. Your response MUST be a valid JSON object. Do not include any text before or after the JSON object.
2. Do not include any markdown formatting or code blocks.
3. The response should be parseable by JSON.parse().
4. You can provide up to three possible locations if you are not completely confident about a single location.
5. Order the locations by confidence level (highest to lowest).
6. ALWAYS include approximate coordinates (latitude and longitude) for each location when possible.

Consider these key aspects for accurate location identification:
1. Architectural Analysis:
   - Building styles and materials
   - Roof types and construction methods
   - Window and door designs
   - Decorative elements and ornamentation

2. Environmental Indicators:
   - Vegetation types and patterns
   - Climate indicators (snow, desert, tropical, etc.)
   - Terrain and topography
   - Water bodies or coastal features

3. Cultural Context:
   - Language of visible text
   - Vehicle types and styles
   - Clothing and fashion
   - Street furniture and infrastructure
   - Commercial signage and branding

4. Time Period Indicators:
   - Architectural period
   - Vehicle models
   - Fashion styles
   - Technology visible"""

        # Add additional context if provided
        if context_info:
            prompt_text += f"\n\nAdditional context provided by the user:\n{context_info}"
        
        # Add location guess if provided
        if location_guess:
            prompt_text += f"\n\nUser suggests this might be in: {location_guess}"
        
        prompt_text += "\n\nRemember: Your response must be a valid JSON object only. No additional text or formatting."
        
        # Prepare the request body
        request_body = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt_text
                        },
                        {
                            "inline_data": {
                                "mime_type": "image/jpeg",
                                "data": image_base64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.4,
                "topK": 32,
                "topP": 1,
                "maxOutputTokens": 2048
            }
        }
        
        # Make the API request
        headers = {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.6",
            "content-type": "application/json",
            "priority": "u=1, i",
            "sec-ch-ua": "\"Brave\";v=\"137\", \"Chromium\";v=\"137\", \"Not/A)Brand\";v=\"24\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            "sec-gpc": "1",
            "Referer": "https://googleapis.com/",
            "Referrer-Policy": "strict-origin-when-cross-origin"
        }
        
        try:
            response = requests.post(
                f"{self.gemini_api_url}?key={self.gemini_api_key}",
                headers=headers,
                json=request_body
            )
            
            if response.status_code != 200:
                print(f"Error: API request failed with status code {response.status_code}")
                print(f"Response: {response.text}")
                return {"error": "Failed to get response from Gemini API", "details": response.text}
            
            data = response.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            
            # Strip any markdown formatting and code blocks
            json_string = raw_text.replace("```json", "").replace("```", "").strip()
            
            try:
                parsed_result = json.loads(json_string)
                
                # Handle potential single location format where the location is not in an array
                if "city" in parsed_result and "locations" not in parsed_result:
                    return {
                        "interpretation": parsed_result.get("interpretation", ""),
                        "locations": [{
                            "country": parsed_result.get("country", ""),
                            "state": parsed_result.get("state", ""),
                            "city": parsed_result.get("city", ""),
                            "confidence": parsed_result.get("confidence", "Medium"),
                            "coordinates": parsed_result.get("coordinates", {"latitude": 0, "longitude": 0}),
                            "explanation": parsed_result.get("explanation", "")
                        }]
                    }
                
                return parsed_result
                
            except json.JSONDecodeError as e:
                return {
                    "error": "Failed to parse API response",
                    "rawResponse": raw_text,
                    "exception": str(e)
                }
        except Exception as e:
            return {
                "error": "Failed to communicate with Gemini API",
                "exception": str(e)
            }
    
    def upload_image_to_imgur(self, image_path: str) -> Optional[str]:
        """
        Uploads a local image to Imgur and returns the public URL.
        Requires a free Imgur client ID (can be set as IMGUR_CLIENT_ID env variable).
        """
        client_id = os.environ.get("IMGUR_CLIENT_ID", None)
        if not client_id:
            raise ValueError("IMGUR_CLIENT_ID environment variable not set. Get a free client ID from https://api.imgur.com/oauth2/addclient.")
        headers = {"Authorization": f"Client-ID {client_id}"}
        try:
            with open(image_path, "rb") as img_file:
                response = requests.post(
                    "https://api.imgur.com/3/image",
                    headers=headers,
                    files={"image": img_file}
                )
            response.raise_for_status()
            data = response.json()
            return data["data"]["link"] if "data" in data and "link" in data["data"] else None
        except Exception as e:
            print(f"Imgur upload failed: {e}")
            return None

    def search_image_with_serpapi(self, image_path: str, serpapi_key: str, public_ip: str = "31.97.227.80", http_port: int = 2001) -> Optional[str]:
        """
        Use SerpAPI to perform a Google reverse image search and return a summary of results.
        Args:
            image_path: Path to the image file or URL
            serpapi_key: SerpAPI key
            public_ip: Public IP address for HTTP server access
            http_port: HTTP server port (default 1339)
        Returns:
            A string summary of search results, or None if search fails.
        """
        image_url = None
        if image_path.startswith(('http://', 'https://')):
            image_url = image_path
        else:
            # For local files, create HTTP server URL
            import os
            filename = os.path.basename(image_path)
            # Always use public IP for SerpAPI since Google needs to access it
            image_url = f"http://{public_ip}:{http_port}/{filename}"
            print(f"Using public IP URL for SerpAPI: {image_url}")
            
            # Verify the image is accessible
            try:
                import requests
                test_resp = requests.head(image_url, timeout=5)
                if test_resp.status_code == 200:
                    print(f"✅ Image is accessible at {image_url}")
                else:
                    print(f"⚠️ Warning: Image may not be accessible (status: {test_resp.status_code})")
            except Exception as e:
                print(f"⚠️ Warning: Could not verify image accessibility: {e}")
        params = {
            'engine': 'google_reverse_image',
            'image_url': image_url,
            'api_key': serpapi_key
        }
        try:
            print(f"Making SerpAPI request with image_url: {image_url}")
            resp = requests.get('https://serpapi.com/search', params=params, timeout=15)
            print(f"SerpAPI response status: {resp.status_code}")
            resp.raise_for_status()
            data = resp.json()
            print(f"SerpAPI response keys: {list(data.keys())}")
            print(f"SerpAPI full response: {data}")
            # Check for errors first
            if 'error' in data:
                print(f"SerpAPI error: {data['error']}")
                return f"SerpAPI Error: {data['error']}"
            
            # Extract relevant context from search results
            context_parts = []
            
            # Check for image results
            if 'image_results' in data and data['image_results']:
                num_results = len(data['image_results'])
                context_parts.append(f"Found {num_results} similar images on Google")
                print(f"Processing {num_results} image results...")
                for i, img in enumerate(data['image_results'][:5]):
                    if 'title' in img:
                        context_parts.append(f"Result {i+1}: {img['title']}")
                    if 'source' in img:
                        context_parts.append(f"  Source: {img['source']}")
                    if 'link' in img:
                        context_parts.append(f"  URL: {img['link']}")
            
            # Check for knowledge graph
            if 'knowledge_graph' in data:
                kg = data['knowledge_graph']
                for k, v in kg.items():
                    context_parts.append(f"{k}: {v}")
            
            # Check for suggested searches
            if 'suggested_searches' in data:
                for s in data['suggested_searches']:
                    context_parts.append(f"Suggested search: {s.get('name', '')}")
            
            # Check for best guess
            if 'best_guess' in data:
                context_parts.append(f"Best guess: {data['best_guess']}")
            
            # Check for inline images
            if 'inline_images' in data:
                context_parts.append(f"Found {len(data['inline_images'])} similar images.")
            
            # Add organic results snippets
            if 'organic_results' in data:
                for res in data['organic_results'][:3]:
                    if 'snippet' in res:
                        context_parts.append(f"Snippet: {res['snippet']}")
            
            # Check search information
            if 'search_information' in data:
                search_info = data['search_information']
                if 'query_displayed' in search_info:
                    context_parts.append(f"Google identified as: {search_info['query_displayed']}")
                if 'total_results' in search_info:
                    context_parts.append(f"Total results found: {search_info['total_results']}")
                if 'organic_results_state' in search_info:
                    state = search_info['organic_results_state']
                    if state == 'Fully empty':
                        context_parts.append("Google found no matching results for this image")
                    elif state != 'Results for exact spelling':
                        context_parts.append(f"Search state: {state}")
            
            # If no results found, provide a helpful message
            if not context_parts:
                print(f"ℹ️ SerpAPI returned no results for {image_url}")
                if 'search_information' in data:
                    si = data['search_information']
                    query = si.get('query_displayed', 'Unknown query')
                    total = si.get('total_results', 0)
                    state = si.get('organic_results_state', 'Unknown state')
                    print(f"   Query displayed: {query}")
                    print(f"   Total results: {total}")
                    print(f"   Results state: {state}")
                else:
                    print("   No search_information provided in SerpAPI response.")
                context_parts.append("No search results found for this image")
                context_parts.append("This could mean the image is unique or not widely available online")
            
            result = '\n'.join(context_parts) if context_parts else None
            print(f"SerpAPI context result: {result}")
            return result
        except Exception as e:
            print(f"SerpAPI error: {e}")
            return None

    def locate(self, image_path: str, context_info: Optional[str] = None, 
              location_guess: Optional[str] = None, serpapi_key: Optional[str] = None,
              public_ip: str = "31.97.227.80", http_port: int = 2001) -> Dict[str, Any]:
        """
        Locate an image using Gemini API with EXIF data and SerpAPI.
        Args:
            image_path: Path to the image file or URL
            context_info: Optional additional context about the image
            location_guess: Optional user's guess of the location
            serpapi_key: Optional SerpAPI key for Google search
            public_ip: Public IP address for HTTP server access
            http_port: HTTP server port for image access
        Returns:
            Dictionary containing the analysis and location information.
        """
        # Step 1: Extract EXIF data
        exif_data = None
        if not image_path.startswith(('http://', 'https://')):
            print("📷 Extracting EXIF data...")
            exif_data = self.extract_exif_data(image_path)
        
        # Step 2: SerpAPI
        serpapi_context = None
        serpapi_results = None
        if serpapi_key:
            print(f"🔎 Using SerpAPI with key: {serpapi_key[:10]}...")
            print(f"Image path: {image_path}")
            print(f"Public IP: {public_ip}, Port: {http_port}")
            serpapi_context = self.search_image_with_serpapi(image_path, serpapi_key, public_ip, http_port)
            print(f"SerpAPI context: {serpapi_context}")
            # Store SerpAPI results for display
            serpapi_results = {
                "context": serpapi_context,
                "has_results": serpapi_context is not None
            }
        else:
            print("No SerpAPI key provided, skipping web search context")
        
        # Combine context_info and serpapi_context
        combined_context = ''
        if context_info:
            combined_context += context_info + '\n'
        if serpapi_context:
            combined_context += f"Google Search Context:\n{serpapi_context}"
        
        # Add EXIF data to context
        if exif_data and exif_data["has_gps"] and exif_data["gps_coordinates"]:
            gps = exif_data["gps_coordinates"]
            if gps and 'latitude' in gps and 'longitude' in gps:
                combined_context += f"\n\nEXIF GPS Data: Lat {gps['latitude']}, Lon {gps['longitude']}"
        
        # Get Gemini analysis
        gemini_result = self.locate_with_gemini(image_path, combined_context if combined_context else None, location_guess)
        
        # Add EXIF and SerpAPI results to the response
        if exif_data:
            gemini_result["exif_data"] = exif_data
        
        if serpapi_results:
            gemini_result["serpapi_results"] = serpapi_results
        
        return gemini_result
