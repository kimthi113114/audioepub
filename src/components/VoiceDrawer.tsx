import React, { useState, useMemo } from 'react';
import {
  Drawer,
  Tabs,
  List,
  Button,
  Tag,
  Typography,
  Space,
  Input,
  Alert,
  Card,
  Progress,
  message,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckOutlined,
  CustomerServiceFilled,
  WomanOutlined,
  ManOutlined,
  AppleOutlined,
  WindowsOutlined,
  AndroidOutlined,
  SoundOutlined,
  StarFilled,
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

const { Text } = Typography;

interface VoiceDrawerProps {
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

// Simple-first ordering: recommended, on-device, then advanced engines
const TAB_ORDER = ["edge", "system", "kokoro", "vieneu"];

export const VoiceDrawer: React.FC<VoiceDrawerProps> = ({
  open,
  onClose,
  voices: _voices,
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
    if (!systemSearch.trim()) return vietnameseVoices;
    const q = systemSearch.toLowerCase().trim();
    return vietnameseVoices.filter(
      (v) => v.name.toLowerCase().includes(q) || v.lang.toLowerCase().includes(q)
    );
  }, [vietnameseVoices, systemSearch]);

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
    <Drawer
      open={open}
      onClose={onClose}
      placement="bottom"
      height="78vh"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CustomerServiceFilled style={{ color: 'var(--primary)', fontSize: 18 }} />
          <span style={{ fontWeight: 700, fontSize: 16 }}>Chọn Giọng Đọc Sách</span>
        </div>
      }
      styles={{
        header: { padding: '12px 16px', borderBottom: '1px solid #f0f0f0' },
        body: { padding: '12px 14px', overflowY: 'auto' },
      }}
      rootStyle={{ borderRadius: '16px 16px 0 0' }}
      destroyOnClose
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        items={([
          // TAB 1: EDGE STUDIO NEURAL
          {
            key: 'edge',
            label: (
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                🌟 Khuyên dùng
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Card
                  size="small"
                  style={{
                    background: 'linear-gradient(135deg, #f0f7ff 0%, #f9f0ff 100%)',
                    borderColor: '#adc6ff',
                    borderRadius: 8,
                  }}
                >
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <StarFilled style={{ color: '#faad14', fontSize: 14 }} />
                      <span style={{ fontWeight: 600, color: '#1d39c4', fontSize: 13 }}>
                        Microsoft Studio Neural (24kHz HD)
                      </span>
                    </div>
                    <Text style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Giọng đọc tự nhiên chất lượng cao nhất, 0MB tải về, hỗ trợ chạy ngầm màn hình khóa iOS Safari.
                    </Text>
                  </Space>
                </Card>

                <TTSServerSetting />

                <Input.Search
                  placeholder="Tìm giọng (Hoài My, Nam Minh...)"
                  allowClear
                  value={edgeSearch}
                  onChange={(e) => setEdgeSearch(e.target.value)}
                  style={{ borderRadius: 6 }}
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
                          padding: '10px 12px',
                          borderRadius: 8,
                          marginBottom: 8,
                          background: isSelected ? 'var(--primary-soft)' : 'var(--surface-alt)',
                          border: isSelected ? '1.5px solid var(--primary)' : '1px solid #f1f5f9',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                background: voice.gender === 'female' ? '#fff0f6' : 'var(--primary-soft)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: `1px solid ${voice.gender === 'female' ? '#ffadd2' : '#91caff'}`,
                              }}
                            >
                              {voice.gender === 'female' ? (
                                <WomanOutlined style={{ color: '#eb2f96', fontSize: 18 }} />
                              ) : (
                                <ManOutlined style={{ color: 'var(--primary)', fontSize: 18 }} />
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                                  {voice.name}
                                </span>
                                <Tag color={voice.color} style={{ borderRadius: 6, fontSize: 10, padding: '0 4px' }}>
                                  {voice.region}
                                </Tag>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.3 }}>
                                {voice.description}
                              </div>
                            </div>
                          </div>

                          <Space size={6} style={{ flexShrink: 0 }}>
                            <Button
                              size="middle"
                              icon={isPreviewing ? <LoadingOutlined /> : <PlayCircleOutlined />}
                              onClick={() => handlePreviewEdgeVoice(voice)}
                              loading={isPreviewing}
                              style={{ minHeight: 38 }}
                            >
                              Thử
                            </Button>
                            <Button
                              type={isSelected ? 'primary' : 'default'}
                              size="middle"
                              icon={isSelected ? <CheckOutlined /> : undefined}
                              onClick={() => handleSelectEdgeVoice(voice)}
                              style={{ fontWeight: 600, minHeight: 38 }}
                            >
                              {isSelected ? 'Chọn' : 'Dùng'}
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

          // TAB 2: KOKORO TTS
          {
            key: 'kokoro',
            label: (
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                🌸 Nâng cao: Kokoro
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Card
                  size="small"
                  style={{
                    background: 'linear-gradient(135deg, #fff0f6 0%, #f6ffed 100%)',
                    borderColor: '#ffadd2',
                    borderRadius: 8,
                  }}
                >
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ThunderboltFilled style={{ color: '#eb2f96', fontSize: 16 }} />
                        <span style={{ fontWeight: 700, color: '#c41d7f', fontSize: 13 }}>
                          Kokoro-82M WebGPU (100% In-Browser)
                        </span>
                      </div>
                      {isKokoroReady && (
                        <Tag icon={<CheckCircleFilled />} color="success" style={{ fontSize: 10, margin: 0 }}>
                          Sẵn sàng
                        </Tag>
                      )}
                    </div>
                    <Text style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Chạy trực tiếp 100% trên trình duyệt điện thoại/máy tính qua WebGPU/WASM, không cần mạng internet.
                    </Text>

                    {!isKokoroReady && (
                      <div style={{ marginTop: 4 }}>
                        {isDownloadingKokoro && (
                          <Progress
                            percent={kokoroProgress}
                            size="small"
                            status="active"
                            strokeColor={{ from: '#eb2f96', to: '#722ed1' }}
                            style={{ marginBottom: 6 }}
                          />
                        )}
                        <Button
                          type="primary"
                          block
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
                            minHeight: 38,
                          }}
                        >
                          {isDownloadingKokoro ? `Đang tải ${kokoroProgress}%` : 'Tải mô hình Kokoro (~85MB)'}
                        </Button>
                      </div>
                    )}
                  </Space>
                </Card>

                <Input.Search
                  placeholder="Tìm giọng Kokoro (Diễm Trinh, Mai Linh...)"
                  allowClear
                  value={kokoroSearch}
                  onChange={(e) => setKokoroSearch(e.target.value)}
                  style={{ borderRadius: 6 }}
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
                          padding: '10px 12px',
                          borderRadius: 8,
                          marginBottom: 8,
                          background: isSelected ? '#fff0f6' : 'var(--surface-alt)',
                          border: isSelected ? '1.5px solid #eb2f96' : '1px solid #f1f5f9',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                background: voice.gender === 'female' ? '#fff0f6' : 'var(--primary-soft)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: `1px solid ${voice.gender === 'female' ? '#ffadd2' : '#91caff'}`,
                              }}
                            >
                              {voice.gender === 'female' ? (
                                <WomanOutlined style={{ color: '#eb2f96', fontSize: 18 }} />
                              ) : (
                                <ManOutlined style={{ color: 'var(--primary)', fontSize: 18 }} />
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                                  {voice.name}
                                </span>
                                <Tag color={voice.color} style={{ borderRadius: 6, fontSize: 10, padding: '0 4px' }}>
                                  {voice.region}
                                </Tag>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.3 }}>
                                {voice.description}
                              </div>
                            </div>
                          </div>

                          <Space size={6} style={{ flexShrink: 0 }}>
                            <Button
                              size="middle"
                              icon={isPreviewing ? <LoadingOutlined /> : <PlayCircleOutlined />}
                              onClick={() => handlePreviewKokoroVoice(voice)}
                              loading={isPreviewing}
                              style={{ minHeight: 38 }}
                            >
                              Thử
                            </Button>
                            <Button
                              type={isSelected ? 'primary' : 'default'}
                              size="middle"
                              icon={isSelected ? <CheckOutlined /> : undefined}
                              onClick={() => handleSelectKokoroVoice(voice)}
                              style={{
                                fontWeight: 600,
                                minHeight: 38,
                                background: isSelected ? '#eb2f96' : undefined,
                                borderColor: isSelected ? '#eb2f96' : undefined,
                              }}
                            >
                              {isSelected ? 'Chọn' : 'Dùng'}
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

          // TAB 3: VIENEU-TTS
          {
            key: 'vieneu',
            label: (
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                🚀 Nâng cao: VieNeu
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Card
                  size="small"
                  style={{
                    background: 'linear-gradient(135deg, #e6fffb 0%, #f0f5ff 100%)',
                    borderColor: '#87e8de',
                    borderRadius: 8,
                  }}
                >
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FireFilled style={{ color: '#13c2c2', fontSize: 16 }} />
                      <span style={{ fontWeight: 700, color: '#006d75', fontSize: 13 }}>
                        VieNeu-TTS (48kHz Master HD)
                      </span>
                    </div>
                    <Text style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Chất âm 48kHz trong trẻo, biểu cảm giọng nói tự nhiên hàng đầu cho sách nói tiếng Việt.
                    </Text>
                  </Space>
                </Card>

                <VieNeuModeSwitch />

                <Input.Search
                  placeholder="Tìm giọng VieNeu (Mai Anh, Thiện Minh...)"
                  allowClear
                  value={vieneuSearch}
                  onChange={(e) => setVieNeuSearch(e.target.value)}
                  style={{ borderRadius: 6 }}
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
                          padding: '10px 12px',
                          borderRadius: 8,
                          marginBottom: 8,
                          background: isSelected ? '#e6fffb' : 'var(--surface-alt)',
                          border: isSelected ? '1.5px solid #13c2c2' : '1px solid #f1f5f9',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                background: voice.gender === 'female' ? '#fff0f6' : 'var(--primary-soft)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                border: `1px solid ${voice.gender === 'female' ? '#ffadd2' : '#91caff'}`,
                              }}
                            >
                              {voice.gender === 'female' ? (
                                <WomanOutlined style={{ color: '#eb2f96', fontSize: 18 }} />
                              ) : (
                                <ManOutlined style={{ color: 'var(--primary)', fontSize: 18 }} />
                              )}
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                                  {voice.name}
                                </span>
                                <Tag color={voice.color} style={{ borderRadius: 6, fontSize: 10, padding: '0 4px' }}>
                                  {voice.region}
                                </Tag>
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.3 }}>
                                {voice.description}
                              </div>
                            </div>
                          </div>

                          <Space size={6} style={{ flexShrink: 0 }}>
                            <Button
                              size="middle"
                              icon={isPreviewing ? <LoadingOutlined /> : <PlayCircleOutlined />}
                              onClick={() => handlePreviewVieNeuVoice(voice)}
                              loading={isPreviewing}
                              style={{ minHeight: 38 }}
                            >
                              Thử
                            </Button>
                            <Button
                              type={isSelected ? 'primary' : 'default'}
                              size="middle"
                              icon={isSelected ? <CheckOutlined /> : undefined}
                              onClick={() => handleSelectVieNeuVoice(voice)}
                              style={{
                                fontWeight: 600,
                                minHeight: 38,
                                background: isSelected ? '#13c2c2' : undefined,
                                borderColor: isSelected ? '#13c2c2' : undefined,
                              }}
                            >
                              {isSelected ? 'Chọn' : 'Dùng'}
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

          // TAB 4: SYSTEM VOICES
          {
            key: 'system',
            label: (
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                📱 Trên máy
              </span>
            ),
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Alert
                  type="info"
                  showIcon
                  message="Giọng đọc thiết bị (Offline)"
                  description="Sử dụng khi không có mạng."
                  style={{ borderRadius: 6, fontSize: 12 }}
                />

                <Input.Search
                  placeholder="Tìm giọng trình duyệt..."
                  allowClear
                  value={systemSearch}
                  onChange={(e) => setSystemSearch(e.target.value)}
                  style={{ borderRadius: 6 }}
                />

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
                          padding: '8px 10px',
                          borderRadius: 6,
                          marginBottom: 6,
                          background: isSelected ? 'var(--primary-soft)' : 'var(--surface-alt)',
                          border: isSelected ? '1px solid var(--primary)' : '1px solid #f1f5f9',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
                          <Space size={8} style={{ flex: 1, minWidth: 0 }}>
                            {renderPlatformIcon(voice.name)}
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>
                                {info.displayName}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                                {voice.name}
                              </div>
                            </div>
                          </Space>
                          <Space size={4}>
                            <Button
                              size="small"
                              icon={isPreviewing ? <LoadingOutlined /> : <PlayCircleOutlined />}
                              onClick={() => handlePreviewSystemVoice(voice)}
                              loading={isPreviewing}
                            />
                            <Button
                              type={isSelected ? 'primary' : 'default'}
                              size="small"
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
            ),
          },
        ]).sort((a, b) => TAB_ORDER.indexOf(a.key) - TAB_ORDER.indexOf(b.key))}
      />
    </Drawer>
  );
};
