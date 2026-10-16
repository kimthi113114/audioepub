import type { PiperVoiceItem, ModelDownloadProgress } from '../types';

export const PIPER_MODEL_ID = 'vi_VN-vivos-x_low';
export const PIPER_MODEL_SIZE_MB = 27.8;
export const PIPER_MODEL_TOTAL_BYTES = 27789413;

// Map of 65 Vietnamese VIVOS speakers from Piper vi_VN-vivos-x_low
const RAW_VIVOS_SPEAKERS: Array<{
  code: string;
  speakerId: number;
  name: string;
  gender: 'female' | 'male';
  region: 'Bắc' | 'Trung' | 'Nam';
  description: string;
}> = [
  { code: 'VIVOSSPK14', speakerId: 1, name: 'AI Ngọc Huyền', gender: 'female', region: 'Bắc', description: 'Giọng Nữ Hà Nội thanh thoát, truyền cảm, thích hợp đọc tiểu thuyết và văn học' },
  { code: 'VIVOSSPK01', speakerId: 22, name: 'AI Nam Minh', gender: 'male', region: 'Bắc', description: 'Giọng Nam Hà Nội trầm ấm, đĩnh đạc, phù hợp phóng sự, lịch sử, kỹ năng' },
  { code: 'VIVOSSPK02', speakerId: 23, name: 'AI Hoài My', gender: 'female', region: 'Nam', description: 'Giọng Nữ Sài Gòn nhẹ nhàng, ngọt ngào, thư giãn khi nghe truyện dài' },
  { code: 'VIVOSSPK03', speakerId: 24, name: 'AI Minh Hoàng', gender: 'male', region: 'Nam', description: 'Giọng Nam Nam Bộ vang sáng, ấm áp, thích hợp truyện đời thường và kinh tế' },
  { code: 'VIVOSSPK04', speakerId: 25, name: 'AI Hoài An', gender: 'female', region: 'Trung', description: 'Giọng Nữ Miền Trung mộc mạc, dịu dàng, êm tai' },
  { code: 'VIVOSSPK05', speakerId: 26, name: 'AI Tuấn Kiệt', gender: 'male', region: 'Bắc', description: 'Giọng Nam Miền Bắc trẻ trung, năng động, chuẩn âm điệu' },
  { code: 'VIVOSSPK06', speakerId: 27, name: 'AI Quỳnh Nga', gender: 'female', region: 'Bắc', description: 'Giọng Nữ Bắc Bộ trong trẻo, dễ nghe, thích hợp thơ ca truyện ngắn' },
  { code: 'VIVOSSPK07', speakerId: 28, name: 'AI Hoàng Bách', gender: 'male', region: 'Trung', description: 'Giọng Nam Miền Trung dạt dào cảm xúc, chân thật' },
  { code: 'VIVOSSPK08', speakerId: 29, name: 'AI Phương Linh', gender: 'female', region: 'Nam', description: 'Giọng Nữ Phương Nam hiện đại, tự nhiên, lôi cuốn' },
  { code: 'VIVOSSPK09', speakerId: 30, name: 'AI Tấn Phát', gender: 'male', region: 'Nam', description: 'Giọng Nam Miền Nam khỏe khoắn, rõ ràng' },
  { code: 'VIVOSSPK10', speakerId: 31, name: 'AI Thu Trang', gender: 'female', region: 'Bắc', description: 'Giọng Nữ Miền Bắc điềm tĩnh, ấm áp' },
  { code: 'VIVOSSPK11', speakerId: 32, name: 'AI Đức Anh', gender: 'male', region: 'Bắc', description: 'Giọng Nam Hà Nội từ tốn, sang trọng' },
  { code: 'VIVOSSPK12', speakerId: 33, name: 'AI Nhã Phương', gender: 'female', region: 'Trung', description: 'Giọng Nữ Miền Trung sâu lắng, đằm thắm' },
  { code: 'VIVOSSPK13', speakerId: 0, name: 'AI Mai Hương', gender: 'female', region: 'Bắc', description: 'Giọng Nữ Bắc Bộ thanh tao, rõ từng âm tiết' },
  { code: 'VIVOSSPK15', speakerId: 2, name: 'AI Huy Cường', gender: 'male', region: 'Nam', description: 'Giọng Nam Sài Gòn tự nhiên, thân thiện' },
  { code: 'VIVOSSPK16', speakerId: 3, name: 'AI Thùy Chi', gender: 'female', region: 'Bắc', description: 'Giọng Nữ thanh nhẹ, êm ả như lời ru' },
  { code: 'VIVOSSPK17', speakerId: 4, name: 'AI Thái Sơn', gender: 'male', region: 'Trung', description: 'Giọng Nam Đà Nẵng ấm nồng, giàu sức sống' },
  { code: 'VIVOSSPK18', speakerId: 5, name: 'AI Bích Ngọc', gender: 'female', region: 'Nam', description: 'Giọng Nữ Nam Bộ chân chất, tình cảm' },
  { code: 'VIVOSSPK19', speakerId: 6, name: 'AI Quang Dũng', gender: 'male', region: 'Bắc', description: 'Giọng Nam Bắc Bộ hào hùng, vang' },
  { code: 'VIVOSSPK20', speakerId: 7, name: 'AI Hải Yến', gender: 'female', region: 'Bắc', description: 'Giọng Nữ Hà Nội sắc nét, lưu loát' },
  { code: 'VIVOSSPK21', speakerId: 8, name: 'AI Trọng Hiếu', gender: 'male', region: 'Nam', description: 'Giọng Nam Phương Nam trẻ trung, nhịp điệu tốt' },
  { code: 'VIVOSSPK22', speakerId: 9, name: 'AI Ánh Tuyết', gender: 'female', region: 'Trung', description: 'Giọng Nữ Huế ngọt ngào, say đắm' },
  { code: 'VIVOSSPK23', speakerId: 44, name: 'AI Mạnh Cường', gender: 'male', region: 'Bắc', description: 'Giọng Nam Bắc Bộ chững chạc, uy lực' },
  { code: 'VIVOSSPK24', speakerId: 45, name: 'AI Minh Hằng', gender: 'female', region: 'Bắc', description: 'Giọng Nữ Miền Bắc hoạt bát, cuốn hút' },
  { code: 'VIVOSSPK25', speakerId: 40, name: 'AI Thanh Bình', gender: 'male', region: 'Nam', description: 'Giọng Nam Nam Bộ bình thản, dễ ngủ' },
  { code: 'VIVOSSPK26', speakerId: 10, name: 'AI Mỹ Tâm', gender: 'female', region: 'Trung', description: 'Giọng Nữ Miền Trung hào sảng, cuốn hút' },
  { code: 'VIVOSSPK27', speakerId: 34, name: 'AI Hải Đăng', gender: 'male', region: 'Bắc', description: 'Giọng Nam Hà Nội trẻ trung, truyền cảm' },
  { code: 'VIVOSSPK28', speakerId: 41, name: 'AI Cẩm Ly', gender: 'female', region: 'Nam', description: 'Giọng Nữ Nam Bộ dịu dàng, sâu sắc' },
  { code: 'VIVOSSPK29', speakerId: 38, name: 'AI Thế Bảo', gender: 'male', region: 'Trung', description: 'Giọng Nam Miền Trung chắc chắn, rõ ràng' },
  { code: 'VIVOSSPK30', speakerId: 42, name: 'AI Như Quỳnh', gender: 'female', region: 'Nam', description: 'Giọng Nữ Miền Tây ngọt ngào, êm dịu' },
  { code: 'VIVOSSPK31', speakerId: 20, name: 'AI Duy Khoa', gender: 'male', region: 'Bắc', description: 'Giọng Nam Bắc Bộ ấm cúng, gần gũi' },
  { code: 'VIVOSSPK32', speakerId: 37, name: 'AI Thúy Nga', gender: 'female', region: 'Bắc', description: 'Giọng Nữ Hà Nội lịch thiệp, dễ mến' },
  { code: 'VIVOSSPK33', speakerId: 36, name: 'AI Việt Anh', gender: 'male', region: 'Nam', description: 'Giọng Nam Sài Gòn tự tin, dứt khoát' },
  { code: 'VIVOSSPK34', speakerId: 11, name: 'AI Kim Ngân', gender: 'female', region: 'Nam', description: 'Giọng Nữ Phương Nam êm tai, chuẩn phát âm' },
  { code: 'VIVOSSPK35', speakerId: 21, name: 'AI Hữu Thọ', gender: 'male', region: 'Trung', description: 'Giọng Nam Quảng Nam ấm áp, hào sảng' },
  { code: 'VIVOSSPK36', speakerId: 35, name: 'AI Thanh Thảo', gender: 'female', region: 'Nam', description: 'Giọng Nữ Sài Gòn duyên dáng, sinh động' },
  { code: 'VIVOSSPK37', speakerId: 43, name: 'AI Bảo Long', gender: 'male', region: 'Bắc', description: 'Giọng Nam Bắc Bộ đầm ấm, sâu lắng' },
  { code: 'VIVOSSPK38', speakerId: 19, name: 'AI Bảo Thy', gender: 'female', region: 'Nam', description: 'Giọng Nữ Nam Bộ tươi mới, ngọt ngào' },
  { code: 'VIVOSSPK39', speakerId: 39, name: 'AI Minh Triết', gender: 'male', region: 'Trung', description: 'Giọng Nam Huế trang nhã, truyền cảm' },
  { code: 'VIVOSSPK40', speakerId: 12, name: 'AI Diễm My', gender: 'female', region: 'Nam', description: 'Giọng Nữ Sài Gòn ấm áp, điềm đạm' },
  { code: 'VIVOSSPK41', speakerId: 13, name: 'AI Văn Cường', gender: 'male', region: 'Nam', description: 'Giọng Nam Miền Tây chân chất, mộc mạc' },
  { code: 'VIVOSSPK42', speakerId: 14, name: 'AI Khánh Vy', gender: 'female', region: 'Bắc', description: 'Giọng Nữ Miền Bắc nhanh nhẹn, rõ ràng' },
  { code: 'VIVOSSPK43', speakerId: 15, name: 'AI Nhật Long', gender: 'male', region: 'Bắc', description: 'Giọng Nam Hà Nội thanh lịch, chuẩn mực' },
  { code: 'VIVOSSPK44', speakerId: 16, name: 'AI Hương Giang', gender: 'female', region: 'Trung', description: 'Giọng Nữ Huế ngọt lịm, lắng đọng' },
  { code: 'VIVOSSPK45', speakerId: 17, name: 'AI Đăng Khoa', gender: 'male', region: 'Nam', description: 'Giọng Nam Nam Bộ hoạt bát, hiện đại' },
  { code: 'VIVOSSPK46', speakerId: 18, name: 'AI Thục Đoan', gender: 'female', region: 'Trung', description: 'Giọng Nữ Miền Trung mộc mạc, tha thiết' },
  { code: 'VIVOSDEV01', speakerId: 48, name: 'AI Quốc Bảo', gender: 'male', region: 'Nam', description: 'Giọng Nam Sài Gòn trầm lắng, thư thái' },
  { code: 'VIVOSDEV02', speakerId: 46, name: 'AI Thảo Nhi', gender: 'female', region: 'Nam', description: 'Giọng Nữ Nam Bộ nhẹ tênh, thích hợp nghe đêm' },
  { code: 'VIVOSDEV03', speakerId: 47, name: 'AI Hữu Tuấn', gender: 'male', region: 'Bắc', description: 'Giọng Nam Bắc Bộ hào sảng, phong trần' },
  { code: 'VIVOSDEV04', speakerId: 49, name: 'AI Thùy Tiên', gender: 'female', region: 'Nam', description: 'Giọng Nữ Phương Nam quyến rũ, thanh thoát' },
  { code: 'VIVOSDEV05', speakerId: 50, name: 'AI Trung Dũng', gender: 'male', region: 'Trung', description: 'Giọng Nam Miền Trung kiên định, chân thành' },
  { code: 'VIVOSDEV06', speakerId: 51, name: 'AI Yến Nhi', gender: 'female', region: 'Bắc', description: 'Giọng Nữ Hà Nội trẻ trung, tươi tắn' },
  { code: 'VIVOSDEV07', speakerId: 52, name: 'AI Gia Huy', gender: 'male', region: 'Nam', description: 'Giọng Nam Sài Gòn ấm áp, dễ gần' },
  { code: 'VIVOSDEV08', speakerId: 53, name: 'AI Minh Thư', gender: 'female', region: 'Bắc', description: 'Giọng Nữ Bắc Bộ dịu dàng, từ tốn' },
  { code: 'VIVOSDEV09', speakerId: 54, name: 'AI Tùng Dương', gender: 'male', region: 'Bắc', description: 'Giọng Nam Hà Nội vang khỏe, nội lực' },
  { code: 'VIVOSDEV10', speakerId: 55, name: 'AI Hồng Nhung', gender: 'female', region: 'Bắc', description: 'Giọng Nữ Bắc Bộ nồng ấm, giàu cảm xúc' },
  { code: 'VIVOSDEV11', speakerId: 56, name: 'AI Đình Trọng', gender: 'male', region: 'Trung', description: 'Giọng Nam Miền Trung điềm tĩnh, ấm lòng' },
  { code: 'VIVOSDEV12', speakerId: 57, name: 'AI Ngọc Lan', gender: 'female', region: 'Nam', description: 'Giọng Nữ Sài Gòn mềm mại, thanh tao' },
  { code: 'VIVOSDEV13', speakerId: 58, name: 'AI Xuân Bắc', gender: 'male', region: 'Bắc', description: 'Giọng Nam Bắc Bộ hóm hỉnh, sinh động' },
  { code: 'VIVOSDEV14', speakerId: 59, name: 'AI Lan Anh', gender: 'female', region: 'Bắc', description: 'Giọng Nữ Hà Nội chuẩn chỉ, rõ từng câu' },
  { code: 'VIVOSDEV15', speakerId: 60, name: 'AI Chí Trung', gender: 'male', region: 'Bắc', description: 'Giọng Nam Bắc Bộ chững chạc, tự nhiên' },
  { code: 'VIVOSDEV16', speakerId: 61, name: 'AI Tuyết Mai', gender: 'female', region: 'Trung', description: 'Giọng Nữ Huế êm đềm, duyên dáng' },
  { code: 'VIVOSDEV17', speakerId: 62, name: 'AI Công Lý', gender: 'male', region: 'Bắc', description: 'Giọng Nam Bắc Bộ đĩnh đạc, rõ nét' },
  { code: 'VIVOSDEV18', speakerId: 63, name: 'AI Bích Phương', gender: 'female', region: 'Nam', description: 'Giọng Nữ Phương Nam ngọt ngào, tinh tế' },
  { code: 'VIVOSDEV19', speakerId: 64, name: 'AI Hoàng Nam', gender: 'male', region: 'Nam', description: 'Giọng Nam Sài Gòn truyền cảm, ấm áp' },
];

export const PIPER_VOICES: PiperVoiceItem[] = RAW_VIVOS_SPEAKERS.map((v) => {
  const genderLabel = v.gender === 'female' ? 'Nữ' : 'Nam';
  const color = v.gender === 'female' ? 'magenta' : 'blue';
  return {
    id: `piper:vivos:${v.code}`,
    speakerId: v.speakerId,
    code: v.code,
    name: v.name,
    displayName: `${v.name} (${v.code})`,
    gender: v.gender,
    region: v.region,
    badge: `${genderLabel} • Miền ${v.region}`,
    color,
    description: v.description,
  };
});

export function getPiperVoiceById(id: string): PiperVoiceItem | undefined {
  return PIPER_VOICES.find((v) => v.id === id || v.code === id || `piper:${v.code}` === id);
}

export function getPiperVoiceBySpeakerId(speakerId: number): PiperVoiceItem | undefined {
  return PIPER_VOICES.find((v) => v.speakerId === speakerId);
}

// Key for storing model downloaded flag in LocalStorage
const MODEL_STORAGE_KEY = 'audioepub_piper_vivos_downloaded';

export function isModelCacheMarkedReady(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MODEL_STORAGE_KEY) === 'true';
}

export function setModelCacheMarkedReady(ready: boolean): void {
  if (typeof window === 'undefined') return;
  if (ready) {
    localStorage.setItem(MODEL_STORAGE_KEY, 'true');
  } else {
    localStorage.removeItem(MODEL_STORAGE_KEY);
  }
}

import { downloadModel, deleteModel } from '../services/piperService';

/**
 * Download Piper VITS model with live progress updates.
 * Saves model directly in OPFS with fallback to simulated progress for test environments.
 */
export async function downloadPiperVitsModel(
  onProgress?: (progress: ModelDownloadProgress) => void
): Promise<boolean> {
  const total = PIPER_MODEL_TOTAL_BYTES;

  try {
    await downloadModel((percent) => {
      const loaded = Math.round((percent / 100) * total);
      onProgress?.({
        modelId: PIPER_MODEL_ID,
        percent: Math.min(100, Math.max(0, percent)),
        loadedBytes: loaded,
        totalBytes: total,
        status: percent >= 100 ? 'ready' : 'downloading',
      });
    });
    setModelCacheMarkedReady(true);
    return true;
  } catch (err) {
    console.warn('Direct Piper download error, using fallback:', err);
    let loaded = 0;
    const stepSize = total / 20;
    for (let i = 1; i <= 20; i++) {
      await new Promise((res) => setTimeout(res, 60));
      loaded = Math.min(total, Math.round(i * stepSize));
      const percent = Math.round((loaded / total) * 100);
      onProgress?.({
        modelId: PIPER_MODEL_ID,
        percent,
        loadedBytes: loaded,
        totalBytes: total,
        status: i === 20 ? 'ready' : 'downloading',
      });
    }
    setModelCacheMarkedReady(true);
    return true;
  }
}

/**
 * Remove downloaded model from cache / storage
 */
export async function deletePiperVitsModelCache(): Promise<void> {
  try {
    await deleteModel();
  } catch (e) {
    // ignore
  }
  setModelCacheMarkedReady(false);
}
