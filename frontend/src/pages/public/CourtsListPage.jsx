import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Star, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { courtsApi } from '../../api/courts';

const locationTypes = ['Tất cả', 'Đà Nẵng', 'Hà Nội'];
const BRANCH_LOCATION_MAP = {
  branch_hcm_1: 'Đà Nẵng',
  branch_dn_1: 'Đà Nẵng',
  branch_hn_1: 'Hà Nội',
};
const DEFAULT_IMAGE = '/courts/default-court.svg';

const SORT_OPTIONS = [
  { value: 'nearest', label: 'Gần tôi nhất' },
  { value: 'popular', label: 'Phổ biến nhất' },
  { value: 'price_asc', label: 'Giá: Thấp → Cao' },
  { value: 'price_desc', label: 'Giá: Cao → Thấp' },
];

// Calculate distance between two points using Haversine formula (returns distance in km)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistance = (distance) => {
  if (distance === null) return null;
  if (distance < 1) return `${(distance * 1000).toFixed(0)}m`;
  return `${distance.toFixed(1)}km`;
};

export default function CourtsListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLocation, setActiveLocation] = useState('Tất cả');
  const [allCourts, setAllCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('popular');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log('Geolocation error:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    const fetchCourts = () => {
      courtsApi.list({ includeInactive: false })
        .then((data) => {
          const items = data.items || (Array.isArray(data) ? data : []);
          setAllCourts(items.map((c) => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
            location: BRANCH_LOCATION_MAP[c.branchId] || 'Đà Nẵng',
            address: c.address || '',
            description: c.description || '',
            price: c.priceSchedules?.[0]?.price || 0,
            priceDisplay: c.priceSchedules?.[0]?.price?.toLocaleString('vi-VN') || '—',
            rating: 4.5,
            reviews: 0,
            image: c.imageUrl || DEFAULT_IMAGE,
            bookingCount: c.bookingCount || 0,
            hasTimeSlots: (c.priceSchedules && c.priceSchedules.length > 0),
            hasRequiredInfo: !!(c.name && c.branchId),
            latitude: c.latitude,
            longitude: c.longitude,
          })));
        })
        .catch(() => setAllCourts([]))
        .finally(() => setLoading(false));
    };

    fetchCourts();
    const interval = setInterval(fetchCourts, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = allCourts.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       c.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchLocation = activeLocation === 'Tất cả' || c.location === activeLocation;
    return matchSearch && matchLocation;
  });

  // Sort logic
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'nearest': {
        const distA = userLocation && a.latitude && a.longitude
          ? calculateDistance(userLocation.lat, userLocation.lng, a.latitude, a.longitude)
          : Infinity;
        const distB = userLocation && b.latitude && b.longitude
          ? calculateDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude)
          : Infinity;
        return distA - distB;
      }
      case 'price_asc':
        return (a.price || 0) - (b.price || 0);
      case 'price_desc':
        return (b.price || 0) - (a.price || 0);
      case 'popular':
      default:
        return (b.bookingCount || 0) - (a.bookingCount || 0);
    }
  });

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Phổ biến nhất';

  return (
    <div className="bg-canvas text-ink min-h-screen">
      {/* Page Header */}
      <section className="bg-surface-soft border-b border-hairline py-8 md:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">Danh sách sân cầu lông</h1>
          <p className="mt-1.5 text-sm text-muted">Tìm kiếm và đặt sân theo vị trí, mức giá và dịch vụ tiện ích.</p>
        </div>
      </section>

      {/* Search & Filter - Airbnb Pill Search Bar */}
      <section className="sticky top-0 z-30 bg-canvas/95 backdrop-blur-md border-b border-hairline py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Airbnb Pill Search Bar */}
            <div className="relative flex-1 w-full max-w-2xl">
              <div className="flex items-center h-13 pl-4 pr-1.5 rounded-full border border-hairline bg-canvas hover:border-outline focus-within:border-ink shadow-sm transition-all">
                <Search size={18} className="text-muted shrink-0 mr-3" />
                <input
                  id="court-search"
                  type="text"
                  placeholder="Tìm kiếm sân theo tên, địa chỉ, quận huyện..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-ink placeholder:text-muted text-sm focus:outline-none"
                />
                <button
                  type="button"
                  aria-label="Search"
                  className="h-9 w-9 rounded-full bg-primary hover:bg-primary-active text-white flex items-center justify-center shrink-0 transition-colors shadow-sm ml-2 cursor-pointer"
                >
                  <Search size={15} />
                </button>
              </div>
            </div>

            {/* Filter Chips - Location tags */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              <SlidersHorizontal size={15} className="text-muted shrink-0 mr-1" />
              {locationTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveLocation(type)}
                  className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    activeLocation === type
                      ? 'bg-ink text-white shadow-sm'
                      : 'bg-surface-soft text-muted hover:text-ink hover:bg-surface-container border border-hairline'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Results */}
      <section className="py-8 md:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Results Header */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted">
              Hiển thị <span className="font-semibold text-ink">{sorted.length}</span> sân cầu lông
            </p>
            {/* Working Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-ink bg-surface-soft hover:bg-surface-container border border-hairline px-3.5 py-2 rounded-full transition-colors cursor-pointer"
              >
                Sắp xếp: {currentSortLabel} <ChevronDown size={14} className="text-muted" />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-canvas rounded-xl shadow-ambient border border-hairline py-1.5 z-50 animate-fade-in">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-xs sm:text-sm transition-colors cursor-pointer ${
                        sortBy === opt.value
                          ? 'text-primary font-semibold bg-primary-fixed/30'
                          : 'text-body hover:bg-surface-soft'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Court Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="rounded-xl overflow-hidden border border-hairline bg-canvas">
                  <div className="aspect-[4/3] bg-surface-soft animate-pulse" />
                  <div className="p-4 space-y-2.5">
                    <div className="h-4 bg-surface-soft rounded w-3/4 animate-pulse" />
                    <div className="h-3 bg-surface-soft rounded w-1/2 animate-pulse" />
                    <div className="h-4 bg-surface-soft rounded w-1/3 animate-pulse mt-4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sorted.map((court) => {
              const canBook = court.hasTimeSlots && court.hasRequiredInfo;
              const distance = userLocation && court.latitude && court.longitude
                ? calculateDistance(userLocation.lat, userLocation.lng, court.latitude, court.longitude)
                : null;
              return (
              <div key={court.id} className="group bg-canvas rounded-xl overflow-hidden border border-hairline hover:shadow-ambient transition-all flex flex-col justify-between">
                {/* Clickable image → detail page */}
                <Link to={`/courts/${court.slug || court.id}`} className="block relative overflow-hidden aspect-[4/3] bg-surface-soft">
                  <img
                    src={court.image}
                    alt={court.name}
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                  />
                  <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-semibold bg-white text-ink shadow-sm border border-black/5">
                    {court.location}
                  </span>
                </Link>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Clickable name → detail page */}
                    <Link to={`/courts/${court.slug || court.id}`}>
                      <h3 className="font-semibold text-ink text-base line-clamp-1 group-hover:text-primary transition-colors cursor-pointer">
                        {court.name}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted">
                      <MapPin size={13} className="shrink-0" />
                      <span className="flex-1 truncate">{court.address || court.location}</span>
                      {distance !== null && (
                        <span className="text-primary font-medium ml-1 shrink-0">{formatDistance(distance)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <Star size={13} className="fill-ink text-ink" />
                      <span className="text-xs font-semibold text-ink">{court.rating}</span>
                      <span className="text-xs text-muted">({court.reviews} đánh giá)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-hairline-soft">
                    <div>
                      <span className="text-sm font-semibold text-ink">
                        Từ {court.priceDisplay}đ
                      </span>
                      <span className="text-xs text-muted">/giờ</span>
                    </div>
                    <div className="flex gap-2">
                      {canBook ? (
                        <Link
                          to={`/courts/${court.slug || court.id}`}
                          className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary-active transition-colors shadow-sm"
                        >
                          Đặt sân
                        </Link>
                      ) : (
                        <span
                          className="px-4 py-2 rounded-lg text-xs font-semibold text-muted bg-surface-container cursor-not-allowed"
                          title="Sân chưa có khung giờ hoặc thiếu thông tin"
                        >
                          Chưa mở
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );})}
          </div>

          )}
          {!loading && sorted.length === 0 && (
            <div className="text-center py-16 bg-surface-soft rounded-2xl border border-hairline my-6">
              <p className="text-muted text-base">Không tìm thấy sân nào phù hợp với tìm kiếm của bạn.</p>
              <button
                onClick={() => { setSearchQuery(''); setActiveLocation('Tất cả'); }}
                className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold text-primary border border-primary hover:bg-primary hover:text-white transition-colors cursor-pointer"
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Close sort menu on outside click */}
      {showSortMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
      )}
    </div>
  );
}
