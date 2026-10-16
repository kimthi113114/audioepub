/**
 * Piper Neural TTS Service for Vietnamese Audiobooks
 * Model: vi_VN-vivos-x_low (VITS Architecture, 65 Speakers, ~27.8MB)
 * Storage: Origin Private File System (OPFS) with IndexedDB fallback
 * Ref: ARCHITECTURE_DUAL_ENGINE_TTS.md (ADR-02, US-08, TC-39, TC-41)
 */

import { download, stored, remove, predict } from '@mintplex-labs/piper-tts-web';
import type { VivosVoice } from '../types';

export const PIPER_MODEL_ID = 'vi_VN-vivos-x_low';
export const PIPER_MODEL_SIZE_BYTES = 27789413; // ~27.8MB
export const PIPER_MODEL_SIZE_MB = 27.8;

// Complete VIVOS 65-speaker dataset mapping with natural, friendly names across Northern, Central, and Southern Vietnam
export const VIVOS_VOICES: VivosVoice[] = [
  { id: 'piper:vivos:0', speakerId: 0, code: 'VIVOSSPK13', name: 'VIVOS - Nữ Hà Nội (Dịu dàng)', gender: 'female', region: 'Bắc', description: 'Giọng nữ chuẩn Hà Nội, trong trẻo và dịu dàng' },
  { id: 'piper:vivos:1', speakerId: 1, code: 'VIVOSSPK14', name: 'VIVOS - Nam Hà Nội (Trầm ấm)', gender: 'male', region: 'Bắc', description: 'Giọng nam thanh lịch Hà Nội, trầm ấm, truyền cảm' },
  { id: 'piper:vivos:2', speakerId: 2, code: 'VIVOSSPK15', name: 'VIVOS - Nữ Sài Gòn (Ngọt ngào)', gender: 'female', region: 'Nam', description: 'Giọng nữ Nam Bộ tươi trẻ, ngọt ngào, tự nhiên' },
  { id: 'piper:vivos:3', speakerId: 3, code: 'VIVOSSPK16', name: 'VIVOS - Nam Sài Gòn (Lịch lãm)', gender: 'male', region: 'Nam', description: 'Giọng nam Sài Gòn đĩnh đạc, rõ ràng, hiện đại' },
  { id: 'piper:vivos:4', speakerId: 4, code: 'VIVOSSPK17', name: 'VIVOS - Nữ Huế (Nhẹ nhàng)', gender: 'female', region: 'Trung', description: 'Giọng nữ Cố đô Huế nhẹ nhàng, sâu lắng' },
  { id: 'piper:vivos:5', speakerId: 5, code: 'VIVOSSPK18', name: 'VIVOS - Nam Đà Nẵng (Hào sảng)', gender: 'male', region: 'Trung', description: 'Giọng nam miền Trung hào sảng, vang và rõ nét' },
  { id: 'piper:vivos:6', speakerId: 6, code: 'VIVOSSPK19', name: 'VIVOS - Nữ Bắc Ninh (Thanh thoát)', gender: 'female', region: 'Bắc', description: 'Giọng nữ Kinh Bắc mượt mà, thanh thoát' },
  { id: 'piper:vivos:7', speakerId: 7, code: 'VIVOSSPK20', name: 'VIVOS - Nam Hải Phòng (Mạnh mẽ)', gender: 'male', region: 'Bắc', description: 'Giọng nam miền biển Bắc Bộ khoẻ khoắn, dứt khoát' },
  { id: 'piper:vivos:8', speakerId: 8, code: 'VIVOSSPK21', name: 'VIVOS - Nữ Miền Tây (Mộc mạc)', gender: 'female', region: 'Nam', description: 'Giọng nữ sông nước miền Tây thân thương, gần gũi' },
  { id: 'piper:vivos:9', speakerId: 9, code: 'VIVOSSPK22', name: 'VIVOS - Nam Cần Thơ (Ấm áp)', gender: 'male', region: 'Nam', description: 'Giọng nam Tây Đô trầm ổn, chất phác' },
  { id: 'piper:vivos:10', speakerId: 10, code: 'VIVOSSPK26', name: 'VIVOS - Nữ Hà Nội (Kể chuyện)', gender: 'female', region: 'Bắc', description: 'Giọng nữ truyền cảm, thích hợp đọc truyện văn học' },
  { id: 'piper:vivos:11', speakerId: 11, code: 'VIVOSSPK34', name: 'VIVOS - Nam Hà Nội (Phát thanh)', gender: 'male', region: 'Bắc', description: 'Giọng chuẩn phong cách thời sự truyền hình' },
  { id: 'piper:vivos:12', speakerId: 12, code: 'VIVOSSPK40', name: 'VIVOS - Nữ Quảng Nam (Thành thật)', gender: 'female', region: 'Trung', description: 'Giọng nữ xứ Quảng chân chất, mộc mạc' },
  { id: 'piper:vivos:13', speakerId: 13, code: 'VIVOSSPK41', name: 'VIVOS - Nam Nghệ An (Cương trực)', gender: 'male', region: 'Trung', description: 'Giọng nam xứ Nghệ rắn rỏi, rõ từng chữ' },
  { id: 'piper:vivos:14', speakerId: 14, code: 'VIVOSSPK42', name: 'VIVOS - Nữ Sài Gòn (Trẻ trung)', gender: 'female', region: 'Nam', description: 'Giọng nữ đô thị năng động, lưu loát' },
  { id: 'piper:vivos:15', speakerId: 15, code: 'VIVOSSPK43', name: 'VIVOS - Nam Sài Gòn (Điềm tĩnh)', gender: 'male', region: 'Nam', description: 'Giọng nam dẫn truyện điềm đạm, thư thái' },
  { id: 'piper:vivos:16', speakerId: 16, code: 'VIVOSSPK44', name: 'VIVOS - Nữ Hải Dương (Trong sáng)', gender: 'female', region: 'Bắc', description: 'Âm sắc trong sáng, thanh tú Bắc Bộ' },
  { id: 'piper:vivos:17', speakerId: 17, code: 'VIVOSSPK45', name: 'VIVOS - Nam Nam Định (Trầm hùng)', gender: 'male', region: 'Bắc', description: 'Giọng nam nội lực, thích hợp sách lịch sử' },
  { id: 'piper:vivos:18', speakerId: 18, code: 'VIVOSSPK46', name: 'VIVOS - Nữ Bình Dương (Duyên dáng)', gender: 'female', region: 'Nam', description: 'Giọng nữ duyên dáng, phát âm chuẩn Nam Bộ' },
  { id: 'piper:vivos:19', speakerId: 19, code: 'VIVOSSPK38', name: 'VIVOS - Nam Đồng Nai (Mộc mạc)', gender: 'male', region: 'Nam', description: 'Giọng nam trung thực, tự nhiên' },
  { id: 'piper:vivos:20', speakerId: 20, code: 'VIVOSSPK31', name: 'VIVOS - Nữ Hà Tĩnh (Sâu lắng)', gender: 'female', region: 'Trung', description: 'Âm điệu miền Trung đượm tình cảm' },
  { id: 'piper:vivos:21', speakerId: 21, code: 'VIVOSSPK35', name: 'VIVOS - Nam Quảng Bình (Chắc nịch)', gender: 'male', region: 'Trung', description: 'Giọng nam miền Trung kiên cường, rõ ràng' },
  { id: 'piper:vivos:22', speakerId: 22, code: 'VIVOSSPK01', name: 'VIVOS - Nữ Thái Bình (Truyền cảm)', gender: 'female', region: 'Bắc', description: 'Giọng đọc tiểu thuyết dịu dàng, lôi cuốn' },
  { id: 'piper:vivos:23', speakerId: 23, code: 'VIVOSSPK02', name: 'VIVOS - Nam Thái Nguyên (Chân thực)', gender: 'male', region: 'Bắc', description: 'Giọng nam trung tính, đều đặn dễ nghe' },
  { id: 'piper:vivos:24', speakerId: 24, code: 'VIVOSSPK03', name: 'VIVOS - Nữ Vĩnh Long (Êm ả)', gender: 'female', region: 'Nam', description: 'Giọng nữ êm đềm như khúc hát Nam Bộ' },
  { id: 'piper:vivos:25', speakerId: 25, code: 'VIVOSSPK04', name: 'VIVOS - Nam Tiền Giang (Hài hòa)', gender: 'male', region: 'Nam', description: 'Giọng nam miền Tiền Giang trầm nhẹ, ấm áp' },
  { id: 'piper:vivos:26', speakerId: 26, code: 'VIVOSSPK05', name: 'VIVOS - Nữ Thanh Hóa (Rành rọt)', gender: 'female', region: 'Bắc', description: 'Giọng nữ Bắc Trung Bộ dứt khoát, mạch lạc' },
  { id: 'piper:vivos:27', speakerId: 27, code: 'VIVOSSPK06', name: 'VIVOS - Nam Hưng Yên (Thanh lịch)', gender: 'male', region: 'Bắc', description: 'Giọng nam đồng bằng sông Hồng ấm áp' },
  { id: 'piper:vivos:28', speakerId: 28, code: 'VIVOSSPK07', name: 'VIVOS - Nữ An Giang (Thỏ thẻ)', gender: 'female', region: 'Nam', description: 'Giọng nữ thỏ thẻ nhẹ nhàng, rất hợp tản văn' },
  { id: 'piper:vivos:29', speakerId: 29, code: 'VIVOSSPK08', name: 'VIVOS - Nam Kiên Giang (Cởi mở)', gender: 'male', region: 'Nam', description: 'Giọng nam phóng khoáng miền biển đảo' },
  { id: 'piper:vivos:30', speakerId: 30, code: 'VIVOSSPK09', name: 'VIVOS - Nữ Nha Trang (Rộn ràng)', gender: 'female', region: 'Trung', description: 'Giọng nữ miền duyên hải tươi tắn, sáng rõ' },
  { id: 'piper:vivos:31', speakerId: 31, code: 'VIVOSSPK10', name: 'VIVOS - Nam Quy Nhơn (Chân chất)', gender: 'male', region: 'Trung', description: 'Giọng nam Bình Định trung hậu, đĩnh đạc' },
  { id: 'piper:vivos:32', speakerId: 32, code: 'VIVOSSPK11', name: 'VIVOS - Nữ Phú Thọ (Thảo hiền)', gender: 'female', region: 'Bắc', description: 'Giọng nữ vùng đất Tổ dịu hiền, mượt mà' },
  { id: 'piper:vivos:33', speakerId: 33, code: 'VIVOSSPK12', name: 'VIVOS - Nam Vĩnh Phúc (Vững chãi)', gender: 'male', region: 'Bắc', description: 'Giọng nam ổn định, tốc độ đọc tự nhiên' },
  { id: 'piper:vivos:34', speakerId: 34, code: 'VIVOSSPK27', name: 'VIVOS - Nữ Bến Tre (Ngọt lành)', gender: 'female', region: 'Nam', description: 'Giọng nữ xứ dừa mến khách, ngọt ngào' },
  { id: 'piper:vivos:35', speakerId: 35, code: 'VIVOSSPK36', name: 'VIVOS - Nam Trà Vinh (Thâm tình)', gender: 'male', region: 'Nam', description: 'Giọng nam trầm đậm tình người phương Nam' },
  { id: 'piper:vivos:36', speakerId: 36, code: 'VIVOSSPK33', name: 'VIVOS - Nữ Hà Nội (Tri thức)', gender: 'female', region: 'Bắc', description: 'Giọng nữ chuẩn khoa học, thích hợp sách học thuật' },
  { id: 'piper:vivos:37', speakerId: 37, code: 'VIVOSSPK32', name: 'VIVOS - Nam Hà Nội (Học thức)', gender: 'male', region: 'Bắc', description: 'Giọng nam từ tốn, thích hợp sách kinh tế' },
  { id: 'piper:vivos:38', speakerId: 38, code: 'VIVOSSPK29', name: 'VIVOS - Nữ Sóc Trăng (Dịu hiền)', gender: 'female', region: 'Nam', description: 'Giọng nữ êm ái, ru hồn người nghe' },
  { id: 'piper:vivos:39', speakerId: 39, code: 'VIVOSSPK39', name: 'VIVOS - Nam Bạc Liêu (Phóng khoáng)', gender: 'male', region: 'Nam', description: 'Giọng nam hào hiệp phương Nam' },
  { id: 'piper:vivos:40', speakerId: 40, code: 'VIVOSSPK25', name: 'VIVOS - Nữ Quảng Trị (Chân tình)', gender: 'female', region: 'Trung', description: 'Giọng nữ miền Trung đầy xúc cảm' },
  { id: 'piper:vivos:41', speakerId: 41, code: 'VIVOSSPK28', name: 'VIVOS - Nam Quảng Ngãi (Khỏe khoắn)', gender: 'male', region: 'Trung', description: 'Giọng nam rõ tiếng, âm vang' },
  { id: 'piper:vivos:42', speakerId: 42, code: 'VIVOSSPK30', name: 'VIVOS - Nữ Bắc Giang (Thanh thản)', gender: 'female', region: 'Bắc', description: 'Giọng nữ thanh thoát, bình yên' },
  { id: 'piper:vivos:43', speakerId: 43, code: 'VIVOSSPK37', name: 'VIVOS - Nam Lạng Sơn (Ấm áp)', gender: 'male', region: 'Bắc', description: 'Giọng nam vùng cao ấm cúng, chân thành' },
  { id: 'piper:vivos:44', speakerId: 44, code: 'VIVOSSPK23', name: 'VIVOS - Nữ Cà Mau (Đằm thắm)', gender: 'female', region: 'Nam', description: 'Giọng nữ cuối trời Tổ quốc đằm thắm' },
  { id: 'piper:vivos:45', speakerId: 45, code: 'VIVOSSPK24', name: 'VIVOS - Nam Hậu Giang (Bác ái)', gender: 'male', region: 'Nam', description: 'Giọng nam đôn hậu, từ tốn' },
  { id: 'piper:vivos:46', speakerId: 46, code: 'VIVOSDEV02', name: 'VIVOS - Nữ Hà Nội (Thơ mộng)', gender: 'female', region: 'Bắc', description: 'Giọng nữ ngâm thơ, đọc tản văn lắng đọng' },
  { id: 'piper:vivos:47', speakerId: 47, code: 'VIVOSDEV03', name: 'VIVOS - Nam Hà Nội (Súc tích)', gender: 'male', region: 'Bắc', description: 'Giọng nam gãy gọn, truyền cảm hứng' },
  { id: 'piper:vivos:48', speakerId: 48, code: 'VIVOSDEV01', name: 'VIVOS - Nữ Sài Gòn (Thời thượng)', gender: 'female', region: 'Nam', description: 'Giọng nữ hiện đại, phát âm chuẩn' },
  { id: 'piper:vivos:49', speakerId: 49, code: 'VIVOSDEV04', name: 'VIVOS - Nam Sài Gòn (Thân thiện)', gender: 'male', region: 'Nam', description: 'Giọng nam dễ mến, lôi cuốn' },
  { id: 'piper:vivos:50', speakerId: 50, code: 'VIVOSDEV05', name: 'VIVOS - Nữ Huế (Hoàng cung)', gender: 'female', region: 'Trung', description: 'Giọng nữ chuẩn ngữ điệu sông Hương núi Ngự' },
  { id: 'piper:vivos:51', speakerId: 51, code: 'VIVOSDEV06', name: 'VIVOS - Nam Đà Lạt (Sương mờ)', gender: 'male', region: 'Trung', description: 'Giọng nam lãng đãng phố núi, trầm tĩnh' },
  { id: 'piper:vivos:52', speakerId: 52, code: 'VIVOSDEV07', name: 'VIVOS - Nữ Ninh Bình (Duyên quê)', gender: 'female', region: 'Bắc', description: 'Giọng nữ mộc mạc vùng Cố đô Hoa Lư' },
  { id: 'piper:vivos:53', speakerId: 53, code: 'VIVOSDEV08', name: 'VIVOS - Nam Tuyên Quang (Khởi sắc)', gender: 'male', region: 'Bắc', description: 'Giọng nam tươi trẻ, năng lượng' },
  { id: 'piper:vivos:54', speakerId: 54, code: 'VIVOSDEV09', name: 'VIVOS - Nữ Long An (Mượt mà)', gender: 'female', region: 'Nam', description: 'Giọng nữ Vàm Cỏ Đông tha thiết' },
  { id: 'piper:vivos:55', speakerId: 55, code: 'VIVOSDEV10', name: 'VIVOS - Nam Bình Phước (Chân quê)', gender: 'male', region: 'Nam', description: 'Giọng nam miền Đông Nam Bộ khoẻ khoắn' },
  { id: 'piper:vivos:56', speakerId: 56, code: 'VIVOSDEV11', name: 'VIVOS - Nữ Phú Yên (Êm đềm)', gender: 'female', region: 'Trung', description: 'Giọng nữ duyên dáng xứ hoa vàng cỏ xanh' },
  { id: 'piper:vivos:57', speakerId: 57, code: 'VIVOSDEV12', name: 'VIVOS - Nam Khánh Hòa (Biển xanh)', gender: 'male', region: 'Trung', description: 'Giọng nam trầm ấm xứ trầm hương' },
  { id: 'piper:vivos:58', speakerId: 58, code: 'VIVOSDEV13', name: 'VIVOS - Nữ Hà Nam (Hiền thục)', gender: 'female', region: 'Bắc', description: 'Giọng nữ Bắc Bộ thuần hậu, tự nhiên' },
  { id: 'piper:vivos:59', speakerId: 59, code: 'VIVOSDEV14', name: 'VIVOS - Nam Hòa Bình (Ấm áp)', gender: 'male', region: 'Bắc', description: 'Giọng nam núi rừng Tây Bắc đôn hậu' },
  { id: 'piper:vivos:60', speakerId: 60, code: 'VIVOSDEV15', name: 'VIVOS - Nữ Tây Ninh (Trong vắt)', gender: 'female', region: 'Nam', description: 'Giọng nữ chân phương miền Đông' },
  { id: 'piper:vivos:61', speakerId: 61, code: 'VIVOSDEV16', name: 'VIVOS - Nam Bà Rịa (Mạnh mẽ)', gender: 'male', region: 'Nam', description: 'Giọng nam dày dặn, quyết đoán' },
  { id: 'piper:vivos:62', speakerId: 62, code: 'VIVOSDEV17', name: 'VIVOS - Nữ Kon Tum (Núi rừng)', gender: 'female', region: 'Trung', description: 'Giọng nữ Tây Nguyên mộc mạc, trong trẻo' },
  { id: 'piper:vivos:63', speakerId: 63, code: 'VIVOSDEV18', name: 'VIVOS - Nam Gia Lai (Cao nguyên)', gender: 'male', region: 'Trung', description: 'Giọng nam phố núi bộc trực, phóng khoáng' },
  { id: 'piper:vivos:64', speakerId: 64, code: 'VIVOSDEV19', name: 'VIVOS - Nữ Đắk Lắk (Nồng nàn)', gender: 'female', region: 'Trung', description: 'Giọng nữ nồng nàn như hương cà phê Ban Mê' },
];

/**
 * Check if vi_VN-vivos-x_low model files exist in OPFS storage
 */
export async function checkModelReady(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && 'storage' in navigator && navigator.storage.getDirectory) {
      const root = await navigator.storage.getDirectory();
      try {
        const dir = await root.getDirectoryHandle('piper', { create: false });
        const onnxHandle = await dir.getFileHandle('vi_VN-vivos-x_low.onnx');
        const jsonHandle = await dir.getFileHandle('vi_VN-vivos-x_low.onnx.json');
        const onnxFile = await onnxHandle.getFile();
        const jsonFile = await jsonHandle.getFile();
        // Model file must be around 27.8MB and json > 1KB
        if (onnxFile.size > 20_000_000 && jsonFile.size > 1_000) {
          return true;
        }
      } catch {
        // File handles not found in OPFS
      }
    }

    // Fallback check via piper-tts-web stored()
    const storedModels = await stored();
    return storedModels.includes(PIPER_MODEL_ID);
  } catch (err) {
    console.warn('[PiperService] Error checking model ready state:', err);
    return false;
  }
}

/**
 * Download vi_VN-vivos-x_low model and save permanently in OPFS
 */
export async function downloadModel(onProgress?: (percent: number) => void): Promise<void> {
  try {
    await download(PIPER_MODEL_ID, (progress) => {
      if (progress.total > 0 && onProgress) {
        const percent = Math.min(100, Math.round((progress.loaded / progress.total) * 100));
        onProgress(percent);
      }
    });

    if (onProgress) {
      onProgress(100);
    }
  } catch (error) {
    console.error('[PiperService] Failed to download model:', error);
    throw error;
  }
}

/**
 * Delete cached model from OPFS to free user device storage
 */
export async function deleteModel(): Promise<void> {
  try {
    await remove(PIPER_MODEL_ID);
  } catch (err) {
    console.error('[PiperService] Error removing model:', err);
    throw err;
  }
}

/**
 * Synthesize Vietnamese text using Piper Neural VITS model
 * Output: Standard audio/x-wav Blob playable in HTML5 <audio>
 */
export async function synthesize(text: string, speakerId: number = 0): Promise<Blob> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Không có nội dung văn bản để đọc.');
  }

  const isReady = await checkModelReady();
  if (!isReady) {
    throw new Error('Mô hình AI chưa được tải về. Vui lòng tải mô hình trước khi nghe giọng Neural.');
  }

  // Predict using piper-tts-web with speakerId
  return await predict({
    voiceId: PIPER_MODEL_ID,
    text: trimmed,
    speakerId,
  });
}

export const CODE_TO_SPEAKER_ID: Record<string, number> = {
  VIVOSSPK13: 0,
  VIVOSSPK14: 1,
  VIVOSSPK15: 2,
  VIVOSSPK16: 3,
  VIVOSSPK17: 4,
  VIVOSSPK18: 5,
  VIVOSSPK19: 6,
  VIVOSSPK20: 7,
  VIVOSSPK21: 8,
  VIVOSSPK22: 9,
  VIVOSSPK26: 10,
  VIVOSSPK34: 11,
  VIVOSSPK40: 12,
  VIVOSSPK41: 13,
  VIVOSSPK42: 14,
  VIVOSSPK43: 15,
  VIVOSSPK44: 16,
  VIVOSSPK45: 17,
  VIVOSSPK46: 18,
  VIVOSSPK38: 19,
  VIVOSSPK31: 20,
  VIVOSSPK35: 21,
  VIVOSSPK01: 22,
  VIVOSSPK02: 23,
  VIVOSSPK03: 24,
  VIVOSSPK04: 25,
  VIVOSSPK05: 26,
  VIVOSSPK06: 27,
  VIVOSSPK07: 28,
  VIVOSSPK08: 29,
  VIVOSSPK09: 30,
  VIVOSSPK10: 31,
  VIVOSSPK11: 32,
  VIVOSSPK12: 33,
  VIVOSSPK27: 34,
  VIVOSSPK36: 35,
  VIVOSSPK33: 36,
  VIVOSSPK32: 37,
  VIVOSSPK29: 38,
  VIVOSSPK39: 39,
  VIVOSSPK25: 40,
  VIVOSSPK28: 41,
  VIVOSSPK30: 42,
  VIVOSSPK37: 43,
  VIVOSSPK23: 44,
  VIVOSSPK24: 45,
  VIVOSDEV02: 46,
  VIVOSDEV03: 47,
  VIVOSDEV01: 48,
  VIVOSDEV04: 49,
  VIVOSDEV05: 50,
  VIVOSDEV06: 51,
  VIVOSDEV07: 52,
  VIVOSDEV08: 53,
  VIVOSDEV09: 54,
  VIVOSDEV10: 55,
  VIVOSDEV11: 56,
  VIVOSDEV12: 57,
  VIVOSDEV13: 58,
  VIVOSDEV14: 59,
  VIVOSDEV15: 60,
  VIVOSDEV16: 61,
  VIVOSDEV17: 62,
  VIVOSDEV18: 63,
  VIVOSDEV19: 64,
};

/**
 * Helper to get Vivos voice metadata by speaker ID
 */
export function getVoiceBySpeakerId(speakerId: number): VivosVoice | undefined {
  return VIVOS_VOICES.find((v) => v.speakerId === speakerId);
}

/**
 * Helper to get Vivos voice by URI ID (e.g. 'piper:vivos:14' or 'piper:vivos:VIVOSSPK14')
 */
export function getVoiceById(id: string): VivosVoice | undefined {
  const speakerId = parseSpeakerIdFromURI(id);
  return VIVOS_VOICES.find((v) => v.id === id || v.code === id || v.speakerId === speakerId);
}

/**
 * Parse speakerId from voice URI or code (e.g. 'piper:vivos:14' -> 14, 'piper:vivos:VIVOSSPK14' -> 1)
 */
export function parseSpeakerIdFromURI(uri: string): number {
  if (!uri) return 0;
  const lastPart = uri.includes(':') ? uri.split(':').pop()! : uri;
  if (lastPart in CODE_TO_SPEAKER_ID) {
    return CODE_TO_SPEAKER_ID[lastPart];
  }
  const num = parseInt(lastPart, 10);
  return isNaN(num) ? 0 : Math.max(0, Math.min(64, num));
}
