import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix for default marker icon issue with react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/**
 * Component to automatically center map on markers
 */
function MapController({ center, zoom }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && center.lat && center.lng) {
      map.setView([center.lat, center.lng], zoom || 13);
    }
  }, [center, zoom, map]);

  return null;
}

/**
 * Map Component using Leaflet + OpenStreetMap
 * @param {Object} props
 * @param {Object} props.center - Map center coordinates {lat, lng}
 * @param {Array<Object>} props.markers - Array of markers [{lat, lng, popup}]
 * @param {number} props.zoom - Initial zoom level (default: 13)
 * @param {string} props.height - Map height (default: '300px')
 * @param {boolean} props.showPopup - Show popup on marker click (default: true)
 */
export default function MapComponent({
  center,
  markers = [],
  zoom = 13,
  height = '300px',
  showPopup = true,
}) {
  // If center not provided but markers exist, use first marker as center
  const mapCenter = center || (markers.length > 0 ? markers[0] : { lat: 10.7769, lng: 106.7009 }); // Default to Ho Chi Minh City

  // If no markers, create a default marker at center
  const mapMarkers = markers.length > 0 ? markers : [{ lat: mapCenter.lat, lng: mapCenter.lng, popup: 'Vị trí' }];

  return (
    <div style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
      <MapContainer
        center={[mapCenter.lat, mapCenter.lng]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController center={mapCenter} zoom={zoom} />

        {mapMarkers.map((marker, index) => (
          <Marker
            key={index}
            position={[marker.lat, marker.lng]}
          >
            {showPopup && marker.popup && (
              <Popup>
                <div className="text-sm">
                  {marker.popup}
                  {marker.address && <div className="text-gray-600 mt-1">{marker.address}</div>}
                </div>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

/**
 * Simple Court Map Component - specialized for displaying court location
 */
export function CourtMap({ court }) {
  if (!court || !court.latitude || !court.longitude) {
    return (
      <div className="bg-surface-low rounded-xl p-8 text-center text-on-surface-variant">
        <p>Chưa có thông tin vị trí cho sân này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-on-surface">Vị trí sân</h3>
      <MapComponent
        center={{ lat: court.latitude, lng: court.longitude }}
        markers={[
          {
            lat: court.latitude,
            lng: court.longitude,
            popup: court.name,
            address: court.address,
          },
        ]}
        zoom={15}
        height="350px"
      />
      {court.address && (
        <div className="flex items-start gap-2 text-sm text-on-surface-variant">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{court.address}</span>
        </div>
      )}
    </div>
  );
}
