import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon, X } from 'lucide-react';
import { courtsApi } from '../../api/courts';
import { useToast } from '../../contexts/useToast';
import { useAuth } from '../../contexts/useAuth';
import MapPicker from '../../components/shared/MapPicker';
import AddressAutocomplete from '../../components/shared/AddressAutocomplete';

const BRANCH_OPTIONS = [
  { value: 'branch_hcm_1', label: 'Đà Nẵng' },
  { value: 'branch_hn_1', label: 'Hà Nội' },
];

const emptyForm = {
  branchId: 'branch_hcm_1',
  name: '',
  description: '',
  imageUrl: '',
  additionalImages: [],
  defaultPrice: 120000,
  status: 'ACTIVE',
  refundBeforeHours: 24,
  refundPercent: 100,
  rescheduleBeforeHours: 6,
  address: '',
  latitude: null,
  longitude: null,
};

function pickDefaultPrice(schedules = []) {
  const defaults = schedules.filter((s) => s.type === 'default');
  const source = defaults.length > 0 ? defaults : schedules;
  if (!source.length) return 120000;
  const sorted = [...source].sort((a, b) => {
    if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
  return sorted[0].price || 120000;
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatVnd(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return '';
  return num.toLocaleString('vi-VN');
}

export default function CourtEditorPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [schedules, setSchedules] = useState([]);
  const [defaultPriceText, setDefaultPriceText] = useState(String(emptyForm.defaultPrice));
  const [selectedImageName, setSelectedImageName] = useState('');
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedAdditionalFiles, setSelectedAdditionalFiles] = useState([]);
  const [selectedAdditionalNames, setSelectedAdditionalNames] = useState([]);
  const [additionalPreviewUrls, setAdditionalPreviewUrls] = useState([]);
  const [localPreviewUrl, setLocalPreviewUrl] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef(null);

  useEffect(() => {
    const roles = user?.roles || [];
    const isStaff = roles.includes('staff') && !roles.includes('admin');
    if (isStaff) {
      navigate('/admin/courts', { replace: true });
    }
  }, [navigate, user]);

  useEffect(() => {
    if (!isEdit) return;
    let active = true;

    (async () => {
      setLoading(true);
      try {
        // Bypass cache to ensure we get the latest data including address
        const [court, policy, priceSchedules] = await Promise.all([
          courtsApi.get(`${id}?bypassCache=true`),
          courtsApi.getPolicy(id).catch(() => null),
          courtsApi.getPriceSchedules(id).catch(() => ({ items: [] })),
        ]);

        if (!active) return;

        console.log('Court data loaded:', { court: { ...court, address: court.address, latitude: court.latitude, longitude: court.longitude } });

        const schedulesData = priceSchedules?.items || priceSchedules || [];
        setSchedules(schedulesData);

        setForm({
          branchId: court.branchId || 'branch_hcm_1',
          name: court.name || '',
          description: court.description || '',
          imageUrl: court.imageUrl || '',
          additionalImages: (court.additionalImages || []).slice(0, 5),
          defaultPrice: pickDefaultPrice(schedulesData),
          status: court.status || 'ACTIVE',
          refundBeforeHours: policy?.refundBeforeHours ?? 24,
          refundPercent: policy?.refundPercent ?? 100,
          rescheduleBeforeHours: policy?.rescheduleBeforeHours ?? 6,
          address: court.address || '',
          latitude: court.latitude || null,
          longitude: court.longitude || null,
        });
        setDefaultPriceText(formatVnd(pickDefaultPrice(schedulesData)) || '');
      } catch (err) {
        console.error('Error loading court data:', err);
        toast.error(err.message || 'Không thể tải dữ liệu sân.');
        navigate('/admin/courts', { replace: true });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id, isEdit, navigate, toast]);

  const imagePreview = useMemo(() => localPreviewUrl || form.imageUrl?.trim() || '', [localPreviewUrl, form.imageUrl]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
      additionalPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [additionalPreviewUrls, localPreviewUrl]);

  const onChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePriceChange = (value) => {
    const digits = onlyDigits(value);
    const numeric = Number(digits || 0);
    setDefaultPriceText(digits);
    onChange('defaultPrice', numeric);
  };

  const handlePriceBlur = () => {
    setDefaultPriceText(formatVnd(form.defaultPrice));
  };

  const handlePriceFocus = () => {
    setDefaultPriceText(form.defaultPrice ? String(form.defaultPrice) : '');
  };

  const handleImageFile = async (file) => {
    if (!file) return;
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl(objectUrl);
    setSelectedImageFile(file);
    setSelectedImageName(file.name);
    if (!isEdit) {
      onChange('imageUrl', '');
    }
  };

  const clearSelectedImage = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl('');
    setSelectedImageFile(null);
    onChange('imageUrl', '');
    setSelectedImageName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAdditionalFiles = (fileList) => {
    additionalPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    const files = Array.from(fileList || []).slice(0, 5);
    setSelectedAdditionalFiles(files);
    setSelectedAdditionalNames(files.map((file) => file.name));
    setAdditionalPreviewUrls(files.map((file) => URL.createObjectURL(file)));
  };

  const clearAdditionalFiles = () => {
    additionalPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedAdditionalFiles([]);
    setSelectedAdditionalNames([]);
    setAdditionalPreviewUrls([]);
    onChange('additionalImages', []);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        let uploadedImageUrl = form.imageUrl;
        if (selectedImageFile) {
          setIsUploadingImage(true);
          const uploaded = await courtsApi.uploadImage(selectedImageFile);
          uploadedImageUrl = uploaded.url || '';
          setIsUploadingImage(false);
        }

        let uploadedAdditional = form.additionalImages || [];
        if (selectedAdditionalFiles.length > 0) {
          setIsUploadingImage(true);
          const uploads = await Promise.all(selectedAdditionalFiles.map((file) => courtsApi.uploadImage(file)));
          uploadedAdditional = uploads.map((item) => item.url).filter(Boolean).slice(0, 5);
          setIsUploadingImage(false);
        }

        const payload = {
          branchId: form.branchId,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          imageUrl: uploadedImageUrl?.trim() || undefined,
          additionalImages: uploadedAdditional,
          address: form.address?.trim() || undefined,
          latitude: form.latitude || undefined,
          longitude: form.longitude || undefined,
        };

        if (isEdit) {
          await courtsApi.update(id, {
            ...payload,
            description: payload.description ?? null,
            imageUrl: payload.imageUrl ?? null,
            status: form.status,
          });
        } else {
          await courtsApi.create({
            ...payload,
            defaultPrice: Number(form.defaultPrice),
          });
        }

        if (isEdit) {
          const currentDefault = pickDefaultPrice(schedules);
          const nextPrice = Number(form.defaultPrice);
          if (nextPrice > 0 && nextPrice !== currentDefault) {
            const nextPriority = schedules.reduce((max, s) => Math.max(max, s.priority || 0), 0) + 1;
            await courtsApi.addPriceSchedule(courtId, {
              type: 'default',
              priority: nextPriority,
              price: nextPrice,
            });
          }
        }

        toast.success(isEdit ? 'Cập nhật sân thành công!' : 'Tạo sân thành công!');
        
        navigate('/admin/courts');
      } catch (err) {
        setIsUploadingImage(false);
        toast.error(err.message || 'Không thể lưu thông tin sân.');
      }
    });
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-low animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <button
        onClick={() => navigate('/admin/courts')}
        className="inline-flex items-center gap-1.5 mb-4 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft size={16} /> Quay lại danh sách sân
      </button>

      <div className="bg-surface-lowest rounded-2xl p-6 shadow-sm">
        <h1 className="text-xl font-bold text-on-surface mb-1">
          {isEdit ? 'Chỉnh sửa thông tin sân' : 'Thêm sân mới'}
        </h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Quản trị viên có thể chỉnh toàn bộ thông tin hiển thị: tên sân, mô tả, ảnh, giá và chính sách.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Field label="Tên sân" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => onChange('name', e.target.value)}
                required
                className="w-full h-11 px-4 rounded-lg bg-surface-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border"
              />
            </Field>

            <Field label="Chi nhánh" required>
              <select
                value={form.branchId}
                onChange={(e) => onChange('branchId', e.target.value)}
                className="w-full h-11 px-4 rounded-lg bg-surface-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border"
              >
                {BRANCH_OPTIONS.map((branch) => (
                  <option key={branch.value} value={branch.value}>{branch.label}</option>
                ))}
                {!BRANCH_OPTIONS.some((branch) => branch.value === form.branchId) ? (
                  <option value={form.branchId}>{form.branchId}</option>
                ) : null}
              </select>
            </Field>

            <Field label="Giá mặc định (VNĐ/giờ)" required>
              <input
                type="text"
                inputMode="numeric"
                value={defaultPriceText}
                onFocus={handlePriceFocus}
                onBlur={handlePriceBlur}
                onChange={(e) => handlePriceChange(e.target.value)}
                required
                placeholder="Ví dụ: 120000"
                className="w-full h-11 px-4 rounded-lg bg-surface-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border"
              />
            </Field>

            <Field label="Ảnh sân (chọn từ máy)">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                onChange={(e) => {
                  handleImageFile(e.target.files?.[0]);
                }}
                  disabled={isUploadingImage || isPending}
                  className="w-full h-11 px-3 py-2 rounded-lg bg-surface-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border file:mr-3 file:border-0 file:bg-amber-500 file:text-white file:px-3 file:py-1.5 file:rounded-md file:text-xs"
                />
                {(selectedImageName || form.imageUrl) ? (
                  <button
                    type="button"
                    onClick={clearSelectedImage}
                    className="h-10 w-10 shrink-0 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-error hover:border-error/40 hover:bg-red-50 transition-colors flex items-center justify-center"
                    title="Xóa ảnh đã chọn"
                    aria-label="Xóa ảnh đã chọn"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
              <p className="text-xs text-on-surface-variant mt-1.5 truncate">
                {isUploadingImage
                  ? 'Đang tải ảnh lên...'
                  : selectedImageName || (form.imageUrl ? 'Đã có ảnh cho sân' : 'Chưa chọn ảnh')}
              </p>
            </Field>

            <Field label="Ảnh bổ sung (tối đa 5 ảnh)">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleAdditionalFiles(e.target.files)}
                  disabled={isUploadingImage || isPending}
                  className="w-full h-11 px-3 py-2 rounded-lg bg-surface-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-amber-200 ghost-border border file:mr-3 file:border-0 file:bg-amber-500 file:text-white file:px-3 file:py-1.5 file:rounded-md file:text-xs"
                />
                {(selectedAdditionalNames.length > 0 || (form.additionalImages || []).length > 0) ? (
                  <button
                    type="button"
                    onClick={clearAdditionalFiles}
                    className="h-10 w-10 shrink-0 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-error hover:border-error/40 hover:bg-red-50 transition-colors flex items-center justify-center"
                    title="Xóa ảnh bổ sung"
                    aria-label="Xóa ảnh bổ sung"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
              <p className="text-xs text-on-surface-variant mt-1.5 truncate">
                {selectedAdditionalNames.length > 0
                  ? `${selectedAdditionalNames.length} ảnh đã chọn`
                  : `${(form.additionalImages || []).length} ảnh đang lưu`}
              </p>
            </Field>

            {isEdit && (
              <Field label="Trạng thái" required>
                <select
                  value={form.status}
                  onChange={(e) => onChange('status', e.target.value)}
                  className="w-full h-11 px-4 rounded-lg bg-surface-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border"
                >
                  <option value="ACTIVE">Hoạt động</option>
                  <option value="INACTIVE">Không hoạt động</option>
                  <option value="SUSPENDED">Tạm dừng</option>
                </select>
              </Field>
            )}
          </div>

          <Field label="Mô tả sân">
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => onChange('description', e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-surface-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border"
            />
          </Field>

          <Field label="Địa chỉ sân">
            <AddressAutocomplete
              value={form.address}
              onChange={(address, lat, lng) => {
                onChange('address', address);
                if (lat !== null && lng !== null) {
                  onChange('latitude', lat);
                  onChange('longitude', lng);
                }
              }}
              placeholder="Ví dụ: 12 Nguyễn Văn Linh, Quận Hải Châu, TP. Đà Nẵng"
              className="w-full h-11 px-4 rounded-lg bg-surface-low text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border"
            />
            <p className="text-xs text-on-surface-variant mt-1.5">
              Địa chỉ sẽ được dùng để hiển thị bản đồ và tính khoảng cách cho khách hàng
            </p>
          </Field>

          <Field label="Vị trí trên bản đồ">
            <MapPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onLocationChange={(lat, lng, address) => {
                onChange('latitude', lat);
                onChange('longitude', lng);
                if (address) {
                  onChange('address', address);
                }
              }}
              height="350px"
              zoom={13}
            />
          </Field>


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-xl border border-outline-variant/30 p-4 bg-surface-low">
              <p className="text-sm font-semibold text-on-surface mb-3">Chính sách đặt sân</p>
              <div className="grid grid-cols-2 gap-3">
                <ReadonlyValue label="Hoàn trước (giờ)" value={form.refundBeforeHours} />
                <ReadonlyValue label="Hoàn tiền (%)" value={form.refundPercent} />
                <ReadonlyValue label="Đổi lịch trước (giờ)" value={form.rescheduleBeforeHours} />
              </div>
            </div>

            <div className="rounded-xl border border-outline-variant/30 p-4 bg-surface-low flex items-center justify-center min-h-[180px]">
              {imagePreview ? (
                <img src={imagePreview} alt="Xem trước ảnh sân" className="max-h-[180px] w-full object-cover rounded-lg" />
              ) : (
                <div className="text-center text-on-surface-variant">
                  <ImageIcon size={24} className="mx-auto mb-2" />
                  <p className="text-sm">Chưa có ảnh xem trước</p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-outline-variant/30 p-4 bg-surface-low min-h-[180px]">
              <p className="text-sm font-medium text-on-surface mb-2">Ảnh bổ sung</p>
              <div className="grid grid-cols-3 gap-2">
                {(additionalPreviewUrls.length > 0 ? additionalPreviewUrls : (form.additionalImages || [])).slice(0, 5).map((url) => (
                  <img key={url} src={url} alt="Ảnh bổ sung" className="w-full h-20 rounded-lg object-cover" />
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/admin/courts')}
              className="h-11 px-6 rounded-xl font-medium text-on-surface border border-outline-variant/30 hover:bg-surface-low transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-11 px-6 rounded-xl font-semibold text-white bg-primary hover:bg-primary-active transition-colors disabled:opacity-60"
            >
              {isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-on-surface mb-1.5">
        {label} {required ? <span className="text-error">*</span> : null}
      </label>
      {children}
    </div>
  );
}

function NumberField({ label, value, onChange, min = 0, max }) {
  return (
    <div>
      <label className="block text-xs text-on-surface-variant mb-1">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="w-full h-10 px-3 rounded-lg bg-surface-lowest text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container ghost-border border"
      />
    </div>
  );
}

function ReadonlyValue({ label, value }) {
  return (
    <div>
      <label className="block text-xs text-on-surface-variant mb-1">{label}</label>
      <div className="w-full h-10 px-3 rounded-lg bg-surface-lowest text-sm text-on-surface ghost-border border flex items-center">
        {value}
      </div>
    </div>
  );
}
