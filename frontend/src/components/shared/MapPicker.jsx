import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useState, useEffect } from 'react';

// Fix for default marker icon issue with react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Reverse geocoding function using Nominatim (OpenStreetMap)
async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=vi`
    );
    const data = await response.json();
    return data.display_name || '';
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return '';
  }
}

/**
 * Component to handle map click events
 */
function MapClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

/**
 * Component to automatically center map on coordinates
 */
function MapController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom, map]);

  return null;
}

/**
 * Map Picker Component - allows clicking on map to select coordinates
 * @param {Object} props
 * @param {number|null} props.latitude - Current latitude
 * @param {number|null} props.longitude - Current longitude
 * @param {function} props.onLocationChange - Callback when location changes (lat, lng, address)
 * @param {number} props.zoom - Initial zoom level (default: 13)
 * @param {string} props.height - Map height (default: '300px')
 */
export default function MapPicker({ latitude, longitude, onLocationChange, zoom = 13, height = '300px' }) {
  const [loadingAddress, setLoadingAddress] = useState(false);

  // Default to Ho Chi Minh City if no coordinates provided
  const center = {
    lat: latitude ?? 10.7769,
    lng: longitude ?? 106.7009,
  };

  const hasLocation = latitude !== null && longitude !== null;

  const handleLocationChange = async (lat, lng) => {
    setLoadingAddress(true);
    const address = await reverseGeocode(lat, lng);
    setLoadingAddress(false);
    onLocationChange(lat, lng, address);
  };

  const handleMapClick = (latlng) => {
    handleLocationChange(latlng.lat, latlng.lng);
  };

  const handleMarkerDragEnd = (e) => {
    const marker = e.target;
    const position = marker.getLatLng();
    handleLocationChange(position.lat, position.lng);
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ định vị.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        handleLocationChange(lat, lng);
      },
      (error) => {
        console.error('Geolocation error:', error);
        alert('Không thể lấy vị trí hiện tại. Vui lòng kiểm tra quyền truy cập vị trí.');
      }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-on-surface-variant">
          {hasLocation 
            ? `Vị trí đã chọn. Click vào bản đồ hoặc kéo marker để thay đổi.`
            : 'Click vào bản đồ để chọn vị trí sân.'}
        </p>
        <button
          type="button"
          onClick={handleCurrentLocation}
          disabled={loadingAddress}
          className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/80 disabled:opacity-50 transition-colors"
        >
          📍 Vị trí hiện tại
        </button>
      </div>
      <div style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapController center={center} zoom={zoom} />
          <MapClickHandler onClick={handleMapClick} />

          {hasLocation && (
            <Marker
              position={[latitude, longitude]}
              draggable={true}
              eventHandlers={{
                dragend: handleMarkerDragEnd,
              }}
            />
          )}
        </MapContainer>
      </div>
      {loadingAddress && (
        <p className="text-xs text-on-surface-variant">Đang tải địa chỉ...</p>
      )}
    </div>
  );
}
