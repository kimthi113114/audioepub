import React, { useState, useMemo } from 'react';
import {
  Modal,
  Tabs,
  List,
  Button,
  Tag,
  Typography,
  Space,
  Input,
  Alert,
  Tooltip,
  Card,
  Progress,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckOutlined,
  CustomerServiceOutlined,
  WomanOutlined,
  ManOutlined,
  AppleOutlined,
  WindowsOutlined,
  AndroidOutlined,
  SoundOutlined,
  StarFilled,
  GlobalOutlined,
  LoadingOutlined,
  ThunderboltFilled,
  CloudDownloadOutlined,
  CheckCircleFilled,
  FireFilled,
} from '@ant-design/icons';
import { useSettingsStore } from '../store/useSettingsStore';
import { formatVoiceInfo } from '../utils/voiceHelper';
import { EDGE_VOICES, type EdgeVoice } from '../services/edgeTTSService';
import { KOKORO_VOICES, type KokoroVoiceItem } from '../services/kokoroClientService';
import { getVieNeuVoices, type VieNeuVoiceItem } from '../services/vieneuService';
import { TTSServerSetting } from './TTSServerSetting';
import { VieNeuModeSwitch } from './VieNeuModeSwitch';
import { VttsPanel } from './VttsPanel';

const { Text } = Typography;

interface VoiceModalProps {
  open: boolean;
  onClose: () => void;
  voices: SpeechSynthesisVoice[];
  vietnameseVoices: SpeechSynthesisVoice[];
  onPreviewVoice: (voiceURI: string, sampleText?: string) => void;
  isKokoroReady?: boolean;
  kokoroProgress?: number;
  isDownloadingKokoro?: boolean;
  onDownloadKokoroModel?: (onProgress?: (percent: number) => void) => Promise<void>;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  open,
  onClose,
  voices,
  vietnameseVoices,
  onPreviewVoice,
  isKokoroReady = false,
  kokoroProgress = 0,
  isDownloadingKokoro = false,
  onDownloadKokoroModel,
}) => {
  const {
    selectedVoiceURI,
    setSelectedVoiceURI,
    setTtsEngine,
    setEngineMode,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<string>('edge');
  const [previewingURI, setPreviewingURI] = useState<string | null>(null);

  // Search filter states
  const [edgeSearch, setEdgeSearch] = useState<string>('');
  const [kokoroSearch, setKokoroSearch] = useState<string>('');
  const [vieneuSearch, setVieNeuSearch] = useState<string>('');
  const [systemSearch, setSystemSearch] = useState<string>('');

  // Filter Edge Studio Voices
  const filteredEdgeVoices = useMemo(() => {
    if (!edgeSearch.trim()) return EDGE_VOICES;
    const q = edgeSearch.toLowerCase().trim();
    return EDGE_VOICES.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.region.toLowerCase().includes(q) ||
        v.badge.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q)
    );
  }, [edgeSearch]);

  // Filter Kokoro Voices
  const filteredKokoroVoices = useMemo(() => {
    if (!kokoroSearch.trim()) return KOKORO_VOICES;
    const q = kokoroSearch.toLowerCase().trim();
    return KOKORO_VOICES.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.region.toLowerCase().includes(q) ||
        v.badge.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q)
    );
  }, [kokoroSearch]);

  // Filter VieNeu Voices
  const vieneuMode = useSettingsStore((st) => st.vieneuMode);
  const filteredVieNeuVoices = useMemo(() => {
    const all = getVieNeuVoices(vieneuMode);
    if (!vieneuSearch.trim()) return all;
    const q = vieneuSearch.toLowerCase().trim();
    return all.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.region.toLowerCase().includes(q) ||
        v.badge.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q)
    );
  }, [vieneuSearch, vieneuMode]);

  // Filter Web Speech voices
  const filteredSystemVNVoices = useMemo(() => {
    let list = vietnameseVoices;
    if (systemSearch.trim()) {
      const q = systemSearch.toLowerCase().trim();
      list = list.filter(
        (v) => v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const aIsStudio = /online|natural|neural|hoài|hoaimy|nam|namminh|linh|an/i.test(a.name) ? 1 : 0;
      const bIsStudio = /online|natural|neural|hoài|hoaimy|nam|namminh|linh|an/i.test(b.name) ? 1 : 0;
      return bIsStudio - aIsStudio;
    });
  }, [vietnameseVoices, systemSearch]);

  const otherVoices = useMemo(() => {
    const list = voices.filter((v) => !vietnameseVoices.includes(v));
    if (!systemSearch.trim()) return list;
    const q = systemSearch.toLowerCase().trim();
    return list.filter((v) => v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q));
  }, [voices, vietnameseVoices, systemSearch]);

  // Handle Preview Audio
  const handlePreviewEdgeVoice = (voice: EdgeVoice) => {
    setPreviewingURI(voice.id);
    const sample = voice.lang.startsWith('vi')
      ? `Xin chào! Tôi là ${voice.shortName}, giọng đọc AI Studio tự nhiên 24 kilô héc trên AudioEpub.`
      : `Hello! I am ${voice.shortName}, reading your audiobook with crystal clear studio quality.`;
    onPreviewVoice(voice.id, sample);

    setTimeout(() => {
      setPreviewingURI((current) => (current === voice.id ? null : current));
    }, 4500);
  };

  const handlePreviewKokoroVoice = (voice: KokoroVoiceItem) => {
    setPreviewingURI(voice.id);
    const sample = voice.id.includes('af_heart')
      ? `Hello! I am Heart from Kokoro-82M, running 100% inside your browser.`
      : `Xin chào! Tôi là ${voice.shortName}, giọng đọc Kokoro AI chạy trực tiếp 100% trên trình duyệt của bạn.`;
    onPreviewVoice(voice.id, sample);

    setTimeout(() => {
      setPreviewingURI((current) => (current === voice.id ? null : current));
    }, 4500);
  };

  const handlePreviewVieNeuVoice = (voice: VieNeuVoiceItem) => {
    setPreviewingURI(voice.id);
    const sample = `Xin chào! Tôi là ${voice.shortName}, giọng đọc VieNeu 48 kilô héc độ nét cao, truyền cảm hứng cho từng trang sách.`;
    onPreviewVoice(voice.id, sample);

    setTimeout(() => {
      setPreviewingURI((current) => (current === voice.id ? null : current));
    }, 4500);
  };

  const handlePreviewSystemVoice = (voice: SpeechSynthesisVoice) => {
    setPreviewingURI(voice.voiceURI);
    const info = formatVoiceInfo(voice);
    const sample = `Xin chào! Tôi là ${info.displayName}, giọng đọc trình duyệt trên AudioEpub.`;
    onPreviewVoice(voice.voiceURI, sample);

    setTimeout(() => {
      setPreviewingURI((current) => (current === voice.voiceURI ? null : current));
    }, 4000);
  };

  // Select Handlers
  const handleSelectEdgeVoice = (voice: EdgeVoice) => {
    setSelectedVoiceURI(voice.id);
    setTtsEngine('edge');
    setEngineMode('edge');
    message.success(`Đã chọn: ${voice.name}`);
    onClose();
  };

  const handleSelectKokoroVoice = (voice: KokoroVoiceItem) => {
    setSelectedVoiceURI(voice.id);
    setTtsEngine('kokoro');
    setEngineMode('kokoro');
    message.success(`Đã chọn: ${voice.name}`);
    onClose();
  };

  const handleSelectVieNeuVoice = (voice: VieNeuVoiceItem) => {
    setSelectedVoiceURI(voice.id);
    setTtsEngine('vieneu');
    setEngineMode('vieneu');
    message.success(`Đã chọn: ${voice.name}`);
    onClose();
  };

  const handleSelectSystemVoice = (voice: SpeechSynthesisVoice) => {
    setSelectedVoiceURI(voice.voiceURI);
    setTtsEngine('webspeech');
    setEngineMode('system');
    const info = formatVoiceInfo(voice);
    message.success(`Đã chọn: ${info.displayName}`);
    onClose();
  };

  const renderPlatformIcon = (voiceName: string) => {
    const lower = voiceName.toLowerCase();
    if (lower.includes('apple') || lower.includes('ios') || lower.includes('linh') || lower.includes('an')) {
      return <AppleOutlined style={{ color: '#000000', fontSize: 16 }} />;
    }
    if (lower.includes('microsoft') || lower.includes('windows') || lower.includes('natural')) {
      return <WindowsOutlined style={{ color: '#078d4', fontSize: 16 }} />;
    }
    if (lower.includes('google') || lower.includes('android')) {
      return <AndroidOutlined style={{ color: '#34a853', fontSize: 16 }} />;
    }
    return <SoundOutlined style={{ color: 'var(--muted)', fontSize: 16 }} />;
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1677ff 0%, #722ed1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--surface)',
              fontSize: 18,
            }}
          >
            <CustomerServiceOutlined />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--text)' }}>
              Trung Tâm Giọng Đọc Sách
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>
              Công nghệ TTS Đa Động Cơ • Studio Neural 24kHz • Kokoro WebGPU Client • VieNeu 48kHz
            </div>
          </div>
        </div>
      }
      width={760}
      styles={{
        body: { maxHeight: '74vh', overflowY: 'auto', paddingRight: 6 },
      }}
      destroyOnClose
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: 8 }}
        items={[
          // TAB 1: EDGE STUDIO NEURAL
          {
            key: 'edge',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                🌟 Giọng AI Studio (Khuyên dùng)
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Card
                  size="small"
                  style={{
                    background: 'linear-gradient(135deg, #f0f7ff 0%, #f9f0ff 100%)',
                    borderColor: '#adc6ff',
                    borderRadius: 10,
                  }}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <StarFilled style={{ color: '#faad14', fontSize: 16 }} />
                      <span style={{ fontWeight: 600, color: '#1d39c4', fontSize: 14 }}>
                        Microsoft Studio Neural (24kHz HD Audio)
                      </span>
                      <Tag color="cyan" style={{ borderRadius: 10, fontWeight: 600 }}>
                        0MB Download
                      </Tag>
                      <Tag color="green" style={{ borderRadius: 10, fontWeight: 600 }}>
                        100% Miễn Phí
                      </Tag>
                    </div>
                    <Text style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Công nghệ tổng hợp âm thanh giọng nói thế hệ mới: Đọc truyền cảm, ngắt nghỉ đúng ngữ điệu dấu câu tiếng Việt, không bị rè hoặc mất dấu. Hỗ trợ chạy ngầm mượt mà trên iPhone, Android và Máy tính.
                    </Text>
                  </Space>
                </Card>

                <TTSServerSetting />

                <Input.Search
                  placeholder="Tìm kiếm giọng đọc (Hoài My, Nam Minh, Jenny, Bắc, Nam...)"
                  allowClear
                  value={edgeSearch}
                  onChange={(e) => setEdgeSearch(e.target.value)}
                  style={{ borderRadius: 8 }}
                />

                <List
                  dataSource={filteredEdgeVoices}
                  renderItem={(voice) => {
                    const isSelected = selectedVoiceURI === voice.id;
                    const isPreviewing = previewingURI === voice.id;

                    return (
                      <List.Item
                        key={voice.id}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 10,
                          marginBottom: 8,
                          background: isSelected ? 'var(--primary-soft)' : 'var(--surface-alt)',
                          border: isSelected ? '1.5px solid var(--primary)' : '1px solid #f1f5f9',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            gap: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: '50%',
                                background: voice.gender === 'female' ? '#fff0f6' : 'var(--primary-soft)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: `1.5px solid ${voice.gender === 'female' ? '#ffadd2' : '#91caff'}`,
                              }}
                            >
                              {voice.gender === 'female' ? (
                                <WomanOutlined style={{ color: '#eb2f96', fontSize: 20 }} />
                              ) : (
                                <ManOutlined style={{ color: 'var(--primary)', fontSize: 20 }} />
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                                  {voice.name}
                                </span>
                                {voice.isRecommended && (
                                  <Tag color="gold" style={{ borderRadius: 8, fontWeight: 600 }}>
                                    Khuyên dùng
                                  </Tag>
                                )}
                                <Tag color={voice.color} style={{ borderRadius: 8, fontWeight: 500 }}>
                                  {voice.badge}
                                </Tag>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.4 }}>
                                {voice.description}
                              </div>
                            </div>
                          </div>

                          <Space size={8} style={{ flexShrink: 0 }}>
                            <Tooltip title="Nghe thử đoạn mẫu">
                              <Button
                                size="middle"
                                icon={isPreviewing ? <LoadingOutlined /> : <PlayCircleOutlined />}
                                onClick={() => handlePreviewEdgeVoice(voice)}
                                loading={isPreviewing}
                                style={{ borderRadius: 6 }}
                              >
                                Nghe thử
                              </Button>
                            </Tooltip>

                            <Button
                              type={isSelected ? 'primary' : 'default'}
                              size="middle"
                              icon={isSelected ? <CheckOutlined /> : undefined}
                              onClick={() => handleSelectEdgeVoice(voice)}
                              style={{ borderRadius: 6, fontWeight: 600, minWidth: 100 }}
                            >
                              {isSelected ? 'Đang chọn' : 'Chọn giọng'}
                            </Button>
                          </Space>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              </div>
            ),
          },

          // TAB 2: KOKORO TTS (100% CLIENT-SIDE WEBGPU/WASM)
          {
            key: 'kokoro',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                🌸 Kokoro AI (100% Client-side)
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Card
                  size="small"
                  style={{
                    background: 'linear-gradient(135deg, #fff0f6 0%, #f6ffed 100%)',
                    borderColor: '#ffadd2',
                    borderRadius: 10,
                  }}
                >
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ThunderboltFilled style={{ color: '#eb2f96', fontSize: 18 }} />
                        <span style={{ fontWeight: 700, color: '#c41d7f', fontSize: 14 }}>
                          Kokoro-82M ONNX (100% In-Browser WebGPU)
                        </span>
                      </div>
                      <Space size={6}>
                        {isKokoroReady ? (
                          <Tag icon={<CheckCircleFilled />} color="success" style={{ fontWeight: 600, borderRadius: 10 }}>
                            Đã sẵn sàng trên máy (WebGPU)
                          </Tag>
                        ) : (
                          <Tag color="magenta" style={{ fontWeight: 600, borderRadius: 10 }}>
                            Mô hình ~85MB
                          </Tag>
                        )}
                        <Tag color="blue" style={{ borderRadius: 10 }}>
                          Chạy Offline 100%
                        </Tag>
                      </Space>
                    </div>

                    <Text style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Công nghệ WebGPU/WASM đưa trí tuệ nhân tạo chạy hoàn toàn bên trong trình duyệt máy khách (Client-side). Không gửi văn bản ra ngoài máy chủ, hoàn toàn riêng tư, đọc sách ngay cả khi máy bay không có mạng internet.
                    </Text>

                    {/* Download Card if not downloaded */}
                    {!isKokoroReady && (
                      <div
                        style={{
                          marginTop: 6,
                          padding: '10px 14px',
                          background: 'var(--surface)',
                          borderRadius: 8,
                          border: '1px solid #ffd6e7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#c41d7f' }}>
                            Tải mô hình Kokoro (~85MB) về trình duyệt
                          </div>
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                            Chỉ tải một lần duy nhất, mô hình được lưu vĩnh viễn trong CacheStorage.
                          </div>
                          {isDownloadingKokoro && (
                            <Progress
                              percent={kokoroProgress}
                              size="small"
                              status="active"
                              strokeColor={{ from: '#eb2f96', to: '#722ed1' }}
                              style={{ marginTop: 6 }}
                            />
                          )}
                        </div>

                        <Button
                          type="primary"
                          icon={isDownloadingKokoro ? <LoadingOutlined /> : <CloudDownloadOutlined />}
                          loading={isDownloadingKokoro}
                          onClick={() => {
                            if (onDownloadKokoroModel) {
                              onDownloadKokoroModel().then(() => {
                                message.success('Đã nạp xong mô hình Kokoro vào máy!');
                              }).catch(() => {
                                message.error('Không thể tải mô hình Kokoro. Vui lòng thử lại!');
                              });
                            }
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #eb2f96 0%, #722ed1 100%)',
                            border: 'none',
                            fontWeight: 600,
                            borderRadius: 6,
                          }}
                        >
                          {isDownloadingKokoro ? `Đang tải ${kokoroProgress}%` : 'Tải mô hình (85MB)'}
                        </Button>
                      </div>
                    )}
                  </Space>
                </Card>

                <Input.Search
                  placeholder="Tìm kiếm giọng Kokoro (Diễm Trinh, Mai Linh, Hưng Thịnh...)"
                  allowClear
                  value={kokoroSearch}
                  onChange={(e) => setKokoroSearch(e.target.value)}
                  style={{ borderRadius: 8 }}
                />

                <List
                  dataSource={filteredKokoroVoices}
                  renderItem={(voice) => {
                    const isSelected = selectedVoiceURI === voice.id;
                    const isPreviewing = previewingURI === voice.id;

                    return (
                      <List.Item
                        key={voice.id}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 10,
                          marginBottom: 8,
                          background: isSelected ? '#fff0f6' : 'var(--surface-alt)',
                          border: isSelected ? '1.5px solid #eb2f96' : '1px solid #f1f5f9',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            gap: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: '50%',
                                background: voice.gender === 'female' ? '#fff0f6' : 'var(--primary-soft)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: `1.5px solid ${voice.gender === 'female' ? '#ffadd2' : '#91caff'}`,
                              }}
                            >
                              {voice.gender === 'female' ? (
                                <WomanOutlined style={{ color: '#eb2f96', fontSize: 20 }} />
                              ) : (
                                <ManOutlined style={{ color: 'var(--primary)', fontSize: 20 }} />
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                                  {voice.name}
                                </span>
                                {voice.isRecommended && (
                                  <Tag color="magenta" style={{ borderRadius: 8, fontWeight: 600 }}>
                                    Khuyên dùng
                                  </Tag>
                                )}
                                <Tag color={voice.color} style={{ borderRadius: 8, fontWeight: 500 }}>
                                  {voice.badge}
                                </Tag>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.4 }}>
                                {voice.description}
                              </div>
                            </div>
                          </div>

                          <Space size={8} style={{ flexShrink: 0 }}>
                            <Tooltip title="Nghe thử đoạn mẫu">
                              <Button
                                size="middle"
                                icon={isPreviewing ? <LoadingOutlined /> : <PlayCircleOutlined />}
                                onClick={() => handlePreviewKokoroVoice(voice)}
                                loading={isPreviewing}
                                style={{ borderRadius: 6 }}
                              >
                                Nghe thử
                              </Button>
                            </Tooltip>

                            <Button
                              type={isSelected ? 'primary' : 'default'}
                              size="middle"
                              icon={isSelected ? <CheckOutlined /> : undefined}
                              onClick={() => handleSelectKokoroVoice(voice)}
                              style={{
                                borderRadius: 6,
                                fontWeight: 600,
                                minWidth: 100,
                                background: isSelected ? '#eb2f96' : undefined,
                                borderColor: isSelected ? '#eb2f96' : undefined,
                              }}
                            >
                              {isSelected ? 'Đang chọn' : 'Chọn giọng'}
                            </Button>
                          </Space>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              </div>
            ),
          },

          // TAB 3: VIENEU-TTS (48KHZ ULTRA HD)
          {
            key: 'vieneu',
            label: (
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                🚀 VieNeu-TTS (48kHz Ultra HD)
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Card
                  size="small"
                  style={{
                    background: 'linear-gradient(135deg, #e6fffb 0%, #f0f5ff 100%)',
                    borderColor: '#87e8de',
                    borderRadius: 10,
                  }}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FireFilled style={{ color: '#13c2c2', fontSize: 18 }} />
                      <span style={{ fontWeight: 700, color: '#006d75', fontSize: 14 }}>
                        VieNeu-TTS (48kHz Studio Master Audio)
                      </span>
                      <Tag color="cyan" style={{ borderRadius: 10, fontWeight: 600 }}>
                        Độ phân giải 48kHz
                      </Tag>
                      <Tag color="geekblue" style={{ borderRadius: 10, fontWeight: 600 }}>
                        Ngữ điệu biểu cảm
                      </Tag>
                    </div>
                    <Text style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Công nghệ tổng hợp giọng nói tiếng Việt độ phân giải 48kHz cao nhất hiện nay, mô phỏng chính xác thanh điệu, dấu câu và cảm xúc người đọc sách chuyên nghiệp. Hỗ trợ hàng đợi Lookahead đệm trước câu tiếp theo với độ trễ chuyển đổi 0ms.
                    </Text>
                  </Space>
                </Card>

                <VieNeuModeSwitch />

                <Input.Search
                  placeholder="Tìm kiếm giọng VieNeu (Mai Anh, Thiện Minh, Ngọc Huyền...)"
                  allowClear
                  value={vieneuSearch}
                  onChange={(e) => setVieNeuSearch(e.target.value)}
                  style={{ borderRadius: 8 }}
                />

                <List
                  dataSource={filteredVieNeuVoices}
                  renderItem={(voice) => {
                    const isSelected = selectedVoiceURI === voice.id;
                    const isPreviewing = previewingURI === voice.id;

                    return (
                      <List.Item
                        key={voice.id}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 10,
                          marginBottom: 8,
                          background: isSelected ? '#e6fffb' : 'var(--surface-alt)',
                          border: isSelected ? '1.5px solid #13c2c2' : '1px solid #f1f5f9',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            gap: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: '50%',
                                background: voice.gender === 'female' ? '#fff0f6' : 'var(--primary-soft)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: `1.5px solid ${voice.gender === 'female' ? '#ffadd2' : '#91caff'}`,
                              }}
                            >
                              {voice.gender === 'female' ? (
                                <WomanOutlined style={{ color: '#eb2f96', fontSize: 20 }} />
                              ) : (
                                <ManOutlined style={{ color: 'var(--primary)', fontSize: 20 }} />
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                                  {voice.name}
                                </span>
                                {voice.isRecommended && (
                                  <Tag color="cyan" style={{ borderRadius: 8, fontWeight: 600 }}>
                                    Khuyên dùng
                                  </Tag>
                                )}
                                <Tag color={voice.color} style={{ borderRadius: 8, fontWeight: 500 }}>
                                  {voice.badge}
                                </Tag>
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.4 }}>
                                {voice.description}
                              </div>
                            </div>
                          </div>

                          <Space size={8} style={{ flexShrink: 0 }}>
                            <Tooltip title="Nghe thử đoạn mẫu">
                              <Button
                                size="middle"
                                icon={isPreviewing ? <LoadingOutlined /> : <PlayCircleOutlined />}
                                onClick={() => handlePreviewVieNeuVoice(voice)}
                                loading={isPreviewing}
                                style={{ borderRadius: 6 }}
                              >
                                Nghe thử
                              </Button>
                            </Tooltip>

                            <Button
                              type={isSelected ? 'primary' : 'default'}
                              size="middle"
                              icon={isSelected ? <CheckOutlined /> : undefined}
                              onClick={() => handleSelectVieNeuVoice(voice)}
                              style={{
                                borderRadius: 6,
                                fontWeight: 600,
                                minWidth: 100,
                                background: isSelected ? '#13c2c2' : undefined,
                                borderColor: isSelected ? '#13c2c2' : undefined,
                              }}
                            >
                              {isSelected ? 'Đang chọn' : 'Chọn giọng'}
                            </Button>
                          </Space>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              </div>
            ),
          },

          // TAB: V-TTS (runs in the browser, no server)
          {
            key: 'vtts',
            label: (
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                🧠 Trên máy: V-TTS
              </span>
            ),
            children: (
              <VttsPanel
                selectedVoiceURI={selectedVoiceURI}
                onSelect={(voice) => {
                  setSelectedVoiceURI(voice.id);
                  message.success(`Đã chọn: ${voice.name}`);
                  onClose();
                }}
                onPreview={(voice) => {
                  setPreviewingURI(voice.id);
                  onPreviewVoice(voice.id, `Xin chào! Tôi là ${voice.shortName}, giọng đọc V-TTS chạy ngay trên thiết bị của bạn.`);
                  setTimeout(() => setPreviewingURI((cur) => (cur === voice.id ? null : cur)), 6000);
                }}
              />
            ),
          },

          // TAB 4: SYSTEM WEB SPEECH VOICES
          {
            key: 'system',
            label: (
              <span style={{ fontSize: 14, fontWeight: 500 }}>
                📱 Giọng Trình Duyệt (Web Speech)
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Alert
                  type="info"
                  showIcon
                  message="Dự phòng Ngoại tuyến (Offline)"
                  description="Các giọng đọc tích hợp sẵn trên thiết bị của bạn. Sử dụng khi không có mạng internet hoặc ở chế độ tiết kiệm dữ liệu."
                  style={{ borderRadius: 8 }}
                />

                <Input.Search
                  placeholder="Tìm kiếm giọng trình duyệt..."
                  allowClear
                  value={systemSearch}
                  onChange={(e) => setSystemSearch(e.target.value)}
                  style={{ borderRadius: 8 }}
                />

                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--muted)',
                      marginBottom: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>🇻🇳 Giọng Tiếng Việt Trên Máy ({filteredSystemVNVoices.length})</span>
                  </div>

                  {filteredSystemVNVoices.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--muted)' }}>
                      Không tìm thấy giọng tiếng Việt nào trong hệ thống
                    </div>
                  ) : (
                    <List
                      dataSource={filteredSystemVNVoices}
                      renderItem={(voice) => {
                        const isSelected = selectedVoiceURI === voice.voiceURI;
                        const isPreviewing = previewingURI === voice.voiceURI;
                        const info = formatVoiceInfo(voice);

                        return (
                          <List.Item
                            key={voice.voiceURI}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 8,
                              marginBottom: 6,
                              background: isSelected ? 'var(--primary-soft)' : 'var(--surface-alt)',
                              border: isSelected ? '1.5px solid var(--primary)' : '1px solid #f1f5f9',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '100%',
                                gap: 10,
                              }}
                            >
                              <Space align="center" size={10} style={{ flex: 1, minWidth: 0 }}>
                                {renderPlatformIcon(voice.name)}
                                <div style={{ overflow: 'hidden' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>
                                      {info.displayName}
                                    </span>
                                    <Tag color={info.color} style={{ borderRadius: 6, fontSize: 11 }}>
                                      {info.badge}
                                    </Tag>
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                    {voice.name}
                                  </div>
                                </div>
                              </Space>

                              <Space size={6}>
                                <Button
                                  size="small"
                                  icon={isPreviewing ? <LoadingOutlined /> : <PlayCircleOutlined />}
                                  onClick={() => handlePreviewSystemVoice(voice)}
                                  loading={isPreviewing}
                                >
                                  Nghe thử
                                </Button>
                                <Button
                                  type={isSelected ? 'primary' : 'default'}
                                  size="small"
                                  icon={isSelected ? <CheckOutlined /> : undefined}
                                  onClick={() => handleSelectSystemVoice(voice)}
                                >
                                  {isSelected ? 'Đang chọn' : 'Chọn'}
                                </Button>
                              </Space>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  )}
                </div>

                {otherVoices.length > 0 && (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>
                      <GlobalOutlined style={{ marginRight: 6 }} /> Giọng Quốc Tế ({otherVoices.length})
                    </div>
                    <List
                      dataSource={otherVoices.slice(0, 20)}
                      renderItem={(voice) => {
                        const isSelected = selectedVoiceURI === voice.voiceURI;
                        const isPreviewing = previewingURI === voice.voiceURI;

                        return (
                          <List.Item
                            key={voice.voiceURI}
                            style={{
                              padding: '8px 12px',
                              borderRadius: 6,
                              marginBottom: 4,
                              background: isSelected ? 'var(--primary-soft)' : 'var(--surface-alt)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                              <Space size={8}>
                                {renderPlatformIcon(voice.name)}
                                <span>{voice.name}</span>
                                <Tag>{voice.lang}</Tag>
                              </Space>
                              <Space size={6}>
                                <Button
                                  size="small"
                                  icon={isPreviewing ? <LoadingOutlined /> : <PlayCircleOutlined />}
                                  onClick={() => handlePreviewSystemVoice(voice)}
                                  loading={isPreviewing}
                                />
                                <Button
                                  size="small"
                                  type={isSelected ? 'primary' : 'default'}
                                  onClick={() => handleSelectSystemVoice(voice)}
                                >
                                  {isSelected ? 'Đang chọn' : 'Chọn'}
                                </Button>
                              </Space>
                            </div>
                          </List.Item>
                        );
                      }}
                    />
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};
